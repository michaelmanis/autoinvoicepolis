import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, FileText, Clock, Eye,
  ChevronDown, ChevronRight, FolderOpen, Folder, Euro, Download,
} from "lucide-react";
import InvoiceDetail from "@/components/InvoiceDetail";
import { useAccountantFolderInvoices, useAccountantMutation } from "@/hooks/useInvoices";
import { getMonthKey, formatMonthKey, type Invoice } from "@/types/invoice";
import * as XLSX from "xlsx";

const STATUS_BADGE = {
  accountant_approved: (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
      <CheckCircle2 className="h-3 w-3" />
      Διασταυρώθηκε
    </span>
  ),
  accountant_pending: (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
      <Clock className="h-3 w-3" />
      Αναμονή Ελέγχου
    </span>
  ),
} as const;

const INVALIDATE_KEYS = [
  ["accountant-folder-invoices"],
  ["accountant-invoices"],
  ["invoices"],
];

function exportToExcel(monthKey: string, invoices: Invoice[]) {
  const rows = invoices.map((inv) => {
    // Συνένωση περιγραφών ειδών σε ένα string
    const itemDescriptions = Array.isArray(inv.items)
      ? (inv.items as any[]).map((item: any) => item.description).filter(Boolean).join(" | ")
      : "";
    return {
      "Αριθμός Τιμολογίου": inv.invoice_number ?? "",
      "Προμηθευτής":        inv.supplier ?? "",
      "ΑΦΜ Προμηθευτή":    inv.supplier_vat ?? "",
      "Περιγραφή Ειδών":    itemDescriptions,
      "Ημερομηνία":         inv.invoice_date
        ? new Date(inv.invoice_date).toLocaleDateString("el-GR")
        : "",
      "Λήξη":               inv.due_date
        ? new Date(inv.due_date).toLocaleDateString("el-GR")
        : "",
      "Ποσό":               inv.amount ?? "",
      "Νόμισμα":            inv.currency ?? "EUR",
      "Κατάσταση":          inv.status === "accountant_approved" ? "Διασταυρώθηκε" : "Αναμονή Ελέγχου",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 40 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, formatMonthKey(monthKey));
  XLSX.writeFile(wb, `Φάκελος_Λογιστή_${monthKey}.xlsx`);
}

export default function AccountantFolderPage() {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const { data: invoices, isLoading } = useAccountantFolderInvoices();
  const approveMutation = useAccountantMutation(INVALIDATE_KEYS);

  const toggleFolder = (key: string) =>
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

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

  // Group by month
  const grouped = (invoices ?? []).reduce<Record<string, Invoice[]>>((acc, inv) => {
    const key = getMonthKey(inv);
    (acc[key] ??= []).push(inv);
    return acc;
  }, {});
  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

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
            const pending  = monthInvoices.filter((i) => i.status === "accountant_pending").length;
            const approved = monthInvoices.filter((i) => i.status === "accountant_approved").length;
            const totalAmount = monthInvoices.reduce((s, i) => s + (i.amount ?? 0), 0);

            return (
              <div key={monthKey} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                {/* Month header row */}
                <div className="flex w-full items-center gap-3 px-5 py-4">
                  <button
                    className="flex flex-1 items-center gap-3 text-left hover:opacity-80 transition-opacity"
                    onClick={() => toggleFolder(monthKey)}
                  >
                    {isOpen
                      ? <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                      : <Folder className="h-5 w-5 text-primary/70 shrink-0" />
                    }
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
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </button>

                  {/* Export button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-xs"
                    onClick={() => exportToExcel(monthKey, monthInvoices)}
                    title={`Export ${formatMonthKey(monthKey)} σε Excel`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Excel
                  </Button>
                </div>

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
                          {STATUS_BADGE[inv.status as keyof typeof STATUS_BADGE]}
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedInvoice(inv)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {inv.status === "accountant_pending" && (
                              <>
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
