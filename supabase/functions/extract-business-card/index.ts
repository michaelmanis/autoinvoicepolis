import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { file_path, file_name } = await req.json();
    if (!file_path) throw new Error("file_path is required");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Download file
    const { data: fileData, error: dlError } = await supabaseAdmin.storage
      .from("invoices")
      .download(file_path);
    if (dlError || !fileData) throw new Error("Failed to download file: " + dlError?.message);

    // Convert to base64 (chunked to avoid stack overflow)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);

    const ext = (file_name || file_path).split(".").pop()?.toLowerCase() || "jpg";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf", png: "image/png", jpg: "image/jpeg",
      jpeg: "image/jpeg", webp: "image/webp",
    };
    const mimeType = mimeMap[ext] || "image/jpeg";

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a business card data extractor. Analyze the image which may contain ONE or MULTIPLE business cards (e.g. a photo of many cards laid out on a table, a scanned page with multiple cards, or a single card).

For EACH business card you can identify, extract:
- company: The company/organization name
- contact_surname: The person's surname/last name
- contact_name: The person's first name
- title: The person's job title/position
- email: Email address
- mobile_phone: Mobile/cell phone number (prefer mobile over landline)

Return ALL cards found using the provided tool. If a field is not visible or cannot be determined, set it to null.
Be thorough — scan the entire image carefully for every distinct business card.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              { type: "text", text: "Extract ALL business cards from this image. There may be one or many cards visible." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_business_cards",
              description: "Extract structured data from one or more business cards in the image",
              parameters: {
                type: "object",
                properties: {
                  cards: {
                    type: "array",
                    description: "Array of business cards found in the image",
                    items: {
                      type: "object",
                      properties: {
                        company: { type: "string", nullable: true },
                        contact_surname: { type: "string", nullable: true },
                        contact_name: { type: "string", nullable: true },
                        title: { type: "string", nullable: true },
                        email: { type: "string", nullable: true },
                        mobile_phone: { type: "string", nullable: true },
                      },
                      required: ["company", "contact_surname", "contact_name", "title", "email", "mobile_phone"],
                    },
                  },
                },
                required: ["cards"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_business_cards" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error ${response.status}: ${errText}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const extracted = JSON.parse(toolCall.function.arguments);
    const cardsList = extracted.cards || [extracted]; // fallback if single object

    if (cardsList.length === 0) {
      return new Response(JSON.stringify({ success: true, cards: [], count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create signed URL for file
    const { data: signedData } = await supabaseAdmin.storage
      .from("invoices")
      .createSignedUrl(file_path, 60 * 60 * 24 * 365);

    // Insert all cards
    const inserts = cardsList.map((card: any) => ({
      user_id: user.id,
      company: card.company || null,
      contact_surname: card.contact_surname || null,
      contact_name: card.contact_name || null,
      title: card.title || null,
      email: card.email || null,
      mobile_phone: card.mobile_phone || null,
      file_url: signedData?.signedUrl || null,
      file_name: file_name || null,
    }));

    const { data: saved, error: insertError } = await supabaseAdmin
      .from("business_cards")
      .insert(inserts)
      .select();

    if (insertError) throw new Error("Failed to save: " + insertError.message);

    return new Response(JSON.stringify({ success: true, cards: saved, count: saved?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-business-card error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
