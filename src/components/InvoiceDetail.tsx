import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Database,
  Loader2,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  FolderOpen,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface InvoiceDetailProps {
  invoice: any;
  onBack: () => void;
  isAccountant?: boolean;
}

export default function InvoiceDetail({ invoice, onBack, isAccountant = false }: InvoiceDetailProps) {
  const { toast } = useToast();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  }, []);

  const [form, setForm] = useState({
    supplier: invoice.supplier || "",
    supplier_vat: invoice.supplier_vat || "",
    invoice_number: invoice.invoice_number || "",
    invoice_date: invoice.invoice_date || "",
    due_date: invoice.due_date || "",
    amount: invoice.amount?.toString() || "",
    currency: invoice.currency || "EUR",
    status: invoice.status || "draft",
    project_id: invoice.project_id || "",
  });

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  // Fetch projects for the dropdown
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form) => {
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
        })
        .eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Αποθηκεύτηκε!" });
    },
    onError: (err: any) => {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => updateMutation.mutate(form);

  const handleApprove = () => {
    const updated = { ...form, status: "approved" };
    setForm(updated);
    updateMutation.mutate(updated);
  };

  const [erpSending, setErpSending] = useState(false);

  const handleSendToERP = async () => {
    setErpSending(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const { error } = await supabase
        .from("invoices")
        .update({ status: "accountant_pending" })
        .eq("id", invoice.id);
      if (error) throw error;
      setForm((prev) => ({ ...prev, status: "accountant_pending" }));
      toast({
        title: "Στάλθηκε στο ERP!",
        description: `Αναμένει επιβεβαίωση λογιστή.`,
      });
    } catch (err: any) {
      toast({ title: "Σφάλμα ERP", description: err.message, variant: "destructive" });
    } finally {
      setErpSending(false);
    }
  };

  const handleAccountantApprove = async () => {
    const updated = { ...form, status: "accountant_approved" };
    setForm(updated);
    updateMutation.mutate(updated);
  };

  const fileUrl = invoice.file_url;
  const fileName = invoice.file_name || "";
  const isPdf = fileName.toLowerCase().endsWith(".pdf");
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(fileName);

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
            <Button variant="outline" onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Αποθήκευση
            </Button>
          )}
          {!isAccountant && form.status === "draft" && (
            <Button onClick={handleApprove} disabled={updateMutation.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Έγκριση
            </Button>
          )}
          {!isAccountant && form.status === "approved" && (
            <Button
              onClick={handleSendToERP}
              disabled={erpSending}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              {erpSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Αποστολή σε ERP
            </Button>
          )}
          {form.status === "accountant_pending" && (
            <Button
              onClick={handleAccountantApprove}
              disabled={updateMutation.isPending}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Έγκριση Λογιστή
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
          {fileUrl && (isPdf || isImage) ? (
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-medium text-card-foreground text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {fileName || "Αρχείο Τιμολογίου"}
                </h3>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Άνοιγμα
                </a>
              </div>
              {isPdf ? (
                <div className="flex flex-col items-center bg-muted/30">
                  <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center min-h-[400px] gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">Φόρτωση PDF…</span>
                      </div>
                    }
                    error={
                      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 p-8 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground opacity-40" />
                        <p className="text-sm text-muted-foreground">Αδυναμία φόρτωσης PDF.</p>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Άνοιγμα σε νέα καρτέλα
                        </a>
                      </div>
                    }
                  >
                    <Page pageNumber={pageNumber} width={560} renderTextLayer renderAnnotationLayer />
                  </Document>
                  {numPages > 1 && (
                    <div className="flex items-center gap-3 py-3 border-t border-border w-full justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {pageNumber} / {numPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center bg-muted/30 p-4 min-h-[400px]">
                  <img
                    src={fileUrl}
                    alt="Invoice"
                    className="max-w-full max-h-[600px] object-contain rounded"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border border-dashed bg-card flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">Δεν υπάρχει διαθέσιμη προεπισκόπηση αρχείου</p>
            </div>
          )}
        </div>

        {/* Right: Form + Items + OCR */}
        <div className="flex flex-col gap-4">
          {/* Form fields */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-medium text-card-foreground mb-4">Στοιχεία Τιμολογίου</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Προμηθευτής</Label>
                <Input
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  readOnly={isAccountant}
                />
              </div>
              <div className="space-y-2">
                <Label>ΑΦΜ Προμηθευτή</Label>
                <Input
                  value={form.supplier_vat}
                  onChange={(e) => setForm({ ...form, supplier_vat: e.target.value })}
                  readOnly={isAccountant}
                />
              </div>
              <div className="space-y-2">
                <Label>Αριθμός Τιμολογίου</Label>
                <Input
                  value={form.invoice_number}
                  onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                  readOnly={isAccountant}
                />
              </div>
              <div className="space-y-2">
                <Label>Ποσό</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  readOnly={isAccountant}
                />
              </div>
              <div className="space-y-2">
                <Label>Ημ. Τιμολογίου</Label>
                <Input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                  readOnly={isAccountant}
                />
              </div>
              <div className="space-y-2">
                <Label>Ημ. Λήξης</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  readOnly={isAccountant}
                />
              </div>
              {/* Project selector */}
              {!isAccountant && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Project
                  </Label>
                  <Select
                    value={form.project_id || "none"}
                    onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Χωρίς project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Χωρίς project —</SelectItem>
                      {(projects ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
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
                    {(projects ?? []).find((p: any) => p.id === form.project_id)?.name ?? "—"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="mb-4 font-medium text-card-foreground">Είδη ({items.length})</h3>
              <div className="space-y-3">
                {items.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-secondary p-3 text-sm"
                  >
                    <span className="flex-1 text-card-foreground">{item.description || "—"}</span>
                    <span className="text-muted-foreground">
                      {item.quantity || 0} × {item.unit_price?.toFixed(2) || "0.00"} ={" "}
                      {item.total?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OCR raw text */}
          {invoice.raw_ocr_text && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="mb-2 font-medium text-card-foreground">OCR Κείμενο</h3>
              <Textarea value={invoice.raw_ocr_text} readOnly rows={6} className="text-xs" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
