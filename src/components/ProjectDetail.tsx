/**
 * ProjectDetail — Displays a single project's invoices with options to:
 * - Assign existing unassigned invoices
 * - Bulk upload new invoices (with AI extraction)
 * - View/remove individual invoices
 *
 * Uses the shared Invoice type and STATUS_CONFIG from types/invoice.ts
 * to avoid duplicate type definitions.
 */

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Upload, FileText, CheckCircle2, Loader2,
  Eye, Plus, Link2, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import InvoiceDetail from "@/components/InvoiceDetail";
import { STATUS_CONFIG, type Invoice } from "@/types/invoice";
import type { UploadItem } from "@/hooks/useInvoiceUpload";

// ─── Types ────────────────────────────────────────────────────────────────────

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

interface Props {
  project: Project;
  onBack: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sanitise a filename for safe storage upload */
function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectDetail({ project, onBack }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Invoices belonging to this project */
  const { data: projectInvoices, isLoading } = useQuery({
    queryKey: ["invoices", "project", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  /** Invoices without a project — only fetched when the assign dialog is open */
  const { data: unassignedInvoices } = useQuery({
    queryKey: ["invoices", "unassigned"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .is("project_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: assignOpen,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Assign selected invoices to this project */
  const assignMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("invoices")
        .update({ project_id: project.id })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: `${selectedIds.length} τιμολόγια ανατέθηκαν στο project!` });
      setAssignOpen(false);
      setSelectedIds([]);
    },
    onError: (err: any) =>
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  /** Remove an invoice from this project (set project_id to null) */
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ project_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Αφαιρέθηκε από το project" });
    },
  });

  // ── Upload handlers ───────────────────────────────────────────────────────

  /** Validate and queue selected files */
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const valid = files.filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE_BYTES);
    const invalid = files.length - valid.length;

    if (invalid > 0) {
      toast({
        title: `${invalid} αρχεία απορρίφθηκαν`,
        description: "Μόνο PDF, PNG, JPG, WebP έως 20MB",
        variant: "destructive",
      });
    }

    setUploadQueue(valid.map((f) => ({ file: f, status: "pending" })));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Upload all queued files and invoke AI extraction for each */
  const runBulkUpload = async () => {
    if (!uploadQueue.length) return;
    setIsUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Μη εξουσιοδοτημένος", variant: "destructive" });
      setIsUploading(false);
      return;
    }

    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i];
      setUploadQueue((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, status: "uploading" } : x))
      );

      try {
        const filePath = `${user.id}/${Date.now()}_${sanitizeFileName(item.file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(filePath, item.file);
        if (uploadError) throw uploadError;

        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "extract-invoice",
          { body: { file_path: filePath, file_name: item.file.name, project_id: project.id } },
        );
        if (fnError) throw fnError;

        const count = (fnData as any)?.count ?? 1;
        setUploadQueue((prev) =>
          prev.map((x, idx) => (idx === i ? { ...x, status: "done", count } : x))
        );
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((x, idx) => (idx === i ? { ...x, status: "error", error: err.message } : x))
        );
      }
    }

    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });

    const totalInvoices = uploadQueue.reduce(
      (sum, q) => sum + (q.count ?? (q.status === "done" ? 1 : 0)),
      0,
    );
    toast({ title: `Ολοκληρώθηκε! ${totalInvoices} τιμολόγιο/α εξήχθησαν` });

    setTimeout(() => {
      setUploadOpen(false);
      setUploadQueue([]);
    }, 1500);
  };

  // ── Detail view ───────────────────────────────────────────────────────────

  if (selectedInvoice) {
    return (
      <InvoiceDetail
        invoice={selectedInvoice}
        onBack={() => {
          setSelectedInvoice(null);
          queryClient.invalidateQueries({ queryKey: ["invoices", "project", project.id] });
        }}
      />
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">{project.name}</h2>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {/* Assign existing invoices dialog */}
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Link2 className="mr-2 h-4 w-4" />
                Ανάθεση
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Ανάθεση Τιμολογίων</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Επιλέξτε τιμολόγια χωρίς project για να τα αναθέσετε εδώ.
              </p>
              <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                {!unassignedInvoices?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Δεν υπάρχουν αδέσποτα τιμολόγια
                  </p>
                ) : (
                  unassignedInvoices.map((inv) => (
                    <label
                      key={inv.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.includes(inv.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) =>
                            checked ? [...prev, inv.id] : prev.filter((id) => id !== inv.id)
                          );
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {inv.invoice_number || inv.file_name || "Χωρίς αριθμό"}
                        </p>
                        <p className="text-xs text-muted-foreground">{inv.supplier || "—"}</p>
                      </div>
                      {inv.amount != null && (
                        <span className="text-sm font-medium shrink-0">
                          {inv.amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {inv.currency || "€"}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <Button
                className="w-full"
                onClick={() => assignMutation.mutate(selectedIds)}
                disabled={!selectedIds.length || assignMutation.isPending}
              >
                {assignMutation.isPending
                  ? "Ανάθεση..."
                  : `Ανάθεση ${selectedIds.length > 0 ? `(${selectedIds.length})` : ""} τιμολογίων`}
              </Button>
            </DialogContent>
          </Dialog>

          {/* Bulk upload dialog */}
          <Dialog
            open={uploadOpen}
            onOpenChange={(v) => {
              if (!isUploading) {
                setUploadOpen(v);
                if (!v) setUploadQueue([]);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Μαζικό Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Μαζικό Ανέβασμα Τιμολογίων</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Επιλέξτε ένα ή πολλά αρχεία (PDF, PNG, JPG). Το AI θα αναγνωρίσει αυτόματα τα δεδομένα.
              </p>

              {/* File selection area */}
              {!uploadQueue.length && (
                <button
                  type="button"
                  className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-border py-10 gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Κάντε κλικ για επιλογή αρχείων</p>
                  <p className="text-xs text-muted-foreground/70">PDF, PNG, JPG, WebP — έως 20MB</p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleFilesSelected}
                disabled={isUploading}
              />

              {/* Upload queue */}
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
                      {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
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

              <div className="flex gap-2">
                {!isUploading && (
                  <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Προσθήκη αρχείων
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={runBulkUpload}
                  disabled={!uploadQueue.length || isUploading || uploadQueue.every((q) => q.status === "done")}
                >
                  {isUploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Επεξεργασία...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" />Ανέβασμα {uploadQueue.filter((q) => q.status === "pending").length > 0 ? `(${uploadQueue.filter((q) => q.status === "pending").length})` : ""}</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !projectInvoices?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 gap-3">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Δεν υπάρχουν τιμολόγια σε αυτό το project</p>
          <p className="text-sm text-muted-foreground/70">Ανεβάστε νέα ή αναθέστε υπάρχοντα τιμολόγια</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="divide-y divide-border">
            {projectInvoices.map((inv) => {
              const status = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft;
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
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(inv)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Αφαίρεση από project" onClick={() => removeMutation.mutate(inv.id)}>
                        <X className="h-4 w-4 text-muted-foreground" />
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
