import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload, FileText, CheckCircle2, Loader2, Eye, Trash2, Plus, X,
} from "lucide-react";
import InvoiceDetail from "@/components/InvoiceDetail";
import { useInvoices, useDeleteInvoice } from "@/hooks/useInvoices";
import { useInvoiceUpload } from "@/hooks/useInvoiceUpload";
import { STATUS_CONFIG, LOCKED_STATUSES, type Invoice } from "@/types/invoice";

// ─── Upload Dialog ────────────────────────────────────────────────────────────

function UploadDialog() {
  const [open, setOpen] = useState(false);
  const { queue, isUploading, fileInputRef, addFiles, removeFromQueue, runUpload, reset } = useInvoiceUpload();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleClose = (v: boolean) => {
    if (!isUploading) { setOpen(v); if (!v) reset(); }
  };

  const pendingCount = queue.filter((q) => q.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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

        {/* Drop zone */}
        <div
          className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-border py-10 gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="h-10 w-10 text-muted-foreground/50" />
          {queue.length === 0 ? (
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
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          disabled={isUploading}
        />

        {/* Queue list */}
        {queue.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {queue.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
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
                  <button onClick={() => removeFromQueue(idx)}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <Button
          className="w-full"
          onClick={async () => {
            await runUpload();
            setTimeout(() => { setOpen(false); reset(); }, 1500);
          }}
          disabled={pendingCount === 0 || isUploading}
        >
          {isUploading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Επεξεργασία...</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" />Ανέβασμα{pendingCount > 0 ? ` (${pendingCount} αρχεία)` : ""}</>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice row ──────────────────────────────────────────────────────────────

function InvoiceRow({
  inv,
  onView,
  onDelete,
}: {
  inv: Invoice;
  onView: (inv: Invoice) => void;
  onDelete: (id: string) => void;
}) {
  const status = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = status.icon;
  const isLocked = LOCKED_STATUSES.has(inv.status);

  return (
    <div className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-secondary/50">
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
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
        <div className="flex gap-1">
          {!isLocked && (
            <Button variant="ghost" size="icon" onClick={() => onView(inv)}>
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onDelete(inv.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const queryClient = useQueryClient();
  const { data: invoices, isLoading } = useInvoices();
  const deleteMutation = useDeleteInvoice();

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

  // Group by upload date
  const groups = (invoices ?? []).reduce<Record<string, Invoice[]>>((acc, inv) => {
    const key = new Date(inv.created_at).toLocaleDateString("el-GR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    (acc[key] ??= []).push(inv);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Τιμολόγια</h2>
          <p className="text-sm text-muted-foreground">Ανεβάστε και διαχειριστείτε τα τιμολόγιά σας</p>
        </div>
        <UploadDialog />
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
          {Object.entries(groups).map(([dateLabel, groupInvoices]) => (
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
                  {groupInvoices.map((inv) => (
                    <InvoiceRow
                      key={inv.id}
                      inv={inv}
                      onView={setSelectedInvoice}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
