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

    // Create client with user's auth
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_path, file_name } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: "file_path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the file from storage using service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("invoices")
      .download(file_path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert file to base64 (chunk to avoid stack overflow)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    // Determine mime type and whether it's a PDF
    const ext = file_path.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";
    const isPdf = ext === "pdf";

    // Build the user content array:
    // - Skylark only supports image types (PNG/JPEG/WEBP), not PDFs
    // - For PDFs, fall back to Lovable AI (Gemini) which supports PDF natively
    // - For images, use Skylark Vision API
    let aiResponse: Response;

    const extractionTools = [
      {
        type: "function",
        function: {
          name: "extract_invoice_data",
          description: "Extract structured invoice data",
          parameters: {
            type: "object",
            properties: {
              supplier: { type: "string", description: "Supplier/vendor name" },
              supplier_vat: { type: "string", description: "Supplier VAT/Tax ID" },
              invoice_number: { type: "string", description: "Invoice number" },
              invoice_date: { type: "string", description: "Invoice date (YYYY-MM-DD)" },
              due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
              amount: { type: "number", description: "Total amount" },
              currency: { type: "string", description: "Currency code (EUR, USD etc)" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    quantity: { type: "number" },
                    unit_price: { type: "number" },
                    total: { type: "number" },
                  },
                },
              },
              raw_text: { type: "string", description: "Full raw text from the document" },
            },
            required: ["supplier"],
            additionalProperties: false,
          },
        },
      },
    ];

    const systemPrompt = `You are an invoice data extraction expert. Extract structured data from invoice images/PDFs.
Always respond by calling the extract_invoice_data function with the extracted data.
If a field is not visible, set it to null. For items, extract each line item with description, quantity, unit_price, and total.
Dates should be in YYYY-MM-DD format. Amounts should be numbers without currency symbols.`;

    if (isPdf) {
      // PDFs → Lovable AI (Gemini) which natively understands PDF
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                { type: "text", text: "Extract all invoice data from this document. Include supplier name, VAT number, invoice number, dates, amounts, and line items." },
              ],
            },
          ],
          tools: extractionTools,
          tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
        }),
      });
    } else {
      // Images → Skylark Vision API
      const skylarkApiKey = Deno.env.get("SKYLARK_API_KEY")!;
      aiResponse = await fetch("https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${skylarkApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "seed-1-6-flash-250615",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                { type: "text", text: "Extract all invoice data from this document. Include supplier name, VAT number, invoice number, dates, amounts, and line items." },
              ],
            },
          ],
          tools: extractionTools,
          tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
        }),
      });
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    let extracted;
    if (toolCall?.function?.arguments) {
      extracted = JSON.parse(toolCall.function.arguments);
    } else {
      return new Response(JSON.stringify({ error: "Could not extract data from document" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get signed URL for the file
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from("invoices")
      .createSignedUrl(file_path, 60 * 60 * 24 * 7); // 7 days

    // Create invoice record
    const { data: invoice, error: insertError } = await supabaseAdmin
      .from("invoices")
      .insert({
        user_id: user.id,
        supplier: extracted.supplier || null,
        supplier_vat: extracted.supplier_vat || null,
        invoice_number: extracted.invoice_number || null,
        invoice_date: extracted.invoice_date || null,
        due_date: extracted.due_date || null,
        amount: extracted.amount || null,
        currency: extracted.currency || "EUR",
        items: extracted.items || [],
        raw_ocr_text: extracted.raw_text || null,
        status: "draft",
        file_url: signedUrlData?.signedUrl || null,
        file_name: file_name || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save invoice" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ invoice, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
