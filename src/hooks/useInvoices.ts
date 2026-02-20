import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Invoice } from "@/types/invoice";

const INVOICES_KEY = ["invoices"] as const;

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

/** Fetches invoices for the accountant folder (pending + approved) */
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

/** Shared archive/reject mutation used by both accountant views */
export function useAccountantMutation(
  invalidateKeys: string[][]
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      approved,
    }: {
      id: string;
      approved: boolean;
    }) => {
      if (approved) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const resp = await supabase.functions.invoke("archive-invoice", {
          body: { invoice_id: id },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        if (resp.error) throw resp.error;
        return { approved, monthFolder: resp.data?.month_folder as string | undefined };
      } else {
        const { error } = await supabase
          .from("invoices")
          .update({ status: "draft" })
          .eq("id", id);
        if (error) throw error;
        return { approved, monthFolder: undefined };
      }
    },
    onSuccess: (result) => {
      invalidateKeys.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      );
      if (result.approved) {
        toast({ title: "✅ Εγκρίθηκε από λογιστή!" });
      } else {
        toast({ title: "↩️ Επιστράφηκε σε Draft" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    },
  });
}
