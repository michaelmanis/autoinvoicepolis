/**
 * useInvoiceUpload — Manages the file upload queue for invoice processing.
 * Validates file type/size, uploads to storage, and invokes the AI extraction
 * edge function. Tracks per-file status so the UI can show progress.
 */

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// ─── Types ────────────────────────────────────────────────────────────────────

/** Represents a single file in the upload queue */
export type UploadItem = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  /** Number of invoices the AI extracted from this file */
  count?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a filename: strip diacritics, non-ASCII chars, and extra spaces */
function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

/** Filter files by allowed type/size and toast a warning for rejected ones */
function validateFiles(files: File[], toast: ReturnType<typeof useToast>["toast"]): File[] {
  const valid = files.filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE_BYTES);
  const rejected = files.length - valid.length;
  if (rejected > 0) {
    toast({
      title: `${rejected} αρχεία απορρίφθηκαν`,
      description: "Μόνο PDF, PNG, JPG, WebP έως 20MB",
      variant: "destructive",
    });
  }
  return valid;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInvoiceUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /** Validate and append files to the queue */
  const addFiles = (files: File[]) => {
    const valid = validateFiles(files, toast);
    if (valid.length) {
      setQueue((prev) => [...prev, ...valid.map((f) => ({ file: f, status: "pending" as const }))]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Remove a single pending item from the queue */
  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Upload all pending files in parallel:
   * 1. Upload file to storage
   * 2. Invoke extract-invoice edge function
   * 3. Update queue status per file
   */
  const runUpload = async (documentType?: string) => {
    const pendingIndices = queue
      .map((q, i) => (q.status === "pending" ? i : -1))
      .filter((i) => i !== -1);

    if (pendingIndices.length === 0) return;

    setIsUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Μη εξουσιοδοτημένος", variant: "destructive" });
      setIsUploading(false);
      return;
    }

    // Mark all pending items as uploading
    setQueue((prev) =>
      prev.map((x, idx) =>
        pendingIndices.includes(idx) ? { ...x, status: "uploading" } : x
      )
    );

    // Process files in parallel
    const results = await Promise.allSettled(
      pendingIndices.map(async (i) => {
        const item = queue[i];
        const filePath = `${user.id}/${Date.now()}_${sanitizeFileName(item.file.name)}`;

        console.log("[InvoiceUpload] Uploading to storage:", filePath);
        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(filePath, item.file);
        if (uploadError) {
          console.error("[InvoiceUpload] Storage upload error:", uploadError);
          throw uploadError;
        }

        console.log("[InvoiceUpload] Invoking extract-invoice function...");
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "extract-invoice",
          { body: { file_path: filePath, file_name: item.file.name, document_type: documentType } },
        );
        if (fnError) {
          console.error("[InvoiceUpload] Edge function error:", fnError);
          throw fnError;
        }
        console.log("[InvoiceUpload] Extract result:", fnData);

        return { index: i, count: (fnData as any)?.count ?? 1 };
      })
    );

    // Update queue statuses from results
    setQueue((prev) => {
      const next = [...prev];
      results.forEach((result, ri) => {
        const i = pendingIndices[ri];
        if (result.status === "fulfilled") {
          next[i] = { ...next[i], status: "done", count: result.value.count };
        } else {
          next[i] = { ...next[i], status: "error", error: (result.reason as Error)?.message ?? "Σφάλμα" };
        }
      });
      return next;
    });

    const totalExtracted = results.reduce(
      (sum, r) => (r.status === "fulfilled" ? sum + r.value.count : sum),
      0,
    );

    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    toast({ title: `Ολοκληρώθηκε! ${totalExtracted} τιμολόγιο/α εξήχθησαν` });

    return totalExtracted;
  };

  /** Clear the queue */
  const reset = () => setQueue([]);

  return { queue, isUploading, fileInputRef, addFiles, removeFromQueue, runUpload, reset };
}
