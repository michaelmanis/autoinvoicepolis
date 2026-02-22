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

    const body = await req.json();
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const user_id = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";

    // Validate action
    const validActions = ["ban", "unban", "delete", "bulk_assign_role"];
    if (!action || !validActions.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user_id (UUID or comma-separated UUIDs for bulk)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "bulk_assign_role" && !uuidRegex.test(user_id)) {
      return new Response(JSON.stringify({ error: "Invalid user_id format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_assign_role") {
      const ids = user_id.split(",").map((id: string) => id.trim());
      if (ids.some((id: string) => !uuidRegex.test(id))) {
        return new Response(JSON.stringify({ error: "Invalid user_id format in bulk list" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (ids.length > 50) {
        return new Response(JSON.stringify({ error: "Maximum 50 users per bulk operation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate role for bulk_assign_role
    const validRoles = ["admin", "accountant", "user"];
    if (action === "bulk_assign_role" && (!role || !validRoles.includes(role))) {
      return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-actions
    const singleUserId = action !== "bulk_assign_role" ? user_id : null;
    if (singleUserId === caller.id && (action === "delete" || action === "ban")) {
      return new Response(JSON.stringify({ error: "Cannot perform this action on yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = { success: true };

    switch (action) {
      case "ban": {
        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "876600h", // ~100 years
        });
        if (error) throw error;
        result.message = "User banned";
        break;
      }
      case "unban": {
        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });
        if (error) throw error;
        result.message = "User unbanned";
        break;
      }
      case "delete": {
        // Remove roles & memberships first
        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        await adminClient.from("company_members").delete().eq("user_id", user_id);
        const { error } = await adminClient.auth.admin.deleteUser(user_id);
        if (error) throw error;
        result.message = "User deleted";
        break;
      }
      case "bulk_assign_role": {
        // user_id can be a comma-separated list
        const userIds = user_id.split(",").map((id: string) => id.trim()).filter(Boolean);
        if (!role) {
          return new Response(JSON.stringify({ error: "role is required for bulk_assign_role" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        for (const uid of userIds) {
          // Delete existing roles
          await adminClient.from("user_roles").delete().eq("user_id", uid);
          // Insert new role
          await adminClient.from("user_roles").insert({ user_id: uid, role });
        }
        result.message = `Role '${role}' assigned to ${userIds.length} users`;
        result.count = userIds.length;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
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
