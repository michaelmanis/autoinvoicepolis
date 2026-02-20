import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, FileText, Clock, Eye } from "lucide-react";
import InvoiceDetail from "@/components/InvoiceDetail";
import { useAccountantMutation } from "@/hooks/useInvoices";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Invoice } from "@/types/invoice";

const INVALIDATE_KEYS = [["accountant-invoices"], ["invoices"]];

export default function AccountantPage() {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["accountant-invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("status", "accountant_pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const approveMutation = useAccountantMutation(INVALIDATE_KEYS);

  if (selectedInvoice) {
    return (
      <InvoiceDetail
        invoice={selectedInvoice}
        onBack={() => {
          setSelectedInvoice(null);
          queryClient.invalidateQueries({ queryKey: ["accountant-invoices"] });
        }}
        isAccountant
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Επιβεβαίωση Λογιστή</h2>
        <p className="text-sm text-muted-foreground">
          Τιμολόγια που αναμένουν επιβεβαίωση από τον λογιστή
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !invoices?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 gap-3">
          <CheckCircle2 className="h-12 w-12 text-success/40" />
          <p className="text-muted-foreground">Δεν υπάρχουν εκκρεμή τιμολόγια</p>
          <p className="text-sm text-muted-foreground/70">Όλα τα τιμολόγια έχουν ελεγχθεί</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="divide-y divide-border">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                    <FileText className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">
                      {inv.invoice_number || inv.file_name || "Χωρίς αριθμό"}
                    </p>
                    <p className="text-sm text-muted-foreground">{inv.supplier || "Άγνωστος προμηθευτής"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {inv.amount != null && (
                    <span className="text-sm font-medium text-card-foreground">
                      {inv.amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {inv.currency || "€"}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
                    <Clock className="h-3.5 w-3.5" />
                    Αναμονή Ελέγχου
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(inv)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => approveMutation.mutate({ id: inv.id, approved: true })}
                      disabled={approveMutation.isPending}
                      title="Έγκριση"
                    >
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => approveMutation.mutate({ id: inv.id, approved: false })}
                      disabled={approveMutation.isPending}
                      title="Απόρριψη"
                    >
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
