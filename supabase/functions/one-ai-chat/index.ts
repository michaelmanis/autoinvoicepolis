import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const userId = claimsData.claims.sub;

    const { messages, searchQuery } = await req.json();

    // If searchQuery, search across tables first and provide context
    let searchContext = "";
    if (searchQuery) {
      const term = `%${searchQuery}%`;

      const [invoices, expenses, projects] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, supplier, amount, status, invoice_date")
          .or(`supplier.ilike.${term},invoice_number.ilike.${term}`)
          .limit(10),
        supabase
          .from("expenses")
          .select("id, expense_number, supplier, amount, status, expense_date, description")
          .or(`supplier.ilike.${term},expense_number.ilike.${term},description.ilike.${term}`)
          .limit(10),
        supabase
          .from("projects")
          .select("id, name, status, description")
          .or(`name.ilike.${term},description.ilike.${term}`)
          .limit(10),
      ]);

      const results: string[] = [];
      if (invoices.data?.length)
        results.push(`Invoices found:\n${JSON.stringify(invoices.data, null, 2)}`);
      if (expenses.data?.length)
        results.push(`Expenses found:\n${JSON.stringify(expenses.data, null, 2)}`);
      if (projects.data?.length)
        results.push(`Projects found:\n${JSON.stringify(projects.data, null, 2)}`);

      if (results.length) {
        searchContext = `\n\nSearch results for "${searchQuery}":\n${results.join("\n\n")}`;
      } else {
        searchContext = `\n\nNo results found for "${searchQuery}".`;
      }
    }

    const systemPrompt = `You are One AI, a helpful assistant for DocuHandler — a document management application for invoices, expenses, projects and business cards. 
You help users find documents, answer questions about their data, and provide guidance on using the app.
Always respond in the same language as the user's message. Be concise and helpful.
When presenting search results, format them nicely with key details (number, supplier, amount, status, date).
If the user asks about something you can't find in the data, let them know and suggest how they might find it.${searchContext}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429)
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      if (response.status === 402)
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("one-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
