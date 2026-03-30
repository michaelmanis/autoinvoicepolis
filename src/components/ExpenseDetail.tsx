/**
 * ExpenseDetail — Full workflow detail view for expenses,
 * mirroring InvoiceDetail with approve/ERP/accountant flow.
 */

import { useState, useCallback } from "react";
import {
  ArrowLeft, Save, Loader2, CheckCircle2, Database, FileText,
  ExternalLink, ChevronLeft, ChevronRight, UserCheck, FolderCheck,
  History, Clock, MessageSquare, ZoomIn, ZoomOut, FolderOpen,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_STATUS_CONFIG, formatAmount } from "@/types/expense";
import { useExpenseActions, useLogExpenseAction, EXPENSE_ACTION_LABELS } from "@/hooks/useExpenseActions";
import type { Expense } from "@/types/expense";
import { EXPENSE_DOCUMENT_TYPES } from "@/types/expenseDocumentTypes";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── File Preview ─────────────────────────────────────────────────────────────

function FilePreview({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  }, []);

  const isPdf = fileName.toLowerCase().endsWith(".pdf");
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(fileName);

  const handleOpen = async () => {
    const newWindow = window.open("", "_blank");
    if (!newWindow) return;
    newWindow.document.write("<html><body style='margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666'>Φόρτωση αρχείου…</body></html>");
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      newWindow.location.href = blobUrl;
    } catch {
      newWindow.location.href = fileUrl;
    }
  };

  if (!isPdf && !isImage) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
        <FileText className="h-12 w-12 opacity-30" />
        <p className="text-sm">Δεν υπάρχει διαθέσιμη προεπισκόπηση αρχείου</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-medium text-card-foreground text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {fileName || "Αρχείο Δαπάνης"}
        </h3>
        <div className="flex items-center gap-2">
          {isPdf && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} disabled={scale <= 0.5}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[3ch] text-center">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale((s) => Math.min(2, s + 0.2))} disabled={scale >= 2}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleOpen}>
            <ExternalLink className="h-3 w-3" />
            Άνοιγμα
          </Button>
        </div>
      </div>

      {isPdf ? (
        <div className="flex flex-col items-center bg-muted/30 overflow-auto max-h-[75vh]">
          <Document
            file={fileUrl}
            onLoadSuccess={onLoadSuccess}
            loading={
              <div className="flex items-center justify-center min-h-[500px] gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Φόρτωση PDF…</span>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">Αδυναμία φόρτωσης PDF.</p>
                <Button onClick={handleOpen} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Άνοιγμα σε νέα καρτέλα
                </Button>
              </div>
            }
          >
            <Page pageNumber={pageNumber} scale={scale} renderTextLayer renderAnnotationLayer />
          </Document>
          {numPages > 1 && (
            <div className="flex items-center gap-3 py-3 border-t border-border w-full justify-center sticky bottom-0 bg-card/90 backdrop-blur-sm">
              <Button variant="ghost" size="icon" onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{pageNumber} / {numPages}</span>
              <Button variant="ghost" size="icon" onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center bg-muted/30 p-4 min-h-[400px] max-h-[75vh] overflow-auto">
          <img src={fileUrl} alt="Expense" className="max-w-full object-contain rounded cursor-pointer" onClick={handleOpen} />
        </div>
      )}
    </div>
  );
}

// ─── Audit Timeline ───────────────────────────────────────────────────────────

function AuditTimeline({ expenseId }: { expenseId: string }) {
  const { data: actions = [], isLoading } = useExpenseActions(expenseId);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-medium text-card-foreground mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Ιστορικό Ενεργειών
        </h3>
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-medium text-card-foreground mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        Ιστορικό Ενεργειών
        {actions.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{actions.length} ενέργειες</span>
        )}
      </h3>
      {actions.length === 0 ? (
        <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground/50">
          <Clock className="h-8 w-8" />
          <p className="text-xs">Δεν υπάρχουν καταγεγραμμένες ενέργειες</p>
        </div>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-4">
          {actions.map((a) => {
            const cfg = EXPENSE_ACTION_LABELS[a.action] ?? { label: a.action, color: "text-muted-foreground" };
            return (
              <li key={a.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-card" />
                <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.user_email ?? "Σύστημα"}
                  {" · "}
                  {new Date(a.created_at).toLocaleString("el-GR", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ─── Form State ───────────────────────────────────────────────────────────────

type FormState = {
  supplier: string;
  supplier_vat: string;
  expense_number: string;
  expense_date: string;
  due_date: string;
  amount: string;
  currency: string;
  description: string;
  notes: string;
  status: string;
  project_id: string;
  document_type: string;
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExpenseDetailProps {
  expense: Expense;
  onBack: () => void;
  isAccountant?: boolean;
}

export default function ExpenseDetail({ expense, onBack, isAccountant = false }: ExpenseDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logAction = useLogExpenseAction();

  const [form, setForm] = useState<FormState>({
    supplier: expense.supplier || "",
    supplier_vat: expense.supplier_vat || "",
    expense_number: expense.expense_number || "",
    expense_date: expense.expense_date || "",
    due_date: expense.due_date || "",
    amount: expense.amount?.toString() || "",
    currency: expense.currency || "EUR",
    description: expense.description || "",
    notes: expense.notes || "",
    status: expense.status,
    project_id: expense.project_id || "",
    document_type: expense.document_type || "",
  });

  const patchForm = (updates: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...updates }));

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("expenses")
        .update({
          supplier: form.supplier || null,
          supplier_vat: form.supplier_vat || null,
          expense_number: form.expense_number || null,
          expense_date: form.expense_date || null,
          due_date: form.due_date || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          currency: form.currency || "EUR",
          description: form.description || null,
          notes: form.notes || null,
          status: form.status,
          project_id: form.project_id || null,
          document_type: form.document_type || null,
        })
        .eq("id", expense.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Αποθηκεύτηκε!" });
    },
    onError: (err: any) => {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    },
  });

  const handleApprove = async () => {
    const updated = { ...form, status: "approved" };
    patchForm({ status: "approved" });
    saveMutation.mutate();
    await supabase.from("expenses").update({ status: "approved" }).eq("id", expense.id);
    await logAction.mutateAsync({ expenseId: expense.id, action: "user_approved" });
  };

  const [erpSending, setErpSending] = useState(false);
  const handleSendToERP = async () => {
    setErpSending(true);
    try {
      // First update status to accountant_pending
      const { error } = await supabase
        .from("expenses")
        .update({ status: "accountant_pending" })
        .eq("id", expense.id);
      if (error) throw error;

      patchForm({ status: "accountant_pending" });
      toast({
        title: "Στάλθηκε στο ERP!",
        description: "Αναμένει επιβεβαίωση λογιστή.",
      });
      await logAction.mutateAsync({ expenseId: expense.id, action: "sent_to_erp" });
    } catch (err: any) {
      toast({ title: "Σφάλμα ERP", description: err.message, variant: "destructive" });
    } finally {
      setErpSending(false);
    }
  };

  const [archiving, setArchiving] = useState(false);
  const handleAccountantApprove = async () => {
    setArchiving(true);
    try {
      const { error } = await supabase
        .from("expenses")
        .update({ status: "accountant_approved" })
        .eq("id", expense.id);
      if (error) throw error;

      patchForm({ status: "accountant_approved" });
      toast({ title: "✅ Εγκρίθηκε!" });
      await logAction.mutateAsync({ expenseId: expense.id, action: "accountant_approved" });
    } catch (err: any) {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  };

  const isBusy = saveMutation.isPending || erpSending || archiving;
  const cfg = EXPENSE_STATUS_CONFIG[form.status] || EXPENSE_STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">
            {form.expense_number || "Νέα Δαπάνη"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAccountant ? "Επιβεβαίωση Λογιστή" : "Επεξεργασία & Έλεγχος"}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <Badge variant="outline" className={cfg.className}>
            <StatusIcon className="mr-1 h-3 w-3" />{cfg.label}
          </Badge>

          {!isAccountant && (
            <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={isBusy}>
              <Save className="mr-2 h-4 w-4" />
              Αποθήκευση
            </Button>
          )}
          {!isAccountant && form.status === "draft" && (
            <Button onClick={handleApprove} disabled={isBusy}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Έγκριση
            </Button>
          )}
          {!isAccountant && form.status === "approved" && (
            <Button onClick={handleSendToERP} disabled={isBusy} className="bg-success hover:bg-success/90 text-success-foreground">
              {erpSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Αποστολή σε ERP
            </Button>
          )}
          {form.status === "accountant_pending" && (
            <Button onClick={handleAccountantApprove} disabled={isBusy} className="bg-success hover:bg-success/90 text-success-foreground">
              {archiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderCheck className="mr-2 h-4 w-4" />}
              Έγκριση & Αρχειοθέτηση
            </Button>
          )}
          {form.status === "accountant_approved" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success">
              <UserCheck className="h-4 w-4" />
              Εγκρίθηκε από Λογιστή
            </span>
          )}
          {form.status === "submitted" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Καταχωρήθηκε στο ERP
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: File Preview + Audit */}
        <div className="flex flex-col gap-4">
          {expense.file_url ? (
            <FilePreview fileUrl={expense.file_url} fileName={expense.file_name ?? ""} />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">Δεν υπάρχει διαθέσιμη προεπισκόπηση αρχείου</p>
            </div>
          )}
          <AuditTimeline expenseId={expense.id} />
        </div>

        {/* Right: Form */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-medium text-card-foreground mb-4">Στοιχεία Δαπάνης</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Τύπος Παραστατικού <span className="text-destructive">*</span></Label>
                <Select
                  value={form.document_type || "none"}
                  onValueChange={(v) => patchForm({ document_type: v === "none" ? "" : v })}
                  disabled={isAccountant}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε τύπο..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">— Χωρίς τύπο —</SelectItem>
                    {EXPENSE_DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.code} value={dt.code}>
                        <span className="font-medium">{dt.code}</span>
                        <span className="text-muted-foreground ml-2">— {dt.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Προμηθευτής <span className="text-destructive">*</span></Label>
                <Input value={form.supplier} onChange={(e) => patchForm({ supplier: e.target.value })} readOnly={isAccountant} />
              </div>
              <div className="space-y-2">
                <Label>ΑΦΜ Προμηθευτή <span className="text-destructive">*</span></Label>
                <Input value={form.supplier_vat} onChange={(e) => patchForm({ supplier_vat: e.target.value })} readOnly={isAccountant} />
              </div>
              <div className="space-y-2">
                <Label>Αρ. Παραστατικού <span className="text-destructive">*</span></Label>
                <Input value={form.expense_number} onChange={(e) => patchForm({ expense_number: e.target.value })} readOnly={isAccountant} />
              </div>
              <div className="space-y-2">
                <Label>Ποσό <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => patchForm({ amount: e.target.value })}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) patchForm({ amount: val.toFixed(2) });
                  }}
                  readOnly={isAccountant}
                />
              </div>
              <div className="space-y-2">
                <Label>Ημερομηνία <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.expense_date} onChange={(e) => patchForm({ expense_date: e.target.value })} readOnly={isAccountant} />
              </div>
              <div className="space-y-2">
                <Label>Ημ. Λήξης</Label>
                <Input type="date" value={form.due_date} onChange={(e) => patchForm({ due_date: e.target.value })} readOnly={isAccountant} />
              </div>
              <div className="space-y-2">
                <Label>Νόμισμα</Label>
                <Input value={form.currency} onChange={(e) => patchForm({ currency: e.target.value })} readOnly={isAccountant} />
              </div>

              {!isAccountant && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Project
                  </Label>
                  <Select
                    value={form.project_id || "none"}
                    onValueChange={(v) => patchForm({ project_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Χωρίς project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Χωρίς project —</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Description & Notes */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
            <div className="space-y-2">
              <Label>Περιγραφή</Label>
              <Input value={form.description} onChange={(e) => patchForm({ description: e.target.value })} readOnly={isAccountant} />
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-card-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Σχόλια
              </h3>
              <Textarea
                value={form.notes}
                onChange={(e) => patchForm({ notes: e.target.value })}
                placeholder="Προσθήκη σχολίων για αυτή τη δαπάνη…"
                className="min-h-[80px]"
                readOnly={isAccountant}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
