import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

  // User-scoped client for auth check
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service client for DB access
  const supabase = createClient(supabaseUrl, serviceKey);

  const { invoice_id } = await req.json();
  if (!invoice_id) {
    return new Response(JSON.stringify({ error: "invoice_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoice_id)
    .single();
  if (invErr || !invoice) {
    return new Response(JSON.stringify({ error: "Invoice not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch ERP settings
  const { data: settings, error: settingsErr } = await supabase
    .from("erp_settings")
    .select("*")
    .limit(1)
    .single();
  if (settingsErr || !settings) {
    return new Response(
      JSON.stringify({ error: "ERP settings not configured" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!settings.is_enabled) {
    return new Response(
      JSON.stringify({ success: false, skipped: true, reason: "ERP integration disabled" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!settings.endpoint_url) {
    return new Response(
      JSON.stringify({ error: "ERP endpoint URL not configured" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Build payload according to ERP type
  const payload = buildPayload(settings.erp_type, invoice, settings);

  // POST to ERP
  const erpHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (settings.api_key) {
    erpHeaders["Authorization"] = `Bearer ${settings.api_key}`;
  }
  if (settings.company_id) {
    erpHeaders["X-Company-Id"] = settings.company_id;
  }

  let erpResponse: Response;
  try {
    erpResponse = await fetch(settings.endpoint_url, {
      method: "POST",
      headers: erpHeaders,
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    console.error("ERP fetch error:", err);
    return new Response(
      JSON.stringify({ error: `ERP connection failed: ${err.message}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const erpBody = await erpResponse.text();
  if (!erpResponse.ok) {
    console.error(`ERP error [${erpResponse.status}]:`, erpBody);
    return new Response(
      JSON.stringify({ error: `ERP returned ${erpResponse.status}`, details: erpBody }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Log action
  await supabase.from("invoice_actions").insert({
    invoice_id,
    user_id: user.id,
    user_email: user.email,
    action: "erp_posted",
    metadata: { erp_type: settings.erp_type, status_code: erpResponse.status },
  });

  return new Response(
    JSON.stringify({ success: true, erp_response: erpBody }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

function buildPayload(erpType: string, invoice: any, settings: any) {
  const base = {
    invoice_number: invoice.invoice_number,
    supplier:       invoice.supplier,
    supplier_vat:   invoice.supplier_vat,
    amount:         invoice.amount,
    currency:       invoice.currency ?? "EUR",
    invoice_date:   invoice.invoice_date,
    due_date:       invoice.due_date,
    items:          invoice.items ?? [],
  };

  if (erpType === "softone") {
    return {
      service: "setData",
      clientID: settings.company_id,
      appId: 1001,
      OBJECT: "SOPURCHINVOICE",
      data: {
        SOPURCHINVOICE: [{
          SERIES: "",
          TRDR: invoice.supplier_vat,
          DATE: invoice.invoice_date,
          FINCODE: invoice.invoice_number,
          FINDOC: invoice.invoice_number,
          ...base,
        }],
      },
    };
  }

  if (erpType === "entersoft") {
    return {
      header: {
        companyId: settings.company_id,
        branchId:  settings.branch_id,
      },
      document: {
        documentType: "PurchaseInvoice",
        ...base,
      },
    };
  }

  // Generic / custom
  return base;
}
