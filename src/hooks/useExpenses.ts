/**
 * Expense data hooks — React Query hooks for fetching and mutating expenses.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Expense } from "@/types/expense";

const EXPENSES_KEY = ["expenses"] as const;

export function useExpenses() {
  return useQuery({
    queryKey: EXPENSES_KEY,
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Expense[];
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
      toast({ title: "Διαγράφηκε" });
    },
    onError: (err: any) => {
      toast({ title: "Σφάλμα διαγραφής", description: err.message, variant: "destructive" });
    },
  });
}
