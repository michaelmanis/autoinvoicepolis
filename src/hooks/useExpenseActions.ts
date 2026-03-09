/**
 * Expense action hooks — query and log audit trail entries for expenses.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExpenseAction = {
  id: string;
  expense_id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
};

export const EXPENSE_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_approved:       { label: "Εγκρίθηκε από χρήστη",    color: "text-success" },
  sent_to_erp:         { label: "Αποστολή στο ERP",         color: "text-primary" },
  accountant_approved: { label: "Εγκρίθηκε από λογιστή",   color: "text-success" },
  accountant_rejected: { label: "Απορρίφθηκε από λογιστή", color: "text-destructive" },
  returned_to_draft:   { label: "Επιστροφή σε Draft",       color: "text-muted-foreground" },
  erp_posted:          { label: "Καταχωρήθηκε στο ERP",    color: "text-success" },
};

export function useExpenseActions(expenseId: string) {
  return useQuery({
    queryKey: ["expense-actions", expenseId],
    queryFn: async (): Promise<ExpenseAction[]> => {
      const { data, error } = await supabase
        .from("expense_actions" as any)
        .select("*")
        .eq("expense_id", expenseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ExpenseAction[];
    },
    enabled: !!expenseId,
  });
}

export function useLogExpenseAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expenseId,
      action,
      metadata = {},
    }: {
      expenseId: string;
      action: string;
      metadata?: Record<string, any>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("expense_actions" as any).insert({
        expense_id: expenseId,
        user_id: user.id,
        user_email: user.email,
        action,
        metadata,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["expense-actions", vars.expenseId] });
    },
  });
}
