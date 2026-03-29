/**
 * ExpensesPage — Responsive list, upload, and manage expenses.
 * Uses card layout on mobile instead of table.
 */

import { useState } from "react";
import { Upload, Trash2, Eye, FileText, X, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useExpenses, useDeleteExpense } from "@/hooks/useExpenses";
import { useExpenseUpload } from "@/hooks/useExpenseUpload";
import { EXPENSE_STATUS_CONFIG, LOCKED_EXPENSE_STATUSES, formatAmount } from "@/types/expense";
import type { Expense } from "@/types/expense";
import ExpenseDetail from "@/components/ExpenseDetail";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_DOCUMENT_TYPES } from "@/types/expenseDocumentTypes";

// ─── Upload Dialog ────────────────────────────────────────────────────────────

function UploadDialog() {
  const { queue, isUploading, fileInputRef, addFiles, removeFromQueue, runUpload, reset } = useExpenseUpload();
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string>("");

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleClose = (v: boolean) => {
    if (!isUploading) { setOpen(v); if (!v) { reset(); setDocumentType(""); } }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm"><Upload className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Ανέβασμα Δαπάνης</span><span className="sm:hidden">Νέα</span></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg mx-4">
        <DialogHeader><DialogTitle>Ανέβασμα Δαπανών</DialogTitle></DialogHeader>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Τύπος Παραστατικού</label>
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger>
              <SelectValue placeholder="Επιλέξτε τύπο παραστατικού..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {EXPENSE_DOCUMENT_TYPES.map((dt) => (
                <SelectItem key={dt.code} value={dt.code}>
                  <span className="font-medium">{dt.code}</span>
                  <span className="text-muted-foreground ml-2">— {dt.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 md:p-8 text-center transition hover:border-primary/50"
        >
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Σύρετε αρχεία ή πατήστε για επιλογή</p>
          <p className="mt-1 text-xs text-muted-foreground/60">PDF, PNG, JPG, WebP — έως 20MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            multiple
            className="hidden"
            onChange={(e) => addFiles(Array.from(e.target.files || []))}
          />
        </div>

        {queue.length > 0 && (
          <div className="max-h-48 space-y-1 overflow-auto">
            {queue.map((item, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-muted/50 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{item.file.name}</span>
                {item.status === "pending" && (
                  <button onClick={() => removeFromQueue(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                )}
                {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {item.status === "done" && (
                  <Badge variant="outline" className="bg-success/10 text-success text-xs">✓ {item.count ?? 1}</Badge>
                )}
                {item.status === "error" && (
                  <Badge variant="destructive" className="text-xs">{item.error}</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => runUpload(documentType || undefined)} disabled={isUploading || !queue.some((q) => q.status === "pending") || !documentType}>
            {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Επεξεργασία…</> : "Έναρξη"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mobile Expense Card ──────────────────────────────────────────────────────

function ExpenseCard({ exp, onView, onDelete }: { exp: Expense; onView: (e: Expense) => void; onDelete: (id: string) => void }) {
  const cfg = EXPENSE_STATUS_CONFIG[exp.status] || EXPENSE_STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const isLocked = LOCKED_EXPENSE_STATUSES.has(exp.status);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-card-foreground text-sm truncate">{exp.supplier || "—"}</p>
        <p className="text-xs text-muted-foreground truncate">{exp.description || exp.expense_number || "—"}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {exp.amount != null && (
            <span className="text-sm font-medium text-card-foreground">
              {formatAmount(exp.amount, exp.currency || "EUR")}
            </span>
          )}
          <Badge variant="outline" className={`${cfg.className} text-[10px]`}>
            <StatusIcon className="mr-0.5 h-3 w-3" />{cfg.label}
          </Badge>
        </div>
      </div>
      <div className="flex gap-0.5 shrink-0">
        {!isLocked && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onView(exp)}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(exp.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Desktop Table Row ────────────────────────────────────────────────────────

function ExpenseRow({ exp, onView, onDelete }: { exp: Expense; onView: (e: Expense) => void; onDelete: (id: string) => void }) {
  const cfg = EXPENSE_STATUS_CONFIG[exp.status] || EXPENSE_STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const isLocked = LOCKED_EXPENSE_STATUSES.has(exp.status);

  return (
    <TableRow>
      <TableCell className="font-medium">{exp.supplier || "—"}</TableCell>
      <TableCell>{exp.description || "—"}</TableCell>
      <TableCell>{exp.expense_number || "—"}</TableCell>
      <TableCell>{exp.expense_date || "—"}</TableCell>
      <TableCell className="text-right font-mono">
        {exp.amount != null ? formatAmount(exp.amount, exp.currency || "EUR") : "—"}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cfg.className}>
          <StatusIcon className="mr-1 h-3 w-3" />{cfg.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {!isLocked && (
            <Button size="icon" variant="ghost" onClick={() => onView(exp)}>
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => onDelete(exp.id)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const deleteMutation = useDeleteExpense();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const { toast } = useToast();

  const exportToExcel = () => {
    if (!expenses?.length) return;
    const rows = expenses.map((e) => ({
      "Προμηθευτής": e.supplier || "",
      "ΑΦΜ Προμηθευτή": e.supplier_vat || "",
      "Περιγραφή": e.description || "",
      "Αρ. Παραστατικού": e.expense_number || "",
      "Ημερομηνία": e.expense_date || "",
      "Ημ. Λήξης": e.due_date || "",
      "Ποσό": e.amount ?? "",
      "Νόμισμα": e.currency || "EUR",
      "Κατάσταση": EXPENSE_STATUS_CONFIG[e.status]?.label || e.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `expenses_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Εξαγωγή ολοκληρώθηκε" });
  };

  if (selectedExpense) {
    return <ExpenseDetail expense={selectedExpense} onBack={() => setSelectedExpense(null)} />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base md:text-2xl font-bold text-foreground">Δαπάνες</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!expenses?.length}>
            <Download className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Excel</span>
          </Button>
          <UploadDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !expenses?.length ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 py-12 md:py-16 text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Δεν υπάρχουν δαπάνες</p>
          <p className="mt-1 text-sm text-muted-foreground/60">Ανεβάστε αποδείξεις για να ξεκινήσετε</p>
        </div>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="space-y-2 md:hidden">
            {expenses.map((exp) => (
              <ExpenseCard
                key={exp.id}
                exp={exp}
                onView={setSelectedExpense}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Προμηθευτής</TableHead>
                  <TableHead>Περιγραφή</TableHead>
                  <TableHead>Αρ. Παραστ.</TableHead>
                  <TableHead>Ημερομηνία</TableHead>
                  <TableHead className="text-right">Ποσό</TableHead>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead className="w-24">Ενέργειες</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((exp) => (
                  <ExpenseRow
                    key={exp.id}
                    exp={exp}
                    onView={setSelectedExpense}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
