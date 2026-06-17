import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const items: Array<{
      kind: "invoice" | "expense" | "business_card" | "project";
      ref_id: string;
      content: string;
      metadata?: Record<string, unknown>;
    }> = Array.isArray(body.items) ? body.items : [body];

    const cleanItems = items.filter(
      (i) => i?.kind && i?.ref_id && typeof i?.content === "string" && i.content.trim().length > 0,
    );
    if (cleanItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: cleanItems.map((i) => i.content.slice(0, 8000)),
      }),
    });

    if (!embRes.ok) {
      const txt = await embRes.text();
      console.error("Embedding error:", embRes.status, txt);
      return new Response(JSON.stringify({ error: "Embedding failed", detail: txt }), {
        status: embRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const embJson = await embRes.json();
    const vectors: number[][] = embJson.data.map((d: any) => d.embedding);

    const admin = createClient(supabaseUrl, serviceKey);
    const rows = cleanItems.map((it, idx) => ({
      user_id: user.id,
      kind: it.kind,
      ref_id: it.ref_id,
      content: it.content.slice(0, 8000),
      embedding: vectors[idx] as unknown as string, // pgvector accepts array via supabase-js
      metadata: it.metadata ?? {},
    }));

    const { error } = await admin
      .from("document_embeddings")
      .upsert(rows, { onConflict: "kind,ref_id" });

    if (error) {
      console.error("Upsert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-embedding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
