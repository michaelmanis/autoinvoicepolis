import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, FolderOpen, Trash2, FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  invoice_count?: number;
};

export default function ProjectsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, invoices(id, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        invoice_count: p.invoices?.length ?? 0,
        invoices: p.invoices ?? [],
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("projects").insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project δημιουργήθηκε!" });
      setOpen(false);
      setForm({ name: "", description: "" });
    },
    onError: (err: any) => {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Διαγράφηκε" });
    },
  });

  const statusCounts = (invoices: any[]) => {
    const draft = invoices.filter(i => i.status === "draft").length;
    const approved = invoices.filter(i => ["approved", "submitted"].includes(i.status)).length;
    const accountant = invoices.filter(i => i.status === "accountant_pending").length;
    const done = invoices.filter(i => i.status === "accountant_approved").length;
    return { draft, approved, accountant, done };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Projects</h2>
          <p className="text-sm text-muted-foreground">Οργανώστε τα τιμολόγιά σας ανά έργο</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Νέο Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Δημιουργία Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Όνομα Project *</Label>
                <Input
                  placeholder="π.χ. Κατασκευή Αποθήκης 2026"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Περιγραφή</Label>
                <Textarea
                  placeholder="Προαιρετική περιγραφή..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!form.name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Δημιουργία..." : "Δημιουργία Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !projects?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 gap-3">
          <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Δεν υπάρχουν projects ακόμα</p>
          <p className="text-sm text-muted-foreground/70">Δημιουργήστε ένα project για να ομαδοποιήσετε τα τιμολόγια σας</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj: any) => {
            const counts = statusCounts(proj.invoices ?? []);
            return (
              <div
                key={proj.id}
                className="rounded-xl border border-border bg-card p-5 shadow-card flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-card-foreground truncate">{proj.name}</p>
                      {proj.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{proj.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => deleteMutation.mutate(proj.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {/* Invoice stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Σύνολο</span>
                    <span className="ml-auto text-sm font-semibold text-card-foreground">{proj.invoice_count}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-info/10 px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-info" />
                    <span className="text-xs text-info">Draft</span>
                    <span className="ml-auto text-sm font-semibold text-info">{counts.draft}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs text-success">Εγκρίθηκε</span>
                    <span className="ml-auto text-sm font-semibold text-success">{counts.approved}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 text-warning" />
                    <span className="text-xs text-warning">Λογιστής</span>
                    <span className="ml-auto text-sm font-semibold text-warning">{counts.accountant + counts.done}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Δημιουργήθηκε: {new Date(proj.created_at).toLocaleDateString("el-GR")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
