/**
 * Invoice action hooks — query and log audit trail entries for invoices.
 * Every significant action (approve, reject, send to ERP, etc.) is recorded
 * in the invoice_actions table for full traceability.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single audit trail entry for an invoice */
export type InvoiceAction = {
  id: string;
  invoice_id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
};

// ─── Labels ───────────────────────────────────────────────────────────────────

/** Greek labels and semantic colours for each action type */
export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_approved:       { label: "Εγκρίθηκε από χρήστη",    color: "text-success" },
  sent_to_erp:         { label: "Αποστολή στο ERP",         color: "text-primary" },
  accountant_approved: { label: "Εγκρίθηκε από λογιστή",   color: "text-success" },
  accountant_rejected: { label: "Απορρίφθηκε από λογιστή", color: "text-destructive" },
  returned_to_draft:   { label: "Επιστροφή σε Draft",       color: "text-muted-foreground" },
  erp_posted:          { label: "Καταχωρήθηκε στο ERP",    color: "text-success" },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetch all actions for a specific invoice (most recent first) */
export function useInvoiceActions(invoiceId: string) {
  return useQuery({
    queryKey: ["invoice-actions", invoiceId],
    queryFn: async (): Promise<InvoiceAction[]> => {
      const { data, error } = await supabase
        .from("invoice_actions")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InvoiceAction[];
    },
    enabled: !!invoiceId,
  });
}

/** Log a new action for an invoice (auto-attaches current user) */
export function useLogInvoiceAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      action,
      metadata = {},
    }: {
      invoiceId: string;
      action: string;
      metadata?: Record<string, any>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("invoice_actions").insert({
        invoice_id: invoiceId,
        user_id: user.id,
        user_email: user.email,
        action,
        metadata,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["invoice-actions", vars.invoiceId] });
    },
  });
}
