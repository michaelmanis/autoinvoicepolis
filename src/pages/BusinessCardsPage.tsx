import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload, Plus, Loader2, Trash2, Download, Eye, Edit2, Check, X, ContactRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

type BusinessCard = {
  id: string;
  company: string | null;
  contact_surname: string | null;
  contact_name: string | null;
  title: string | null;
  email: string | null;
  mobile_phone: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
};

// ─── Upload Dialog ────────────────────────────────────────────────────────────

function UploadCardDialog() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let totalCards = 0;

      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${user.id}/cards/${Date.now()}_${safeName}`;

        const { error: upErr } = await supabase.storage
          .from("invoices")
          .upload(filePath, file);
        if (upErr) throw upErr;

        const { data, error } = await supabase.functions.invoke("extract-business-card", {
          body: { file_path: filePath, file_name: file.name },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        totalCards += data?.count || 1;
      }

      toast({ title: `✅ Αναγνωρίστηκαν ${totalCards} κάρτ${totalCards === 1 ? "α" : "ες"} από ${files.length} αρχεί${files.length === 1 ? "ο" : "α"}!` });
      queryClient.invalidateQueries({ queryKey: ["business-cards"] });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !uploading && setOpen(v)}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Νέα Κάρτα</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ανέβασμα Επαγγελματικής Κάρτας</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Ανεβάστε φωτογραφίες επαγγελματικών καρτών. Κάθε εικόνα μπορεί να περιέχει πολλές κάρτες — το AI θα τις αναγνωρίσει και θα τις διαχωρίσει αυτόματα.
        </p>
        <div
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Αναγνώριση...</p></>
          ) : (
            <><Upload className="h-10 w-10 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">Κλικ ή σύρτε εικόνες εδώ</p><p className="text-xs text-muted-foreground/70">PNG, JPG, WebP, PDF — έως 20MB · πολλαπλές κάρτες ανά αρχείο</p></>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
         accept="image/*,.pdf"
         capture="environment"
          className="hidden"
          onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) handleUpload(f); }}
          disabled={uploading}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Editable Card Row ────────────────────────────────────────────────────────

function CardRow({ card, onDelete }: { card: BusinessCard; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    company: card.company || "",
    contact_surname: card.contact_surname || "",
    contact_name: card.contact_name || "",
    title: card.title || "",
    email: card.email || "",
    mobile_phone: card.mobile_phone || "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("business_cards" as any)
        .update(form as any)
        .eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Αποθηκεύτηκε" });
      queryClient.invalidateQueries({ queryKey: ["business-cards"] });
      setEditing(false);
    },
    onError: (err: any) => toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {([
            ["company", "Εταιρεία"],
            ["contact_surname", "Επώνυμο"],
            ["contact_name", "Όνομα"],
            ["title", "Τίτλος"],
            ["email", "Email"],
            ["mobile_phone", "Κινητό"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="mt-1"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-3 w-3 mr-1" />Ακύρωση</Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Check className="h-3 w-3 mr-1" />Αποθήκευση
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ContactRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-card-foreground">
            {[card.contact_name, card.contact_surname].filter(Boolean).join(" ") || "Χωρίς όνομα"}
          </p>
          <p className="text-sm text-muted-foreground">{card.title || "—"}</p>
          <p className="text-xs text-muted-foreground">{card.company || "—"}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p className="text-card-foreground">{card.email || "—"}</p>
          <p className="text-muted-foreground">{card.mobile_phone || "—"}</p>
        </div>
        <div className="flex gap-1">
          {card.file_url && (
            <Button variant="ghost" size="icon" onClick={() => window.open(card.file_url!, "_blank")}>
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(card.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessCardsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cards, isLoading } = useQuery({
    queryKey: ["business-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BusinessCard[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_cards" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-cards"] });
      toast({ title: "Διαγράφηκε" });
    },
  });

  const exportToExcel = () => {
    if (!cards?.length) return;
    const rows = cards.map((c) => ({
      "Εταιρεία": c.company || "",
      "Επώνυμο": c.contact_surname || "",
      "Όνομα": c.contact_name || "",
      "Τίτλος": c.title || "",
      "Email": c.email || "",
      "Κινητό": c.mobile_phone || "",
      "Ημερομηνία": new Date(c.created_at).toLocaleDateString("el-GR"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BusinessCards");
    XLSX.writeFile(wb, `business_cards_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: `✅ Εξαγωγή ${rows.length} επαφών ολοκληρώθηκε!` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Επαγγελματικές Κάρτες</h2>
          <p className="text-sm text-muted-foreground">Σαρώστε κάρτες και εξάγετε επαφές σε Excel</p>
        </div>
        <div className="flex gap-2">
          {(cards?.length ?? 0) > 0 && (
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="mr-2 h-4 w-4" />Excel
            </Button>
          )}
          <UploadCardDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !cards?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <ContactRound className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Δεν υπάρχουν επαγγελματικές κάρτες ακόμα</p>
          <p className="text-sm text-muted-foreground/70">Ανεβάστε μια φωτογραφία κάρτας για να ξεκινήσετε</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} onDelete={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
