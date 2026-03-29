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

    const { file_path, file_name, project_id, document_type } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: "file_path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Download file + pre-generate signed URL in parallel
    const [{ data: fileData, error: downloadError }, { data: signedUrlData }] = await Promise.all([
      supabaseAdmin.storage.from("invoices").download(file_path),
      supabaseAdmin.storage.from("invoices").createSignedUrl(file_path, 60 * 60 * 24 * 7),
    ]);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert file to base64 using chunked approach to avoid stack overflow on large files
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

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

    // Tool that supports multiple invoices
    const extractionTools = [
      {
        type: "function",
        function: {
          name: "extract_invoices",
          description: "Extract one or more invoices from the document. If the document contains multiple invoices, return all of them as separate objects in the invoices array.",
          parameters: {
            type: "object",
            properties: {
              invoices: {
                type: "array",
                description: "Array of invoices found in the document. Each invoice is a separate object.",
                items: {
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
                          product_id: { type: "string", description: "Product code, article number, SKU, grade, model number, or catalog reference for this line item. Look in columns labeled ARTICLE, ITEM, CODE, GRADE, REF, SKU, COMMODITY, or similar." },
                          description: { type: "string" },
                          quantity: { type: "number" },
                          unit_price: { type: "number" },
                          total: { type: "number" },
                        },
                      },
                    },
                    raw_text: { type: "string", description: "Raw text of this specific invoice" },
                  },
                },
              },
            },
            required: ["invoices"],
            additionalProperties: false,
          },
        },
      },
    ];

    const systemPrompt = `You are an invoice data extraction expert. 
IMPORTANT: A single document may contain MULTIPLE invoices (e.g. multiple pages each with a different invoice, or multiple invoices on the same page).
Carefully scan the ENTIRE document and identify ALL distinct invoices present.
Return each invoice as a SEPARATE entry in the invoices array.
If only one invoice exists, return an array with one item.

PRODUCT CODE EXTRACTION — CRITICAL RULES:
The product code (product_id) is almost always EMBEDDED INSIDE the product description/name. It is typically an alphanumeric code (letters+numbers or just numbers) that appears AFTER the brand/product name. Examples:
- "SENSICARE M 5000" → product_id = "M 5000"
- "POLYMER POWDER ACCURATE 5011N" → product_id = "5011N"
- "BIOPOL VR 20" → product_id = "VR 20"
- "NOVISBRIGHT RED 4G" → product_id = "RED 4G"
- "CHEMOFAST HB 100" → product_id = "HB 100"
The pattern is: [BRAND NAME] [CODE]. The code is the last part that contains numbers (and possibly letters). Extract it carefully.
Also check columns labeled ARTICLE, ITEM, CODE, GRADE, REF, SKU, COMMODITY for dedicated product codes.
If no code can be identified at all, set product_id to null.

AMOUNT FORMAT: All numeric amounts (unit_price, total, amount) must be numbers rounded to exactly 2 decimal places. For example: 747.60, not 747.6 or 747.600.
Dates must be in YYYY-MM-DD format. Amounts must be numbers without currency symbols.
If a field is not visible for a given invoice, set it to null.`;

    let aiResponse: Response;

    if (isPdf) {
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
                { type: "text", text: "Scan the entire document and extract ALL invoices found. Return each invoice separately in the invoices array." },
              ],
            },
          ],
          tools: extractionTools,
          tool_choice: { type: "function", function: { name: "extract_invoices" } },
        }),
      });
    } else {
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
                { type: "text", text: "Scan the entire document and extract ALL invoices found. Return each invoice separately in the invoices array." },
              ],
            },
          ],
          tools: extractionTools,
          tool_choice: { type: "function", function: { name: "extract_invoices" } },
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

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Could not extract data from document" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    const invoiceList: Record<string, unknown>[] = extracted.invoices || [];

    if (invoiceList.length === 0) {
      return new Response(JSON.stringify({ error: "No invoices found in document" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert all invoices
    const rows = invoiceList.map((inv: Record<string, unknown>) => ({
      user_id: user.id,
      supplier: (inv.supplier as string) || null,
      supplier_vat: (inv.supplier_vat as string) || null,
      invoice_number: (inv.invoice_number as string) || null,
      invoice_date: (inv.invoice_date as string) || null,
      due_date: (inv.due_date as string) || null,
      amount: (inv.amount as number) || null,
      currency: (inv.currency as string) || "EUR",
      items: (inv.items as unknown[]) || [],
      raw_ocr_text: (inv.raw_text as string) || null,
      status: "draft",
      file_url: signedUrlData?.signedUrl || null,
      file_name: file_name || null,
      project_id: project_id || null,
      document_type: document_type || null,
    }));

    const { data: invoices, error: insertError } = await supabaseAdmin
      .from("invoices")
      .insert(rows)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save invoices" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ invoices, count: invoices?.length ?? 0, extracted: invoiceList }),
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
