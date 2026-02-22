import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List all users
    const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 500 });
    if (error) throw error;

    // Get all roles
    const { data: allRoles } = await adminClient.from("user_roles").select("*");

    // Get all company memberships with company names
    const { data: allMemberships } = await adminClient
      .from("company_members")
      .select("id, user_id, company_id, permissions");

    const { data: allCompanies } = await adminClient
      .from("companies")
      .select("id, name");

    const companyMap = Object.fromEntries((allCompanies || []).map((c: any) => [c.id, c.name]));

    const enrichedUsers = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      banned_until: u.banned_until || null,
      roles: (allRoles || []).filter((r: any) => r.user_id === u.id).map((r: any) => ({ id: r.id, role: r.role })),
      memberships: (allMemberships || [])
        .filter((m: any) => m.user_id === u.id)
        .map((m: any) => ({
          id: m.id,
          company_id: m.company_id,
          company_name: companyMap[m.company_id] || "Unknown",
          permissions: m.permissions,
        })),
    }));

    return new Response(JSON.stringify({ users: enrichedUsers, companies: allCompanies || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
