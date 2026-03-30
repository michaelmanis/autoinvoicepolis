import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Save, CheckCircle2, Database, Loader2, FileText,
  ExternalLink, ChevronLeft, ChevronRight, UserCheck, FolderOpen, FolderCheck,
  History, Clock, Plus, Trash2, MessageSquare, ZoomIn, ZoomOut,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { Invoice } from "@/types/invoice";
import { useInvoiceActions, useLogInvoiceAction, ACTION_LABELS } from "@/hooks/useInvoiceActions";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Extract the storage path from a signed Supabase URL */
function extractStoragePath(url: string): string {
  try {
    const u = new URL(url);
    // Pattern: /storage/v1/object/sign/invoices/<path>?token=...
    const match = u.pathname.match(/\/storage\/v1\/object\/sign\/invoices\/(.+)/);
    if (match) return decodeURIComponent(match[1]);
    // Pattern: /storage/v1/object/public/invoices/<path>
    const pubMatch = u.pathname.match(/\/storage\/v1\/object\/public\/invoices\/(.+)/);
    if (pubMatch) return decodeURIComponent(pubMatch[1]);
    return url;
  } catch {
    return url;
  }
}

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
    // Open window synchronously to avoid popup blocker
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
          {fileName || "Αρχείο Τιμολογίου"}
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleOpen}
          >
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
          <img src={fileUrl} alt="Invoice" className="max-w-full object-contain rounded cursor-pointer" onClick={handleOpen} />
        </div>
      )}
    </div>
  );
}

type FormState = {
  supplier: string;
  supplier_vat: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  currency: string;
  status: string;
  project_id: string;
  document_type: string;
};

function InvoiceFormFields({
  form,
  onChange,
  isAccountant,
  projects,
}: {
  form: FormState;
  onChange: (updates: Partial<FormState>) => void;
  isAccountant: boolean;
  projects: { id: string; name: string }[];
}) {
  const field = (label: string, key: keyof FormState, type = "text") => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={form[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
        readOnly={isAccountant}
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <h3 className="font-medium text-card-foreground mb-4">Στοιχεία Τιμολογίου</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Τύπος Παραστατικού <span className="text-destructive">*</span></Label>
          <Select
            value={form.document_type || "none"}
            onValueChange={(v) => onChange({ document_type: v === "none" ? "" : v })}
            disabled={isAccountant}
          >
            <SelectTrigger>
              <SelectValue placeholder="Επιλέξτε τύπο..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="none">— Χωρίς τύπο —</SelectItem>
              {DOCUMENT_TYPES.map((dt) => (
                <SelectItem key={dt.code} value={dt.code}>
                  <span className="font-medium">{dt.code}</span>
                  <span className="text-muted-foreground ml-2">— {dt.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field("Προμηθευτής", "supplier")}
        {field("ΑΦΜ Προμηθευτή", "supplier_vat")}
        {field("Αριθμός Τιμολογίου", "invoice_number")}
        {field("Ποσό", "amount", "number")}
        {field("Ημ. Τιμολογίου", "invoice_date", "date")}
        {field("Ημ. Λήξης", "due_date", "date")}

        {!isAccountant && (
          <div className="space-y-2 sm:col-span-2">
            <Label className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Project
            </Label>
            <Select
              value={form.project_id || "none"}
              onValueChange={(v) => onChange({ project_id: v === "none" ? "" : v })}
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

        {isAccountant && form.project_id && (
          <div className="space-y-2 sm:col-span-2">
            <Label className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Project
            </Label>
            <p className="text-sm text-card-foreground font-medium">
              {projects.find((p) => p.id === form.project_id)?.name ?? "—"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Audit Timeline ───────────────────────────────────────────────────────────

function AuditTimeline({ invoiceId }: { invoiceId: string }) {
  const { data: actions = [], isLoading } = useInvoiceActions(invoiceId);

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
            const cfg = ACTION_LABELS[a.action] ?? { label: a.action, color: "text-muted-foreground" };
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

// ─── Main component ───────────────────────────────────────────────────────────

interface InvoiceDetailProps {
  invoice: Invoice;
  onBack: () => void;
  isAccountant?: boolean;
}

export default function InvoiceDetail({ invoice, onBack, isAccountant = false }: InvoiceDetailProps) {
  const { toast } = useToast();
  const logAction = useLogInvoiceAction();

  const [form, setForm] = useState<FormState>({
    supplier: invoice.supplier ?? "",
    supplier_vat: invoice.supplier_vat ?? "",
    invoice_number: invoice.invoice_number ?? "",
    invoice_date: invoice.invoice_date ?? "",
    due_date: invoice.due_date ?? "",
    amount: invoice.amount?.toString() ?? "",
    currency: invoice.currency ?? "EUR",
    status: invoice.status ?? "draft",
    project_id: invoice.project_id ?? "",
    document_type: (invoice as any).document_type ?? "",
  });

  const patchForm = (updates: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...updates }));

  const [items, setItems] = useState<any[]>(
    Array.isArray(invoice.items) ? invoice.items : []
  );
  const [notes, setNotes] = useState(
    (invoice as any).notes ?? ""
  );

  const updateItem = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const updated = prev.map((it, i) => {
        if (i !== index) return it;
        const patched = { ...it, [field]: value };
        // Auto-calc total when qty or unit_price changes
        if (field === "quantity" || field === "unit_price") {
          patched.total = parseFloat(((patched.quantity || 0) * (patched.unit_price || 0)).toFixed(2));
        }
        return patched;
      });
      // Auto-sum all item totals into form amount
      const sum = updated.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
      patchForm({ amount: sum > 0 ? sum.toFixed(2) : "" });
      return updated;
    });
  };
  const removeItem = (index: number) => {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      const sum = updated.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
      patchForm({ amount: sum > 0 ? sum.toFixed(2) : "" });
      return updated;
    });
  };
  const addItem = () => {
    setItems((prev) => [...prev, { product_id: "", description: "", quantity: 0, unit_price: 0, total: 0 }]);
  };

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          supplier: data.supplier || null,
          supplier_vat: data.supplier_vat || null,
          invoice_number: data.invoice_number || null,
          invoice_date: data.invoice_date || null,
          due_date: data.due_date || null,
          amount: data.amount ? parseFloat(data.amount) : null,
          currency: data.currency,
          status: data.status,
           project_id: data.project_id || null,
           document_type: data.document_type || null,
          items: items as any,
          notes: notes || null,
        } as any)
        .eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Αποθηκεύτηκε!" }),
    onError: (err: any) => toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  const checkDuplicate = async (): Promise<boolean> => {
    if (!form.supplier_vat || !form.invoice_number) return false;
    const { data } = await supabase
      .from("invoices")
      .select("id, supplier, invoice_number")
      .eq("supplier_vat", form.supplier_vat)
      .eq("invoice_number", form.invoice_number)
      .neq("id", invoice.id)
      .limit(1);
    return (data?.length ?? 0) > 0;
  };

  const handleSave = async () => {
    const isDuplicate = await checkDuplicate();
    if (isDuplicate) {
      toast({
        title: "⚠️ Πιθανό Διπλότυπο",
        description: `Υπάρχει ήδη τιμολόγιο με ΑΦΜ "${form.supplier_vat}" και αριθμό "${form.invoice_number}". Αποθηκεύτηκε κανονικά αλλά ελέγξτε αν είναι διπλότυπο.`,
        variant: "destructive",
      });
    }
    updateMutation.mutate(form);
  };

  const handleApprove = async () => {
    const updated = { ...form, status: "approved" };
    patchForm({ status: "approved" });
    updateMutation.mutate(updated);
    await logAction.mutateAsync({ invoiceId: invoice.id, action: "user_approved" });
  };

  const [erpSending, setErpSending] = useState(false);
  const handleSendToERP = async () => {
    setErpSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke("archive-invoice", {
        body: { invoice_id: invoice.id, target_status: "accountant_pending" },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (resp.error) throw resp.error;
      patchForm({ status: "accountant_pending" });
      const monthFolder = resp.data?.month_folder;
      toast({
        title: "Στάλθηκε στο ERP!",
        description: monthFolder ? `Αρχειοθετήθηκε στον φάκελο: ${monthFolder}` : "Αναμένει επιβεβαίωση λογιστή.",
      });
      await logAction.mutateAsync({ invoiceId: invoice.id, action: "sent_to_erp", metadata: { month_folder: monthFolder } });
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
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke("archive-invoice", {
        body: { invoice_id: invoice.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (resp.error) throw resp.error;
      patchForm({ status: "accountant_approved" });
      toast({
        title: "✅ Εγκρίθηκε & αρχειοθετήθηκε!",
        description: resp.data?.month_folder ? `Φάκελος: ${resp.data.month_folder}` : "Το τιμολόγιο εγκρίθηκε.",
      });
      await logAction.mutateAsync({ invoiceId: invoice.id, action: "accountant_approved" });
    } catch (err: any) {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  };

  const isBusy = updateMutation.isPending || erpSending || archiving;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">
            {form.invoice_number || "Νέο Τιμολόγιο"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAccountant ? "Επιβεβαίωση Λογιστή" : "Επεξεργασία & Έλεγχος"}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {!isAccountant && (
            <Button variant="outline" onClick={handleSave} disabled={isBusy}>
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
        {/* Left: File Preview */}
        <div className="flex flex-col gap-4">
          {invoice.file_url ? (
            <FilePreview fileUrl={invoice.file_url} fileName={invoice.file_name ?? ""} />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">Δεν υπάρχει διαθέσιμη προεπισκόπηση αρχείου</p>
            </div>
          )}
          {/* Audit timeline in left column */}
          <AuditTimeline invoiceId={invoice.id} />
        </div>

        {/* Right: Form + Items */}
        <div className="flex flex-col gap-4">
          <InvoiceFormFields
            form={form}
            onChange={patchForm}
            isAccountant={isAccountant}
            projects={projects as { id: string; name: string }[]}
          />

          {/* Notes / Comments */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="mb-3 font-medium text-card-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Σχόλια
            </h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Προσθήκη σχολίων για αυτό το τιμολόγιο…"
              className="min-h-[80px]"
              readOnly={isAccountant}
            />
          </div>

          {/* Editable Items */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-card-foreground">Είδη ({items.length})</h3>
              {!isAccountant && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-1 h-3 w-3" /> Προσθήκη
                  </Button>
                  {items.length > 0 && (
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setItems([])}>
                      <Trash2 className="mr-1 h-3 w-3" /> Διαγραφή όλων
                    </Button>
                  )}
                </div>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Δεν υπάρχουν είδη</p>
            ) : (
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                      <div>
                        <Label className="text-xs text-muted-foreground">Κωδικός</Label>
                        <Input
                          value={item.product_id ?? ""}
                          onChange={(e) => updateItem(i, "product_id", e.target.value)}
                          className="h-8 text-sm font-mono"
                          readOnly={isAccountant}
                          placeholder="SKU / Code"
                        />
                      </div>
                      {!isAccountant && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 mt-4 text-muted-foreground hover:text-destructive" onClick={() => removeItem(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {/* Περιγραφή είδους */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Περιγραφή</Label>
                      <Input
                        value={item.description ?? ""}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        className="h-8 text-sm"
                        readOnly={isAccountant}
                        placeholder="Περιγραφή προϊόντος/υπηρεσίας"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Ποσότητα</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity ?? 0}
                          onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          readOnly={isAccountant}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Τιμή Μονάδας</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={typeof item.unit_price === "number" ? item.unit_price.toFixed(2) : (item.unit_price ?? "0.00")}
                          onChange={(e) => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          readOnly={isAccountant}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Σύνολο</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={typeof item.total === "number" ? item.total.toFixed(2) : (item.total ?? "0.00")}
                          className="h-8 text-sm bg-muted/50"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
