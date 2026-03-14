/**
 * useCompanyFilter — Global context for admin company filtering.
 * Admins can select a company to filter invoices, expenses, and dashboard data.
 * Non-admins always see their own data (no filter applied).
 */

import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export interface CompanyOption {
  id: string;
  name: string;
}

interface CompanyFilterContextType {
  companies: CompanyOption[];
  selectedCompanyId: string | null; // null = "Όλες"
  setSelectedCompanyId: (id: string | null) => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const CompanyFilterContext = createContext<CompanyFilterContextType>({
  companies: [],
  selectedCompanyId: null,
  setSelectedCompanyId: () => {},
  isAdmin: false,
  isLoading: false,
});

export function CompanyFilterProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useUserRole();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as CompanyOption[];
    },
    enabled: isAdmin,
  });

  return (
    <CompanyFilterContext.Provider
      value={{ companies, selectedCompanyId, setSelectedCompanyId, isAdmin, isLoading }}
    >
      {children}
    </CompanyFilterContext.Provider>
  );
}

export function useCompanyFilter() {
  return useContext(CompanyFilterContext);
}
