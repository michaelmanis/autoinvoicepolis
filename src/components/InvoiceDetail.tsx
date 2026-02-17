import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";

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

  return (
    <div className="space-y-6">
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
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Form */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-medium text-card-foreground">Στοιχεία Τιμολογίου</h3>

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

        {/* Right: Items + OCR text */}
        <div className="space-y-4">
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

          {invoice.raw_ocr_text && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="mb-2 font-medium text-card-foreground">OCR Κείμενο</h3>
              <Textarea value={invoice.raw_ocr_text} readOnly rows={8} className="text-xs" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
