/**
 * useUserRole — Fetches the current user's roles from the user_roles table.
 * Provides convenience booleans (isAdmin, isAccountant) for role-based UI rendering.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "accountant" | "user";

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setRoles((data ?? []).map((r: any) => r.role as AppRole));
        setLoading(false);
      });
  }, [user]);

  const isAccountant = roles.includes("accountant");
  const isAdmin = roles.includes("admin");

  return { roles, isAccountant, isAdmin, loading };
}
