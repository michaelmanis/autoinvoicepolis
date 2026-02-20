import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Fetch invoice
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (fetchError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine archive month folder from invoice_date or now
    const dateSource = invoice.invoice_date ? new Date(invoice.invoice_date) : new Date();
    const year = dateSource.getFullYear();
    const month = String(dateSource.getMonth() + 1).padStart(2, "0");
    const monthFolder = `archived/${year}-${month}`;

    // Get current file_url to extract original path
    const fileUrl = invoice.file_url || "";
    const fileName = invoice.file_name || `invoice_${invoice_id}`;

    // Try to find the original storage path from file_url
    // file_url is a signed URL like: .../storage/v1/object/sign/invoices/<path>?token=...
    let originalPath: string | null = null;
    try {
      const match = fileUrl.match(/\/storage\/v1\/object\/sign\/invoices\/([^?]+)/);
      if (match) {
        originalPath = decodeURIComponent(match[1]);
      }
    } catch (_) {
      // ignore parse errors
    }

    let newSignedUrl: string | null = null;
    let newPath: string | null = null;

    if (originalPath) {
      // Download the file
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from("invoices")
        .download(originalPath);

      if (!downloadError && fileData) {
        // Build new path in the monthly archive folder
        const safeFileName = fileName.replace(/[^\w.\-]/g, "_");
        newPath = `${monthFolder}/${safeFileName}`;

        // Upload to archive folder
        const arrayBuffer = await fileData.arrayBuffer();
        const { error: uploadError } = await supabaseAdmin.storage
          .from("invoices")
          .upload(newPath, arrayBuffer, {
            contentType: fileData.type || "application/octet-stream",
            upsert: true,
          });

        if (!uploadError) {
          // Generate new signed URL (7 days)
          const { data: signedData } = await supabaseAdmin.storage
            .from("invoices")
            .createSignedUrl(newPath, 60 * 60 * 24 * 7);
          newSignedUrl = signedData?.signedUrl || null;
        } else {
          console.error("Upload to archive error:", uploadError);
        }
      } else {
        console.error("Download error:", downloadError);
      }
    }

    // Update invoice: status -> accountant_approved, update file_url if archived
    const updatePayload: Record<string, unknown> = { status: "accountant_approved" };
    if (newSignedUrl) updatePayload.file_url = newSignedUrl;

    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoice_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update invoice" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        archived_path: newPath,
        month_folder: monthFolder,
        file_url: newSignedUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
