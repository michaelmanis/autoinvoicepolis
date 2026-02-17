import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  Plus,
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
};

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  draft: { label: "Draft", className: "bg-info/10 text-info", icon: Clock },
  review: { label: "Αναμονή", className: "bg-warning/10 text-warning", icon: AlertCircle },
  approved: { label: "Εγκρίθηκε", className: "bg-success/10 text-success", icon: CheckCircle2 },
  submitted: { label: "Υποβλήθηκε", className: "bg-success/10 text-success", icon: CheckCircle2 },
  error: { label: "Σφάλμα", className: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

export default function InvoicesPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Διαγράφηκε" });
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Μη αποδεκτός τύπος αρχείου", description: "PDF, PNG, JPG ή WebP", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Πολύ μεγάλο αρχείο", description: "Μέγιστο 20MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke("extract-invoice", {
        body: { file_path: filePath, file_name: file.name },
      });

      if (error) throw error;

      toast({ title: "Τιμολόγιο αναγνωρίστηκε!", description: `Προμηθευτής: ${data.extracted?.supplier || "—"}` });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setUploadOpen(false);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (selectedInvoice) {
    return (
      <InvoiceDetail
        invoice={selectedInvoice}
        onBack={() => {
          setSelectedInvoice(null);
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Τιμολόγια</h2>
          <p className="text-sm text-muted-foreground">Ανεβάστε και διαχειριστείτε τα τιμολόγιά σας</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Νέο Τιμολόγιο
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ανέβασμα Τιμολογίου</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Ανεβάστε PDF ή εικόνα τιμολογίου. Το AI θα αναγνωρίσει αυτόματα τα δεδομένα.
              </p>
              <div className="space-y-2">
                <Label htmlFor="invoice-file">Αρχείο (PDF, PNG, JPG)</Label>
                <Input
                  id="invoice-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI αναγνώριση σε εξέλιξη...</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !invoices?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Upload className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Δεν υπάρχουν τιμολόγια ακόμα</p>
          <p className="text-sm text-muted-foreground/70">Ανεβάστε ένα PDF ή εικόνα για να ξεκινήσετε</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="divide-y divide-border">
            {invoices.map((inv) => {
              const status = statusConfig[inv.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-card-foreground">
                        {inv.invoice_number || inv.file_name || "Χωρίς αριθμό"}
                      </p>
                      <p className="text-sm text-muted-foreground">{inv.supplier || "Άγνωστος προμηθευτής"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {inv.amount != null && (
                      <span className="text-sm font-medium text-card-foreground">
                        {inv.amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {inv.currency || "€"}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.className}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(inv)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(inv.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
