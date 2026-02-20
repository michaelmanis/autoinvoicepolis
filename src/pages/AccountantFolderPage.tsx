import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Eye,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  Euro,
} from "lucide-react";
import InvoiceDetail from "@/components/InvoiceDetail";

type Invoice = {
  id: string;
  supplier: string | null;
  supplier_vat: string | null;
  amount: number | null;
  currency: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  items: any;
  raw_ocr_text: string | null;
  status: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
};

const MONTH_NAMES: Record<string, string> = {
  "01": "Ιανουάριος", "02": "Φεβρουάριος", "03": "Μάρτιος",
  "04": "Απρίλιος", "05": "Μάιος", "06": "Ιούνιος",
  "07": "Ιούλιος", "08": "Αύγουστος", "09": "Σεπτέμβριος",
  "10": "Οκτώβριος", "11": "Νοέμβριος", "12": "Δεκέμβριος",
};

function getMonthKey(invoice: Invoice): string {
  const d = invoice.invoice_date || invoice.created_at;
  if (!d) return "Χωρίς ημερομηνία";
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthKey(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[month] || month} ${year}`;
}

export default function AccountantFolderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["accountant-folder-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .in("status", ["accountant_pending", "accountant_approved"])
        .order("invoice_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      if (approved) {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await supabase.functions.invoke("archive-invoice", {
          body: { invoice_id: id },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        if (resp.error) throw resp.error;
        return { approved, monthFolder: resp.data?.month_folder };
      } else {
        const { error } = await supabase
          .from("invoices")
          .update({ status: "draft" })
          .eq("id", id);
        if (error) throw error;
        return { approved };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["accountant-folder-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["accountant-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
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

  const toggleFolder = (key: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (selectedInvoice) {
    return (
      <InvoiceDetail
        invoice={selectedInvoice}
        onBack={() => {
          setSelectedInvoice(null);
          queryClient.invalidateQueries({ queryKey: ["accountant-folder-invoices"] });
        }}
        isAccountant
      />
    );
  }

  // Group invoices by month
  const grouped: Record<string, Invoice[]> = {};
  for (const inv of invoices ?? []) {
    const key = getMonthKey(inv);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(inv);
  }

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const statusBadge = (status: string) => {
    if (status === "accountant_approved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
          <CheckCircle2 className="h-3 w-3" />
          Εγκρίθηκε
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
        <Clock className="h-3 w-3" />
        Αναμονή Ελέγχου
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Φάκελος Λογιστή</h2>
        <p className="text-sm text-muted-foreground">
          Τιμολόγια που έχουν σταλεί στο ERP, οργανωμένα ανά μήνα
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : sortedKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 gap-3">
          <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">Δεν υπάρχουν τιμολόγια για έλεγχο</p>
          <p className="text-sm text-muted-foreground/70">
            Τα τιμολόγια εμφανίζονται εδώ μετά την αποστολή στο ERP
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedKeys.map((monthKey) => {
            const monthInvoices = grouped[monthKey];
            const isOpen = openFolders.has(monthKey);
            const pending = monthInvoices.filter((i) => i.status === "accountant_pending").length;
            const approved = monthInvoices.filter((i) => i.status === "accountant_approved").length;
            const totalAmount = monthInvoices.reduce((s, i) => s + (i.amount ?? 0), 0);

            return (
              <div key={monthKey} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                {/* Folder header */}
                <button
                  className="flex w-full items-center gap-3 px-5 py-4 hover:bg-secondary/40 transition-colors text-left"
                  onClick={() => toggleFolder(monthKey)}
                >
                  {isOpen ? (
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <Folder className="h-5 w-5 text-primary/70 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-card-foreground">{formatMonthKey(monthKey)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {monthInvoices.length} τιμολόγια
                      {pending > 0 && ` · ${pending} σε αναμονή`}
                      {approved > 0 && ` · ${approved} εγκεκριμένα`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {totalAmount > 0 && (
                      <span className="text-sm font-medium text-card-foreground flex items-center gap-1">
                        <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                        {totalAmount.toLocaleString("el-GR", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    {pending > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-bold">
                        {pending}
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Invoice list */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {monthInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-card-foreground">
                              {inv.invoice_number || inv.file_name || "Χωρίς αριθμό"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {inv.supplier || "Άγνωστος προμηθευτής"}
                              {inv.invoice_date && ` · ${new Date(inv.invoice_date).toLocaleDateString("el-GR")}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {inv.amount != null && (
                            <span className="text-sm font-medium text-card-foreground">
                              {inv.amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {inv.currency || "€"}
                            </span>
                          )}
                          {statusBadge(inv.status)}
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedInvoice(inv)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {inv.status === "accountant_pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => approveMutation.mutate({ id: inv.id, approved: true })}
                                  disabled={approveMutation.isPending}
                                  title="Έγκριση"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => approveMutation.mutate({ id: inv.id, approved: false })}
                                  disabled={approveMutation.isPending}
                                  title="Απόρριψη"
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
