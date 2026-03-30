import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, FileText, CheckCircle2, Loader2, Eye, Trash2, Plus, X, Copy,
} from "lucide-react";
import InvoiceDetail from "@/components/InvoiceDetail";
import { useInvoices, useDeleteInvoice } from "@/hooks/useInvoices";
import { useInvoiceUpload } from "@/hooks/useInvoiceUpload";
import { STATUS_CONFIG, LOCKED_STATUSES, type Invoice } from "@/types/invoice";
import { DOCUMENT_TYPES } from "@/types/documentTypes";

// ─── Upload Dialog ────────────────────────────────────────────────────────────

function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string>("");
  const { queue, isUploading, fileInputRef, addFiles, removeFromQueue, runUpload, reset } = useInvoiceUpload();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleClose = (v: boolean) => {
    if (!isUploading) { setOpen(v); if (!v) { reset(); setDocumentType(""); } }
  };

  const pendingCount = queue.filter((q) => q.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm" className="md:size-default">
          <Plus className="mr-1.5 h-4 w-4 md:mr-2" />
          <span className="hidden sm:inline">Νέο Τιμολόγιο</span>
          <span className="sm:hidden">Νέο</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg mx-4">
        <DialogHeader>
          <DialogTitle>Ανέβασμα Τιμολογίων</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Επιλέξτε ένα ή πολλά αρχεία. Το AI θα αναγνωρίσει αυτόματα τα δεδομένα κάθε τιμολογίου.
        </p>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Στοιχεία Τιμολογίου <span className="text-destructive">*</span>
          </label>
          {!documentType && queue.length > 0 && (
            <p className="text-xs text-destructive">Υποχρεωτικό πεδίο — επιλέξτε τύπο παραστατικού</p>
          )}
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger>
              <SelectValue placeholder="Επιλέξτε τύπο παραστατικού..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {DOCUMENT_TYPES.map((dt) => (
                <SelectItem key={dt.code} value={dt.code}>
                  <span className="font-medium">{dt.code}</span>
                  <span className="text-muted-foreground ml-2">— {dt.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-border py-8 md:py-10 gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="h-10 w-10 text-muted-foreground/50" />
          {queue.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground text-center px-4">Σύρτε αρχεία εδώ ή κάντε κλικ για επιλογή</p>
              <p className="text-xs text-muted-foreground/70">PDF, PNG, JPG, WebP — έως 20MB</p>
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
            const count = await runUpload(documentType || undefined);
            if (count && count > 0) {
              setOpen(false); reset(); setDocumentType("");
            }
          }}
          disabled={pendingCount === 0 || isUploading || !documentType}
        >
          {isUploading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Επεξεργασία...</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" />Ανέβασμα{pendingCount > 0 ? ` (${pendingCount})` : ""}</>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice row (responsive) ─────────────────────────────────────────────────

function InvoiceRow({
  inv, onView, onDelete, isDuplicate,
}: {
  inv: Invoice;
  onView: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  isDuplicate?: boolean;
}) {
  const status = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = status.icon;
  const isLocked = LOCKED_STATUSES.has(inv.status);

  return (
    <div className={`flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-secondary/50 md:flex-row md:items-center md:justify-between md:px-6 md:py-4 ${isDuplicate ? "bg-destructive/5" : ""}`}>
      {/* Left: icon + info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg ${isDuplicate ? "bg-destructive/10" : "bg-secondary"}`}>
          {isDuplicate ? <Copy className="h-4 w-4 text-destructive" /> : <FileText className="h-4 w-4 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-card-foreground text-sm truncate">
              {inv.invoice_number || inv.file_name || "Χωρίς αριθμό"}
            </p>
            {isDuplicate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive uppercase tracking-wide">
                <Copy className="h-3 w-3" />Διπλ.
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{inv.supplier || "Άγνωστος προμηθευτής"}</p>
        </div>
      </div>

      {/* Right: amount + status + actions */}
      <div className="flex items-center justify-between gap-2 md:gap-4 pl-12 md:pl-0">
        <div className="flex items-center gap-2 flex-wrap">
          {inv.amount != null && (
            <span className="text-sm font-medium text-card-foreground whitespace-nowrap">
              {inv.amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {inv.currency || "€"}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.className}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
        <div className="flex gap-0.5 shrink-0">
          {!isLocked && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(inv)}>
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(inv.id)}>
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

  const duplicateIds = new Set<string>();
  if (invoices) {
    const seen = new Map<string, string>();
    for (const inv of invoices) {
      if (inv.supplier_vat && inv.invoice_number) {
        const key = `${inv.supplier_vat}__${inv.invoice_number}`;
        if (seen.has(key)) {
          duplicateIds.add(inv.id);
          duplicateIds.add(seen.get(key)!);
        } else {
          seen.set(key, inv.id);
        }
      }
    }
  }

  const groups = (invoices ?? []).reduce<Record<string, Invoice[]>>((acc, inv) => {
    const key = new Date(inv.created_at).toLocaleDateString("el-GR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    (acc[key] ??= []).push(inv);
    return acc;
  }, {});

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-semibold text-foreground">Τιμολόγια</h2>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Ανεβάστε και διαχειριστείτε τα τιμολόγιά σας</p>
        </div>
        <UploadDialog />
      </div>

      {duplicateIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm text-destructive">
          <Copy className="h-4 w-4 shrink-0" />
          <span>
            <strong>{duplicateIds.size}</strong> πιθανά διπλότυπα
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !invoices?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 md:py-16">
          <Upload className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Δεν υπάρχουν τιμολόγια ακόμα</p>
          <p className="text-sm text-muted-foreground/70">Ανεβάστε ένα PDF ή εικόνα</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([dateLabel, groupInvoices]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {dateLabel}
                </span>
                <span className="text-[10px] md:text-xs text-muted-foreground/60 bg-muted rounded-full px-2 py-0.5">
                  {groupInvoices.length}
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
                      isDuplicate={duplicateIds.has(inv.id)}
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
