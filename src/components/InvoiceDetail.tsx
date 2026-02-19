import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, CheckCircle2, Database, Loader2, FileText, ExternalLink } from "lucide-react";

interface InvoiceDetailProps {
  invoice: any;
  onBack: () => void;
}

export default function InvoiceDetail({ invoice, onBack }: InvoiceDetailProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    supplier: invoice.supplier || "",
    supplier_vat: invoice.supplier_vat || "",
    invoice_number: invoice.invoice_number || "",
    invoice_date: invoice.invoice_date || "",
    due_date: invoice.due_date || "",
    amount: invoice.amount?.toString() || "",
    currency: invoice.currency || "EUR",
    status: invoice.status || "draft",
  });

  const items = Array.isArray(invoice.items) ? invoice.items : [];

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
        .update({ status: "submitted" })
        .eq("id", invoice.id);
      if (error) throw error;
      setForm((prev) => ({ ...prev, status: "submitted" }));
      toast({
        title: "Στάλθηκε στο ERP!",
        description: `Το τιμολόγιο ${form.invoice_number || invoice.id} καταχωρήθηκε επιτυχώς. (Mock)`,
      });
    } catch (err: any) {
      toast({ title: "Σφάλμα ERP", description: err.message, variant: "destructive" });
    } finally {
      setErpSending(false);
    }
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
          <p className="text-sm text-muted-foreground">Επεξεργασία & Έλεγχος</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Αποθήκευση
          </Button>
          {form.status === "draft" && (
            <Button onClick={handleApprove} disabled={updateMutation.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Έγκριση
            </Button>
          )}
          {form.status === "approved" && (
            <Button onClick={handleSendToERP} disabled={erpSending} className="bg-success hover:bg-success/90 text-success-foreground">
              {erpSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Αποστολή σε ERP
            </Button>
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
                <div className="flex flex-col min-h-[600px]">
                  <object
                    data={fileUrl}
                    type="application/pdf"
                    className="w-full flex-1 min-h-[600px]"
                  >
                    {/* Fallback when browser blocks inline PDF */}
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 p-8 text-center bg-muted/30">
                      <FileText className="h-16 w-16 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Ο browser δεν μπορεί να εμφανίσει το PDF εδώ.
                      </p>
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Άνοιγμα PDF σε νέα καρτέλα
                      </a>
                    </div>
                  </object>
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
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>ΑΦΜ Προμηθευτή</Label>
                <Input value={form.supplier_vat} onChange={(e) => setForm({ ...form, supplier_vat: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Αριθμός Τιμολογίου</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ποσό</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ημ. Τιμολογίου</Label>
                <Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ημ. Λήξης</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="mb-4 font-medium text-card-foreground">Είδη ({items.length})</h3>
              <div className="space-y-3">
                {items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-secondary p-3 text-sm">
                    <span className="flex-1 text-card-foreground">{item.description || "—"}</span>
                    <span className="text-muted-foreground">
                      {item.quantity || 0} × {item.unit_price?.toFixed(2) || "0.00"} = {item.total?.toFixed(2) || "0.00"}
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
