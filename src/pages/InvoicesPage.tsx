import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
  Trash2,
  Plus,
  X,
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

type UploadItem = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  count?: number; // number of invoices extracted from this file
};

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  draft: { label: "Draft", className: "bg-info/10 text-info", icon: Clock },
  review: { label: "Αναμονή", className: "bg-warning/10 text-warning", icon: AlertCircle },
  approved: { label: "Εγκρίθηκε", className: "bg-success/10 text-success", icon: CheckCircle2 },
  submitted: { label: "Υποβλήθηκε", className: "bg-success/10 text-success", icon: CheckCircle2 },
  accountant_pending: { label: "Αναμονή Λογιστή", className: "bg-warning/10 text-warning", icon: AlertCircle },
  accountant_approved: { label: "Εγκρίθηκε (Λογιστής)", className: "bg-success/10 text-success", icon: CheckCircle2 },
  error: { label: "Σφάλμα", className: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

export default function InvoicesPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    const valid = files.filter((f) => allowedTypes.includes(f.type) && f.size <= 20 * 1024 * 1024);
    const invalid = files.length - valid.length;

    if (invalid > 0) {
      toast({
        title: `${invalid} αρχεία απορρίφθηκαν`,
        description: "Μόνο PDF, PNG, JPG, WebP έως 20MB",
        variant: "destructive",
      });
    }

    setUploadQueue((prev) => [...prev, ...valid.map((f) => ({ file: f, status: "pending" as const }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    const valid = files.filter((f) => allowedTypes.includes(f.type) && f.size <= 20 * 1024 * 1024);
    const invalid = files.length - valid.length;
    if (invalid > 0) {
      toast({
        title: `${invalid} αρχεία απορρίφθηκαν`,
        description: "Μόνο PDF, PNG, JPG, WebP έως 20MB",
        variant: "destructive",
      });
    }
    if (valid.length) {
      setUploadQueue((prev) => [...prev, ...valid.map((f) => ({ file: f, status: "pending" as const }))]);
    }
  };

  const runBulkUpload = async () => {
    const pending = uploadQueue.filter((q) => q.status === "pending");
    if (!pending.length) return;
    setIsUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Μη εξουσιοδοτημένος", variant: "destructive" });
      setIsUploading(false);
      return;
    }

    for (let i = 0; i < uploadQueue.length; i++) {
      if (uploadQueue[i].status !== "pending") continue;

      setUploadQueue((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, status: "uploading" } : x))
      );

      try {
        const item = uploadQueue[i];
        const safeFileName = item.file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\x00-\x7F]/g, "_")
          .replace(/\s+/g, "_")
          .replace(/_+/g, "_");
        const filePath = `${user.id}/${Date.now()}_${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(filePath, item.file);
        if (uploadError) throw uploadError;

        const { data: fnData, error: fnError } = await supabase.functions.invoke("extract-invoice", {
          body: { file_path: filePath, file_name: item.file.name },
        });
        if (fnError) throw fnError;

        const count = (fnData as any)?.count ?? 1;
        setUploadQueue((prev) =>
          prev.map((x, idx) => (idx === i ? { ...x, status: "done", count } : x))
        );
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: "error", error: err.message } : x
          )
        );
      }
    }

    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });

    // Sum all extracted invoice records across files
    const totalInvoices = uploadQueue.reduce((sum, q) => sum + (q.count ?? (q.status === "done" ? 1 : 0)), 0);
    toast({ title: `Ολοκληρώθηκε! ${totalInvoices} τιμολόγιο/α εξήχθησαν` });

    setTimeout(() => {
      setUploadOpen(false);
      setUploadQueue([]);
    }, 1500);
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
        <Dialog
          open={uploadOpen}
          onOpenChange={(v) => { if (!isUploading) { setUploadOpen(v); if (!v) setUploadQueue([]); } }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Νέο Τιμολόγιο
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ανέβασμα Τιμολογίων</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Επιλέξτε ένα ή πολλά αρχεία. Το AI θα αναγνωρίσει αυτόματα τα δεδομένα κάθε τιμολογίου.
            </p>

            {/* Drop area */}
            <div
              className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-border py-10 gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground/50" />
              {uploadQueue.length === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">Σύρτε αρχεία εδώ ή κάντε κλικ για επιλογή</p>
                  <p className="text-xs text-muted-foreground/70">PDF, PNG, JPG, WebP — έως 20MB το αρχείο</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">+ Προσθήκη περισσότερων αρχείων</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleFilesSelected}
              disabled={isUploading}
            />

            {/* Queue */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadQueue.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{item.file.name}</span>
                    {item.status === "pending" && <span className="text-xs text-muted-foreground">Αναμονή</span>}
                    {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {item.status === "done" && (
                      <span className="flex items-center gap-1 text-xs text-success font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        {item.count && item.count > 1 ? `${item.count} τιμολόγια` : "✓"}
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="text-xs text-destructive" title={item.error}>Σφάλμα</span>
                    )}
                    {!isUploading && item.status === "pending" && (
                      <button onClick={() => setUploadQueue((prev) => prev.filter((_, i) => i !== idx))}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full"
              onClick={runBulkUpload}
              disabled={!uploadQueue.some(q => q.status === 'pending') || isUploading}
            >
              {isUploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Επεξεργασία...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Ανέβασμα {uploadQueue.filter(q => q.status === 'pending').length > 0 ? `(${uploadQueue.filter(q => q.status === 'pending').length} αρχεία)` : ""}</>
              )}
            </Button>
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
        <div className="space-y-4">
          {(() => {
            // Group invoices by upload date (created_at date)
            const groups: Record<string, Invoice[]> = {};
            invoices.forEach((inv) => {
              const dateKey = new Date(inv.created_at).toLocaleDateString("el-GR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              if (!groups[dateKey]) groups[dateKey] = [];
              groups[dateKey].push(inv);
            });

            return Object.entries(groups).map(([dateLabel, groupInvoices]) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-3 mb-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {dateLabel}
                  </span>
                  <span className="text-xs text-muted-foreground/60 bg-muted rounded-full px-2 py-0.5">
                    {groupInvoices.length} τιμολόγ{groupInvoices.length === 1 ? "ιο" : "ια"}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="rounded-xl border border-border bg-card shadow-card">
                  <div className="divide-y divide-border">
                    {groupInvoices.map((inv) => {
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
                              {inv.status !== "accountant_pending" && inv.status !== "accountant_approved" && inv.status !== "submitted" && (
                                <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(inv)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
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
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
