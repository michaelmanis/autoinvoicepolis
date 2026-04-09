import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userId = user.id;

    // Create a demo project
    const { data: project } = await supabase.from("projects").insert({
      user_id: userId,
      name: "Demo Project – Ανακαίνιση Γραφείου",
      description: "Δείγμα project για επίδειξη λειτουργικότητας",
      status: "active",
    }).select("id").single();

    const projectId = project?.id ?? null;

    // Demo invoices
    const invoices = [
      {
        user_id: userId,
        supplier: "ΑΦΟΙ ΠΑΠΑΔΟΠΟΥΛΟΙ ΑΕ",
        supplier_vat: "099876543",
        amount: 1250.00,
        currency: "EUR",
        invoice_number: "ΤΠΥ-2025-0142",
        invoice_date: "2025-03-15",
        due_date: "2025-04-15",
        status: "draft",
        document_type: "ΤΠΥ",
        notes: "Υλικά γραφείου",
        project_id: projectId,
      },
      {
        user_id: userId,
        supplier: "COSMOTE AE",
        supplier_vat: "094019245",
        amount: 89.90,
        currency: "EUR",
        invoice_number: "INV-88923",
        invoice_date: "2025-03-20",
        due_date: "2025-04-20",
        status: "review",
        document_type: "ΤΠΥ",
        notes: "Τηλεπικοινωνίες Μαρτίου",
      },
      {
        user_id: userId,
        supplier: "ΔΕΗ ΑΕ",
        supplier_vat: "090000045",
        amount: 342.17,
        currency: "EUR",
        invoice_number: "ΛΟΓ-2025-7821",
        invoice_date: "2025-02-28",
        due_date: "2025-03-28",
        status: "approved",
        document_type: "ΤΠΥ",
        notes: "Ηλεκτρικό ρεύμα Φεβρουαρίου",
        project_id: projectId,
      },
      {
        user_id: userId,
        supplier: "ΠΛΑΙΣΙΟ COMPUTERS ΑΕΒΕ",
        supplier_vat: "094298920",
        amount: 2499.00,
        currency: "EUR",
        invoice_number: "PL-560012",
        invoice_date: "2025-03-10",
        due_date: "2025-04-10",
        status: "accountant_pending",
        document_type: "ΤΠΥ",
        notes: "Αγορά laptop",
      },
      {
        user_id: userId,
        supplier: "ΜΕΤΑΦΟΡΙΚΗ ΕΛΛΑΔΟΣ ΕΠΕ",
        supplier_vat: "801234567",
        amount: 180.00,
        currency: "EUR",
        invoice_number: "MET-2025-345",
        invoice_date: "2025-01-22",
        due_date: "2025-02-22",
        status: "accountant_approved",
        document_type: "ΤΔΑ",
        notes: "Μεταφορικά Ιανουαρίου",
        project_id: projectId,
      },
      {
        user_id: userId,
        supplier: "VODAFONE ΕΛΛΑΔΑ",
        supplier_vat: "094439432",
        amount: 65.50,
        currency: "EUR",
        invoice_number: "VOD-99112",
        invoice_date: "2025-03-25",
        status: "draft",
        document_type: "ΤΠΥ",
        notes: "Κινητή τηλεφωνία",
      },
    ];

    // Demo expenses
    const expenses = [
      {
        user_id: userId,
        supplier: "SHELL ΕΛΛΑΣ ΑΕ",
        supplier_vat: "094082170",
        amount: 75.40,
        currency: "EUR",
        expense_number: "APD-11234",
        expense_date: "2025-03-18",
        status: "draft",
        document_type: "ΑΠΔ",
        description: "Καύσιμα υπηρεσιακού αυτοκινήτου",
      },
      {
        user_id: userId,
        supplier: "ΞΕΝΟΔΟΧΕΙΟ ΑΘΗΝΑΙΟΝ",
        amount: 220.00,
        currency: "EUR",
        expense_number: "HTL-5543",
        expense_date: "2025-03-05",
        status: "review",
        document_type: "ΑΠΔ",
        description: "Διαμονή επαγγελματικού ταξιδιού",
        project_id: projectId,
      },
      {
        user_id: userId,
        supplier: "ΕΣΤΙΑΤΟΡΙΟ ΚΡΗΤΙΚΟΝ",
        amount: 48.50,
        currency: "EUR",
        expense_number: "RCP-0087",
        expense_date: "2025-03-12",
        status: "approved",
        document_type: "ΑΠΛ",
        description: "Γεύμα εργασίας με πελάτη",
      },
      {
        user_id: userId,
        supplier: "ΤΑΞΙ ΑΘΗΝΑ ΕΠΕ",
        amount: 15.00,
        currency: "EUR",
        expense_number: "TX-00921",
        expense_date: "2025-03-20",
        status: "accountant_pending",
        document_type: "ΑΠΔ",
        description: "Μετακίνηση σε πελάτη",
      },
    ];

    const { error: invErr } = await supabase.from("invoices").insert(invoices);
    const { error: expErr } = await supabase.from("expenses").insert(expenses);

    if (invErr) console.error("Invoice insert error:", invErr);
    if (expErr) console.error("Expense insert error:", expErr);

    return new Response(
      JSON.stringify({ success: true, invoices: invoices.length, expenses: expenses.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seed-demo-data error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
