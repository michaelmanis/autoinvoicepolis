import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2, XCircle, FileText, Clock, Eye, Undo2,
  ChevronDown, ChevronRight, FolderOpen, Folder, Euro, Download, Receipt,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InvoiceDetail from "@/components/InvoiceDetail";
import ExpenseDetail from "@/components/ExpenseDetail";
import { useAccountantFolderInvoices, useAccountantMutation } from "@/hooks/useInvoices";
import { useAccountantFolderExpenses, useAccountantExpenseMutation } from "@/hooks/useExpenses";
import { getMonthKey, formatMonthKey, type Invoice } from "@/types/invoice";
import { getExpenseMonthKey, type Expense } from "@/types/expense";
import { formatMonthKey as formatMonthKeyInv } from "@/types/invoice";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  ["accountant-folder-expenses"],
  ["accountant-invoices"],
  ["invoices"],
  ["expenses"],
];

function exportInvoicesToExcel(monthKey: string, invoices: Invoice[]) {
  const rows = invoices.map((inv) => {
    const itemDescriptions = Array.isArray(inv.items)
      ? (inv.items as any[]).map((item: any) => item.description).filter(Boolean).join(" | ")
      : "";
    return {
      "Αριθμός Τιμολογίου": inv.invoice_number ?? "",
      "Προμηθευτής": inv.supplier ?? "",
      "ΑΦΜ Προμηθευτή": inv.supplier_vat ?? "",
      "Περιγραφή Ειδών": itemDescriptions,
      "Ημερομηνία": inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("el-GR") : "",
      "Λήξη": inv.due_date ? new Date(inv.due_date).toLocaleDateString("el-GR") : "",
      "Ποσό": inv.amount ?? "",
      "Νόμισμα": inv.currency ?? "EUR",
      "Κατάσταση": inv.status === "accountant_approved" ? "Διασταυρώθηκε" : "Αναμονή Ελέγχου",
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, formatMonthKey(monthKey));
  XLSX.writeFile(wb, `Φάκελος_Λογιστή_Τιμολόγια_${monthKey}.xlsx`);
}

function exportExpensesToExcel(monthKey: string, expenses: Expense[]) {
  const rows = expenses.map((e) => ({
    "Αρ. Παραστατικού": e.expense_number ?? "",
    "Προμηθευτής": e.supplier ?? "",
    "ΑΦΜ Προμηθευτή": e.supplier_vat ?? "",
    "Περιγραφή": e.description ?? "",
    "Ημερομηνία": e.expense_date ? new Date(e.expense_date).toLocaleDateString("el-GR") : "",
    "Ποσό": e.amount ?? "",
    "Νόμισμα": e.currency ?? "EUR",
    "Κατάσταση": e.status === "accountant_approved" ? "Διασταυρώθηκε" : "Αναμονή Ελέγχου",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, formatMonthKey(monthKey));
  XLSX.writeFile(wb, `Φάκελος_Λογιστή_Δαπάνες_${monthKey}.xlsx`);
}

// ─── Generic folder list ──────────────────────────────────────────────────────

type FolderItem = {
  id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  label: string;
  sublabel: string;
  date: string | null;
  file_url: string | null;
  file_name: string | null;
};

async function downloadMonthZip(monthKey: string, items: FolderItem[], prefix: string) {
  const filesWithUrl = items.filter((i) => i.file_url);
  if (filesWithUrl.length === 0) {
    toast.error("Δεν υπάρχουν αρχεία για λήψη");
    return;
  }
  toast.info(`Προετοιμασία ${filesWithUrl.length} αρχείων…`);
  const zip = new JSZip();
  const seen = new Set<string>();

  for (const item of filesWithUrl) {
    try {
      const { data, error } = await supabase.functions.invoke("proxy-file", {
        body: { file_path: item.file_url },
      });
      if (error || !data) continue;
      // data is already a Blob from invoke
      let name = item.file_name || item.file_url!.split("/").pop() || `${item.id}.pdf`;
      // deduplicate names
      if (seen.has(name)) {
        const ext = name.includes(".") ? "." + name.split(".").pop() : "";
        const base = name.replace(ext, "");
        name = `${base}_${item.id.slice(0, 6)}${ext}`;
      }
      seen.add(name);
      zip.file(name, data);
    } catch {
      // skip failed files
    }
  }

  if (Object.keys(zip.files).length === 0) {
    toast.error("Αποτυχία λήψης αρχείων");
    return;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${prefix}_${monthKey}.zip`);
  toast.success("Το ZIP κατέβηκε επιτυχώς");
}

function FolderList({
  items,
  groupByMonth,
  onView,
  onApprove,
  onReject,
  isPending,
  exportFn,
  emptyLabel,
}: {
  items: FolderItem[];
  groupByMonth: (item: FolderItem) => string;
  onView: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
  exportFn: (monthKey: string, items: FolderItem[]) => void;
  emptyLabel: string;
}) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (key: string) =>
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const grouped = items.reduce<Record<string, FolderItem[]>>((acc, item) => {
    const key = groupByMonth(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (sortedKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 gap-3">
        <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedKeys.map((monthKey) => {
        const monthItems = grouped[monthKey];
        const isOpen = openFolders.has(monthKey);
        const pending = monthItems.filter((i) => i.status === "accountant_pending").length;
        const approved = monthItems.filter((i) => i.status === "accountant_approved").length;
        const totalAmount = monthItems.reduce((s, i) => s + (i.amount ?? 0), 0);

        return (
          <div key={monthKey} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="flex w-full items-center gap-3 px-5 py-4">
              <button
                className="flex flex-1 items-center gap-3 text-left hover:opacity-80 transition-opacity"
                onClick={() => toggleFolder(monthKey)}
              >
                {isOpen ? <FolderOpen className="h-5 w-5 text-primary shrink-0" /> : <Folder className="h-5 w-5 text-primary/70 shrink-0" />}
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">{formatMonthKey(monthKey)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {monthItems.length} εγγραφές
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
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              <Button
                variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs"
                onClick={() => exportFn(monthKey, monthItems)}
              >
                <Download className="h-3.5 w-3.5" />
                Excel
              </Button>
            </div>

            {isOpen && (
              <div className="border-t border-border divide-y divide-border">
                {monthItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.amount != null && (
                        <span className="text-sm font-medium text-card-foreground">
                          {item.amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {item.currency || "€"}
                        </span>
                      )}
                      {STATUS_BADGE[item.status as keyof typeof STATUS_BADGE]}
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(item.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {item.status === "accountant_pending" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onApprove(item.id)} disabled={isPending} title="Έγκριση">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onReject(item.id)} disabled={isPending} title="Απόρριψη">
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {item.status === "accountant_approved" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onReject(item.id)} disabled={isPending} title="Αναίρεση">
                            <Undo2 className="h-4 w-4 text-warning" />
                          </Button>
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
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountantFolderPage() {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; approved: boolean; type: "invoice" | "expense" } | null>(null);

  const { data: invoices, isLoading: loadingInv } = useAccountantFolderInvoices();
  const { data: expenses, isLoading: loadingExp } = useAccountantFolderExpenses();
  const invoiceMutation = useAccountantMutation(INVALIDATE_KEYS);
  const expenseMutation = useAccountantExpenseMutation(INVALIDATE_KEYS);

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

  if (selectedExpense) {
    return (
      <ExpenseDetail
        expense={selectedExpense}
        onBack={() => {
          setSelectedExpense(null);
          queryClient.invalidateQueries({ queryKey: ["accountant-folder-expenses"] });
        }}
        isAccountant
      />
    );
  }

  const invoiceItems: FolderItem[] = (invoices ?? []).map((inv) => ({
    id: inv.id,
    status: inv.status,
    amount: inv.amount,
    currency: inv.currency,
    label: inv.invoice_number || inv.file_name || "Χωρίς αριθμό",
    sublabel: `${inv.supplier || "Άγνωστος"} ${inv.invoice_date ? `· ${new Date(inv.invoice_date).toLocaleDateString("el-GR")}` : ""}`,
    date: inv.invoice_date || inv.created_at,
    file_url: inv.file_url,
    file_name: inv.file_name,
  }));

  const expenseItems: FolderItem[] = (expenses ?? []).map((exp) => ({
    id: exp.id,
    status: exp.status,
    amount: exp.amount,
    currency: exp.currency,
    label: exp.expense_number || exp.file_name || "Χωρίς αριθμό",
    sublabel: `${exp.supplier || "Άγνωστος"} ${exp.expense_date ? `· ${new Date(exp.expense_date).toLocaleDateString("el-GR")}` : ""}`,
    date: exp.expense_date || exp.created_at,
    file_url: exp.file_url,
    file_name: exp.file_name,
  }));

  const getMonth = (item: FolderItem) => {
    if (!item.date) return "unknown";
    const d = new Date(item.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const isLoading = loadingInv || loadingExp;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Φάκελος Λογιστή</h2>
        <p className="text-sm text-muted-foreground">
          Τιμολόγια & δαπάνες που έχουν σταλεί στο ERP, οργανωμένα ανά μήνα
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Τιμολόγια ({invoiceItems.length})
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <Receipt className="h-4 w-4" />
              Δαπάνες ({expenseItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <FolderList
              items={invoiceItems}
              groupByMonth={getMonth}
              onView={(id) => setSelectedInvoice(invoices!.find((i) => i.id === id)!)}
              onApprove={(id) => setConfirmAction({ id, approved: true, type: "invoice" })}
              onReject={(id) => setConfirmAction({ id, approved: false, type: "invoice" })}
              isPending={invoiceMutation.isPending}
              exportFn={(mk, items) => {
                const invs = items.map((it) => invoices!.find((i) => i.id === it.id)!);
                exportInvoicesToExcel(mk, invs);
              }}
              emptyLabel="Δεν υπάρχουν τιμολόγια για έλεγχο"
            />
          </TabsContent>

          <TabsContent value="expenses">
            <FolderList
              items={expenseItems}
              groupByMonth={getMonth}
              onView={(id) => setSelectedExpense(expenses!.find((e) => e.id === id)!)}
              onApprove={(id) => setConfirmAction({ id, approved: true, type: "expense" })}
              onReject={(id) => setConfirmAction({ id, approved: false, type: "expense" })}
              isPending={expenseMutation.isPending}
              exportFn={(mk, items) => {
                const exps = items.map((it) => expenses!.find((e) => e.id === it.id)!);
                exportExpensesToExcel(mk, exps);
              }}
              emptyLabel="Δεν υπάρχουν δαπάνες για έλεγχο"
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.approved ? "Επιβεβαίωση Έγκρισης" : "Επιβεβαίωση Απόρριψης / Αναίρεσης"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.approved
                ? `Είστε σίγουροι ότι θέλετε να εγκρίνετε ${confirmAction.type === "invoice" ? "αυτό το τιμολόγιο" : "αυτή τη δαπάνη"};`
                : `${confirmAction?.type === "invoice" ? "Το τιμολόγιο" : "Η δαπάνη"} θα επιστρέψει σε κατάσταση αναμονής ελέγχου.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  const mutation = confirmAction.type === "invoice" ? invoiceMutation : expenseMutation;
                  mutation.mutate({ id: confirmAction.id, approved: confirmAction.approved });
                  setConfirmAction(null);
                }
              }}
            >
              {confirmAction?.approved ? "Έγκριση" : "Συνέχεια"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
