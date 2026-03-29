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

    const { file_path, file_name, document_type } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: "file_path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

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

    const extractionTools = [
      {
        type: "function",
        function: {
          name: "extract_expenses",
          description: "Extract one or more expenses from the document. Focus on the total amount, supplier info, and dates. No need to extract individual line items.",
          parameters: {
            type: "object",
            properties: {
              expenses: {
                type: "array",
                description: "Array of expenses found in the document.",
                items: {
                  type: "object",
                  properties: {
                    supplier: { type: "string", description: "Supplier/vendor name" },
                    supplier_vat: { type: "string", description: "Supplier VAT/Tax ID" },
                    expense_number: { type: "string", description: "Receipt/expense/invoice number" },
                    expense_date: { type: "string", description: "Date (YYYY-MM-DD)" },
                    due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
                    amount: { type: "number", description: "Total amount including VAT" },
                    currency: { type: "string", description: "Currency code (EUR, USD etc)" },
                    description: { type: "string", description: "Brief description of the expense (e.g. office supplies, travel, fuel)" },
                  },
                },
              },
            },
            required: ["expenses"],
            additionalProperties: false,
          },
        },
      },
    ];

    const systemPrompt = `You are an expense/receipt data extraction expert.
IMPORTANT: A single document may contain MULTIPLE expenses or receipts.
Carefully scan the ENTIRE document and identify ALL distinct expenses present.
Focus on extracting the TOTAL AMOUNT (including VAT), supplier information, and dates.
Do NOT extract individual line items — only the final total amount matters.
If only one expense exists, return an array with one item.
AMOUNT FORMAT: All amounts must be numbers rounded to exactly 2 decimal places (e.g. 747.60).
Dates must be in YYYY-MM-DD format.
If a field is not visible, set it to null.`;

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
                { type: "text", text: "Extract ALL expenses from this document. Focus on total amounts, not line items." },
              ],
            },
          ],
          tools: extractionTools,
          tool_choice: { type: "function", function: { name: "extract_expenses" } },
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
                { type: "text", text: "Extract ALL expenses from this document. Focus on total amounts, not line items." },
              ],
            },
          ],
          tools: extractionTools,
          tool_choice: { type: "function", function: { name: "extract_expenses" } },
        }),
      });
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Could not extract data from document" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    const expenseList: Record<string, unknown>[] = extracted.expenses || [];

    if (expenseList.length === 0) {
      return new Response(JSON.stringify({ error: "No expenses found in document" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = expenseList.map((exp: Record<string, unknown>) => ({
      user_id: user.id,
      supplier: (exp.supplier as string) || null,
      supplier_vat: (exp.supplier_vat as string) || null,
      expense_number: (exp.expense_number as string) || null,
      expense_date: (exp.expense_date as string) || null,
      due_date: (exp.due_date as string) || null,
      amount: (exp.amount as number) || null,
      currency: (exp.currency as string) || "EUR",
      description: (exp.description as string) || null,
      status: "draft",
      file_url: signedUrlData?.signedUrl || null,
      file_name: file_name || null,
    }));

    const { data: expenses, error: insertError } = await supabaseAdmin
      .from("expenses")
      .insert(rows)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save expenses" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ expenses, count: expenses?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
