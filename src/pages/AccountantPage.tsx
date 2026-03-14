/**
 * AccountantPage — Responsive invoice review for accountants.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, FileText, Clock, Eye } from "lucide-react";
import InvoiceDetail from "@/components/InvoiceDetail";
import { useAccountantMutation } from "@/hooks/useInvoices";
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
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-base md:text-lg font-semibold text-foreground">Επιβεβαίωση Λογιστή</h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Τιμολόγια που αναμένουν επιβεβαίωση
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !invoices?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 md:py-16 gap-3">
          <CheckCircle2 className="h-12 w-12 text-success/40" />
          <p className="text-muted-foreground">Δεν υπάρχουν εκκρεμή τιμολόγια</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="divide-y divide-border">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-secondary/50 md:flex-row md:items-center md:justify-between md:px-6 md:py-4"
              >
                {/* Left */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-card-foreground text-sm truncate">
                      {inv.invoice_number || inv.file_name || "Χωρίς αριθμό"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{inv.supplier || "Άγνωστος"}</p>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center justify-between gap-2 pl-12 md:pl-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {inv.amount != null && (
                      <span className="text-sm font-medium text-card-foreground whitespace-nowrap">
                        {inv.amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {inv.currency || "€"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-[11px] font-medium text-warning">
                      <Clock className="h-3 w-3" />
                      Αναμονή
                    </span>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedInvoice(inv)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => approveMutation.mutate({ id: inv.id, approved: true })}
                      disabled={approveMutation.isPending}
                      title="Έγκριση"
                    >
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
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
