/**
 * Invoice data hooks — centralised React Query hooks for fetching and
 * mutating invoices. All invoice list components should use these hooks
 * instead of writing inline queries.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Invoice } from "@/types/invoice";

/** Shared query key for the main invoices list */
const INVOICES_KEY = ["invoices"] as const;

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Fetch all invoices ordered by most recent first */
export function useInvoices() {
  return useQuery({
    queryKey: INVOICES_KEY,
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

/** Fetch invoices for the accountant folder (pending + approved) */
export function useAccountantFolderInvoices() {
  return useQuery({
    queryKey: ["accountant-folder-invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .in("status", ["accountant_pending", "accountant_approved"])
        .order("invoice_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Delete an invoice by ID and invalidate the list cache */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      toast({ title: "Διαγράφηκε" });
    },
    onError: (err: any) => {
      toast({ title: "Σφάλμα διαγραφής", description: err.message, variant: "destructive" });
    },
  });
}

/**
 * Shared approve/reject mutation used by both accountant views.
 * - Approve: calls the archive-invoice edge function
 * - Reject: sets status back to "draft" and logs the action
 *
 * @param invalidateKeys — query keys to invalidate on success
 */
export function useAccountantMutation(invalidateKeys: string[][]) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      if (approved) {
        // Archive the invoice via edge function
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await supabase.functions.invoke("archive-invoice", {
          body: { invoice_id: id },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        if (resp.error) throw resp.error;
        return { approved, monthFolder: resp.data?.month_folder as string | undefined };
      } else {
        // Return invoice to draft
        const { error } = await supabase
          .from("invoices")
          .update({ status: "draft" })
          .eq("id", id);
        if (error) throw error;

        // Log the rejection action
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("invoice_actions").insert({
            invoice_id: id,
            user_id: user.id,
            user_email: user.email,
            action: "accountant_rejected",
            metadata: {},
          });
        }
        return { approved, monthFolder: undefined };
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
