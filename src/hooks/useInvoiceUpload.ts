import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

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

export function useInvoiceUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addFiles = (files: File[]) => {
    const valid = validateFiles(files, toast);
    if (valid.length) {
      setQueue((prev) => [...prev, ...valid.map((f) => ({ file: f, status: "pending" as const }))]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const runUpload = async () => {
    const hasPending = queue.some((q) => q.status === "pending");
    if (!hasPending) return;

    setIsUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Μη εξουσιοδοτημένος", variant: "destructive" });
      setIsUploading(false);
      return;
    }

    let totalExtracted = 0;

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== "pending") continue;

      setQueue((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, status: "uploading" } : x))
      );

      try {
        const item = queue[i];
        const safeName = sanitizeFileName(item.file.name);
        const filePath = `${user.id}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(filePath, item.file);
        if (uploadError) throw uploadError;

        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "extract-invoice",
          { body: { file_path: filePath, file_name: item.file.name } }
        );
        if (fnError) throw fnError;

        const count = (fnData as any)?.count ?? 1;
        totalExtracted += count;

        setQueue((prev) =>
          prev.map((x, idx) => (idx === i ? { ...x, status: "done", count } : x))
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: "error", error: err.message } : x
          )
        );
      }
    }

    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    toast({ title: `Ολοκληρώθηκε! ${totalExtracted} τιμολόγιο/α εξήχθησαν` });

    return totalExtracted;
  };

  const reset = () => setQueue([]);

  return {
    queue,
    isUploading,
    fileInputRef,
    addFiles,
    removeFromQueue,
    runUpload,
    reset,
  };
}
