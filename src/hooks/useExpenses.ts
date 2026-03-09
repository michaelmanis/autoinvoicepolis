/**
 * Expense data hooks — React Query hooks for fetching and mutating expenses.
 * Mirrors useInvoices.ts with full ERP workflow support.
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

/** Fetch expenses for the accountant folder (pending + approved) */
export function useAccountantFolderExpenses() {
  return useQuery({
    queryKey: ["accountant-folder-expenses"],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .in("status", ["accountant_pending", "accountant_approved"])
        .order("expense_date", { ascending: false, nullsFirst: false });
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

/**
 * Shared approve/reject mutation for expenses used by accountant views.
 */
export function useAccountantExpenseMutation(invalidateKeys: string[][]) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      if (approved) {
        // Update expense status to accountant_approved
        const { error } = await supabase
          .from("expenses")
          .update({ status: "accountant_approved" })
          .eq("id", id);
        if (error) throw error;

        // Log the action
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("expense_actions" as any).insert({
            expense_id: id,
            user_id: user.id,
            user_email: user.email,
            action: "accountant_approved",
            metadata: {},
          } as any);
        }
        return { approved };
      } else {
        // Return expense to draft
        const { error } = await supabase
          .from("expenses")
          .update({ status: "draft" })
          .eq("id", id);
        if (error) throw error;

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("expense_actions" as any).insert({
            expense_id: id,
            user_id: user.id,
            user_email: user.email,
            action: "accountant_rejected",
            metadata: {},
          } as any);
        }
        return { approved };
      }
    },
    onSuccess: (result) => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({
        title: result.approved ? "✅ Εγκρίθηκε από λογιστή!" : "↩️ Επιστράφηκε σε Draft",
      });
    },
    onError: (err: any) => {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    },
  });
}
