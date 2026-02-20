import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Verify the SendGrid webhook signature (optional but recommended)
function verifySendGridSignature(req: Request): boolean {
  const sendgridWebhookKey = Deno.env.get("SENDGRID_WEBHOOK_KEY");
  if (!sendgridWebhookKey) return true; // Skip verification if not configured
  // SendGrid sends X-Twilio-Email-Event-Webhook-Signature - basic key check
  const signature = req.headers.get("X-Twilio-Email-Event-Webhook-Signature");
  return !signature || signature === sendgridWebhookKey;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const contentType = req.headers.get("content-type") ?? "";

    // SendGrid Inbound Parse sends multipart/form-data
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data from SendGrid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();

    // Extract email metadata
    const from = formData.get("from")?.toString() ?? "";
    const to = formData.get("to")?.toString() ?? "";
    const subject = formData.get("subject")?.toString() ?? "";
    const envelope = formData.get("envelope")?.toString() ?? "{}";

    console.log(`Email intake: from=${from}, to=${to}, subject=${subject}`);

    // Try to find the user by "to" email address or a default user
    // The "to" field format is: "invoices+<user_id>@yourdomain.com" or just "invoices@yourdomain.com"
    let targetUserId: string | null = null;

    // Parse user ID from tagged email (invoices+<uuid>@domain.com)
    const toMatch = to.match(/\+([a-f0-9-]{36})@/i);
    if (toMatch) {
      targetUserId = toMatch[1];
    }

    // Find attachments
    const attachments: { name: string; content: Uint8Array; type: string }[] = [];
    const attachmentCount = parseInt(formData.get("attachments")?.toString() ?? "0");

    for (let i = 1; i <= Math.max(attachmentCount, 10); i++) {
      const file = formData.get(`attachment${i}`);
      if (!file || !(file instanceof File)) break;

      const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/jpg"];
      const allowedExts = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
      const isAllowedType = allowedTypes.includes(file.type);
      const isAllowedExt = allowedExts.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isAllowedType && !isAllowedExt) {
        console.log(`Skipping non-invoice attachment: ${file.name} (${file.type})`);
        continue;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      attachments.push({ name: file.name, content: bytes, type: file.type });
    }

    if (attachments.length === 0) {
      console.log("No valid invoice attachments found in email");
      return new Response(
        JSON.stringify({ success: true, message: "No invoice attachments found", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const attachment of attachments) {
      try {
        // Upload to storage
        const timestamp = Date.now();
        const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `email-intake/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(storagePath, attachment.content, {
            contentType: attachment.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          results.push({ file: attachment.name, error: uploadError.message });
          continue;
        }

        // Call extract-invoice edge function
        const extractResp = await supabase.functions.invoke("extract-invoice", {
          body: {
            file_path: storagePath,
            file_name: attachment.name,
            project_id: null,
            user_id_override: targetUserId, // Pass user ID if known from email
            source: "email",
            source_email: from,
          },
        });

        if (extractResp.error) {
          console.error("Extract error:", extractResp.error);
          results.push({ file: attachment.name, error: extractResp.error.message });
        } else {
          const count = extractResp.data?.count ?? 1;
          results.push({ file: attachment.name, success: true, invoices_created: count });
          console.log(`Processed ${attachment.name}: ${count} invoice(s) created`);
        }
      } catch (err: any) {
        console.error(`Error processing ${attachment.name}:`, err);
        results.push({ file: attachment.name, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.filter((r) => r.success).length,
        total: attachments.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Email intake error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
