/**
 * useExpenseUpload — Manages file upload queue for expense processing.
 */

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export type UploadItem = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  count?: number;
};

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

export function useExpenseUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addFiles = (files: File[]) => {
    const valid = files.filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE_BYTES);
    const rejected = files.length - valid.length;
    if (rejected > 0) {
      toast({
        title: `${rejected} αρχεία απορρίφθηκαν`,
        description: "Μόνο PDF, PNG, JPG, WebP έως 20MB",
        variant: "destructive",
      });
    }
    if (valid.length) {
      setQueue((prev) => [...prev, ...valid.map((f) => ({ file: f, status: "pending" as const }))]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

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

    setQueue((prev) =>
      prev.map((x, idx) =>
        pendingIndices.includes(idx) ? { ...x, status: "uploading" } : x
      )
    );

    const results = await Promise.allSettled(
      pendingIndices.map(async (i) => {
        const item = queue[i];
        const filePath = `${user.id}/${Date.now()}_${sanitizeFileName(item.file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(filePath, item.file);
        if (uploadError) throw uploadError;

        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "extract-expense",
          { body: { file_path: filePath, file_name: item.file.name, document_type: documentType } },
        );
        if (fnError) throw fnError;
        return { index: i, count: (fnData as any)?.count ?? 1 };
      })
    );

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
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    toast({ title: `Ολοκληρώθηκε! ${totalExtracted} δαπάνη/ες εξήχθησαν` });
    return totalExtracted;
  };

  const reset = () => setQueue([]);

  return { queue, isUploading, fileInputRef, addFiles, removeFromQueue, runUpload, reset };
}
