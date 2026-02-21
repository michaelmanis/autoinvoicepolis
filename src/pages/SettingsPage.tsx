import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Save, Loader2, CheckCircle2, Plug, User, Shield, Palette, Trash2, Plus,
  Building2, UserPlus, X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Types ───────────────────────────────────────────────────────────────────

type ErpSettings = {
  id: string;
  erp_type: string;
  endpoint_url: string;
  api_key: string;
  company_id: string;
  branch_id: string;
  is_enabled: boolean;
};

type UserRole = {
  id: string;
  user_id: string;
  role: "admin" | "accountant" | "user";
  created_at: string;
};

// ─── ERP Tab ─────────────────────────────────────────────────────────────────

function ErpTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["erp-settings"],
    queryFn: async (): Promise<ErpSettings> => {
      const { data, error } = await supabase
        .from("erp_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data as ErpSettings;
    },
  });

  const [form, setForm] = useState<Omit<ErpSettings, "id">>({
    erp_type: "softone",
    endpoint_url: "",
    api_key: "",
    company_id: "",
    branch_id: "",
    is_enabled: false,
  });

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  const patch = (k: keyof typeof form, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error("Settings not found");
      const { error } = await supabase.from("erp_settings").update(form).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-settings"] });
      toast({ title: "✅ Αποθηκεύτηκε!" });
    },
    onError: (err: any) =>
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-card-foreground">ERP Integration</h3>
          <p className="text-xs text-muted-foreground">Softone · Entersoft · Custom</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {form.is_enabled ? "Ενεργό" : "Ανενεργό"}
          </span>
          <Switch checked={form.is_enabled} onCheckedChange={(v) => patch("is_enabled", v)} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Τύπος ERP</Label>
          <Select value={form.erp_type} onValueChange={(v) => patch("erp_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="softone">Softone</SelectItem>
              <SelectItem value="entersoft">Entersoft</SelectItem>
              <SelectItem value="custom">Custom (generic JSON)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Endpoint URL</Label>
          <Input
            placeholder="https://your-erp.com/api/invoices"
            value={form.endpoint_url}
            onChange={(e) => patch("endpoint_url", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {form.erp_type === "softone"
              ? "Π.χ. https://erp.softone.gr/api/setData"
              : form.erp_type === "entersoft"
              ? "Π.χ. https://api.entersoft.gr/ES/api/..."
              : "Το URL στο οποίο θα αποστέλλεται το JSON payload"}
          </p>
        </div>

        <div className="space-y-2">
          <Label>API Key / Bearer Token</Label>
          <Input
            type="password"
            placeholder="••••••••••••••••"
            value={form.api_key}
            onChange={(e) => patch("api_key", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Company ID</Label>
            <Input
              placeholder="1001"
              value={form.company_id}
              onChange={(e) => patch("company_id", e.target.value)}
            />
          </div>
          {form.erp_type === "entersoft" && (
            <div className="space-y-2">
              <Label>Branch ID</Label>
              <Input
                placeholder="0"
                value={form.branch_id}
                onChange={(e) => patch("branch_id", e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Πεδία που αποστέλλονται
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "invoice_number", "supplier", "supplier_vat",
            "amount", "currency", "invoice_date", "due_date", "items",
            ...(form.erp_type === "softone" ? ["clientID", "OBJECT"] : []),
            ...(form.erp_type === "entersoft" ? ["documentType", "branchId"] : []),
          ].map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-mono text-card-foreground">
              <CheckCircle2 className="h-2.5 w-2.5 text-success" />
              {f}
            </span>
          ))}
        </div>
      </div>

      <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Αποθήκευση...</>
          : <><Save className="mr-2 h-4 w-4" />Αποθήκευση Ρυθμίσεων</>}
      </Button>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Σφάλμα", description: "Οι κωδικοί δεν ταιριάζουν.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Σφάλμα", description: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast({ title: "Σφάλμα", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Κωδικός αλλάχτηκε επιτυχώς!" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Account info */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-card-foreground">Προφίλ Χρήστη</h3>
          <p className="text-xs text-muted-foreground">Διαχείριση στοιχείων λογαριασμού</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={user?.email ?? ""} disabled className="bg-muted/40" />
        <p className="text-xs text-muted-foreground">Το email δεν μπορεί να αλλαχτεί.</p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <p className="text-sm font-medium text-card-foreground">Αλλαγή Κωδικού</p>
        <div className="space-y-2">
          <Label>Νέος Κωδικός</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Επιβεβαίωση Κωδικού</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <Button onClick={handlePasswordChange} disabled={loading || !newPassword}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Αποθήκευση...</> : <><Save className="mr-2 h-4 w-4" />Αλλαγή Κωδικού</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Users Tab (admin only) ───────────────────────────────────────────────────

function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "accountant" | "user">("user");
  const [creatingUser, setCreatingUser] = useState(false);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user-roles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").order("created_at");
      if (error) throw error;
      return data as UserRole[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles-all"] });
      toast({ title: "✅ Ρόλος αφαιρέθηκε." });
    },
    onError: (err: any) => toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  const roleLabel: Record<string, string> = {
    admin: "👑 Admin",
    accountant: "📋 Λογιστής",
    user: "👤 Χρήστης",
  };

  const roleBadgeClass: Record<string, string> = {
    admin: "bg-warning/15 text-warning border-warning/30",
    accountant: "bg-info/15 text-info border-info/30",
    user: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-card-foreground">Διαχείριση Χρηστών</h3>
          <p className="text-xs text-muted-foreground">Ρόλοι & δικαιώματα χρηστών</p>
        </div>
      </div>

      {/* Add role by creating user */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-medium text-card-foreground">Δημιουργία Χρήστη & Ανάθεση Ρόλου</p>
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input
            placeholder="user@example.com"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Κωδικός *</Label>
          <Input
            placeholder="Τουλάχιστον 6 χαρακτήρες"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Ρόλος</Label>
          <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">👤 Χρήστης</SelectItem>
              <SelectItem value="accountant">📋 Λογιστής</SelectItem>
              <SelectItem value="admin">👑 Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          disabled={!newEmail.trim() || !newPassword.trim() || creatingUser}
          onClick={async () => {
            setCreatingUser(true);
            try {
              const { data, error } = await supabase.functions.invoke("create-user", {
                body: { email: newEmail.trim(), password: newPassword, role: newRole },
              });
              if (error) throw error;
              if (data?.error) throw new Error(data.error);
              queryClient.invalidateQueries({ queryKey: ["user-roles-all"] });
              toast({ title: "✅ Χρήστης δημιουργήθηκε με ρόλο!" });
              setNewEmail("");
              setNewPassword("");
            } catch (err: any) {
              toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
            } finally {
              setCreatingUser(false);
            }
          }}
        >
          {creatingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Δημιουργία
        </Button>
      </div>

      {/* Roles list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : roles.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">Δεν υπάρχουν ρόλοι.</p>
      ) : (
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-mono text-muted-foreground truncate">{r.user_id}</p>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadgeClass[r.role]}`}>
                  {roleLabel[r.role]}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => deleteMutation.mutate(r.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Theme Tab ────────────────────────────────────────────────────────────────

function ThemeTab() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    return (localStorage.getItem("theme") as any) ?? "system";
  });

  const applyTheme = (t: "light" | "dark" | "system") => {
    setTheme(t);
    localStorage.setItem("theme", t);
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  };

  const options: { value: "light" | "dark" | "system"; label: string; desc: string }[] = [
    { value: "light", label: "☀️ Φωτεινό", desc: "Ανοιχτό θέμα" },
    { value: "dark", label: "🌙 Σκοτεινό", desc: "Σκοτεινό θέμα" },
    { value: "system", label: "💻 Σύστημα", desc: "Ακολουθεί τις ρυθμίσεις συστήματος" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-card-foreground">Εμφάνιση</h3>
          <p className="text-xs text-muted-foreground">Θέμα χρωμάτων εφαρμογής</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => applyTheme(opt.value)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
              theme === opt.value
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <span className="text-2xl">{opt.label.split(" ")[0]}</span>
            <span className="text-sm font-medium text-card-foreground">{opt.label.split(" ")[1]}</span>
            <span className="text-xs text-muted-foreground">{opt.desc}</span>
            {theme === opt.value && (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Color palette preview */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-medium text-card-foreground">Χρώματα</p>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Primary", cls: "bg-primary" },
            { label: "Secondary", cls: "bg-secondary" },
            { label: "Accent", cls: "bg-accent" },
            { label: "Success", cls: "bg-success" },
            { label: "Warning", cls: "bg-warning" },
            { label: "Destructive", cls: "bg-destructive" },
          ].map((c) => (
            <div key={c.label} className="flex flex-col items-center gap-1">
              <div className={`h-8 w-8 rounded-lg ${c.cls} shadow-sm`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Clients Tab (admin only) ─────────────────────────────────────────────────

const PERMISSION_OPTIONS = [
  { value: "view_invoices", label: "Προβολή τιμολογίων" },
  { value: "upload_edit", label: "Ανέβασμα & επεξεργασία" },
  { value: "approve_erp", label: "Έγκριση & αποστολή ERP" },
  { value: "manage_projects", label: "Διαχείριση Projects" },
] as const;

type Company = {
  id: string;
  name: string;
  vat_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type CompanyMember = {
  id: string;
  company_id: string;
  user_id: string;
  permissions: string[];
  created_at: string;
};

function ClientsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", vat_number: "", address: "", phone: "", email: "" });
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberPerms, setNewMemberPerms] = useState<string[]>(["view_invoices"]);
  const [creatingMember, setCreatingMember] = useState(false);

  // Fetch companies
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return data as Company[];
    },
  });

  // Fetch members for selected company
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["company-members", selectedCompany],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const { data, error } = await supabase
        .from("company_members")
        .select("*")
        .eq("company_id", selectedCompany)
        .order("created_at");
      if (error) throw error;
      return data as CompanyMember[];
    },
    enabled: !!selectedCompany,
  });

  // Create company
  const createCompany = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").insert(newCompany as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "✅ Εταιρεία δημιουργήθηκε!" });
      setNewCompany({ name: "", vat_number: "", address: "", phone: "", email: "" });
      setShowAddCompany(false);
    },
    onError: (err: any) => toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  // Delete company
  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      if (selectedCompany) setSelectedCompany(null);
      toast({ title: "Εταιρεία διαγράφηκε." });
    },
    onError: (err: any) => toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  // Add member via create-user edge function
  const handleAddMember = async () => {
    if (!newMemberEmail.trim() || !newMemberPassword.trim()) return;
    setCreatingMember(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newMemberEmail.trim(),
          password: newMemberPassword,
          company_id: selectedCompany,
          permissions: newMemberPerms,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["company-members", selectedCompany] });
      toast({ title: "✅ Χρήστης δημιουργήθηκε & προστέθηκε!" });
      setNewMemberEmail("");
      setNewMemberPassword("");
      setNewMemberPerms(["view_invoices"]);
    } catch (err: any) {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    } finally {
      setCreatingMember(false);
    }
  };

  // Remove member
  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-members", selectedCompany] });
      toast({ title: "Μέλος αφαιρέθηκε." });
    },
    onError: (err: any) => toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  // Update member permissions
  const updatePerms = useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: string[] }) => {
      const { error } = await supabase
        .from("company_members")
        .update({ permissions } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-members", selectedCompany] });
      toast({ title: "Δικαιώματα ενημερώθηκαν." });
    },
    onError: (err: any) => toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  const togglePerm = (member: CompanyMember, perm: string) => {
    const current = member.permissions || [];
    const next = current.includes(perm)
      ? current.filter((p) => p !== perm)
      : [...current, perm];
    updatePerms.mutate({ id: member.id, permissions: next });
  };

  const activeCompany = companies.find((c) => c.id === selectedCompany);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-card-foreground">Διαχείριση Πελατών</h3>
          <p className="text-xs text-muted-foreground">Εταιρείες, χρήστες & δικαιώματα</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddCompany(true)}>
          <Plus className="mr-1 h-3 w-3" /> Νέα Εταιρεία
        </Button>
      </div>

      {/* Add company form */}
      {showAddCompany && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-card-foreground">Νέα Εταιρεία</p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddCompany(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Επωνυμία *</Label>
              <Input value={newCompany.name} onChange={(e) => setNewCompany(p => ({ ...p, name: e.target.value }))} placeholder="π.χ. ACME ΑΕ" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ΑΦΜ</Label>
              <Input value={newCompany.vat_number} onChange={(e) => setNewCompany(p => ({ ...p, vat_number: e.target.value }))} placeholder="123456789" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={newCompany.email} onChange={(e) => setNewCompany(p => ({ ...p, email: e.target.value }))} placeholder="info@acme.gr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Τηλέφωνο</Label>
              <Input value={newCompany.phone} onChange={(e) => setNewCompany(p => ({ ...p, phone: e.target.value }))} placeholder="210-1234567" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Διεύθυνση</Label>
              <Input value={newCompany.address} onChange={(e) => setNewCompany(p => ({ ...p, address: e.target.value }))} placeholder="Οδός, Πόλη" />
            </div>
          </div>
          <Button size="sm" onClick={() => createCompany.mutate()} disabled={!newCompany.name.trim() || createCompany.isPending}>
            {createCompany.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            Δημιουργία
          </Button>
        </div>
      )}

      {/* Company list */}
      {loadingCompanies ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : companies.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">Δεν υπάρχουν εταιρείες. Δημιουργήστε μία για να ξεκινήσετε.</p>
      ) : (
        <div className="space-y-2">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCompany(c.id === selectedCompany ? null : c.id)}
              className={`w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-all ${
                c.id === selectedCompany ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-card-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{[c.vat_number, c.email].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); deleteCompany.mutate(c.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </button>
          ))}
        </div>
      )}

      {/* Selected company: members */}
      {selectedCompany && activeCompany && (
        <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium text-card-foreground">{activeCompany.name} — Μέλη</h4>
          </div>

          {/* Add member */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Δημιουργία & Προσθήκη Μέλους</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  type="email"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Κωδικός *</Label>
                <Input
                  value={newMemberPassword}
                  onChange={(e) => setNewMemberPassword(e.target.value)}
                  placeholder="Τουλάχιστον 6 χαρακτήρες"
                  type="password"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                {PERMISSION_OPTIONS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={newMemberPerms.includes(p.value)}
                      onCheckedChange={(checked) => {
                        setNewMemberPerms(prev =>
                          checked ? [...prev, p.value] : prev.filter(x => x !== p.value)
                        );
                      }}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={handleAddMember} disabled={!newMemberEmail.trim() || !newMemberPassword.trim() || creatingMember}>
              {creatingMember ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <UserPlus className="mr-1 h-3 w-3" />}
              Δημιουργία Χρήστη
            </Button>
          </div>

          {/* Members list */}
          {loadingMembers ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Δεν υπάρχουν μέλη.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono text-muted-foreground truncate flex-1">{m.user_id}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeMember.mutate(m.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {PERMISSION_OPTIONS.map((p) => (
                      <label key={p.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={(m.permissions || []).includes(p.value)}
                          onCheckedChange={() => togglePerm(m, p.value)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAdmin } = useUserRole();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Ρυθμίσεις</h2>
        <p className="text-sm text-muted-foreground">
          Διαχείριση εφαρμογής και λογαριασμού
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />Προφίλ
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-2">
            <Palette className="h-4 w-4" />Εμφάνιση
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="erp" className="gap-2">
              <Plug className="h-4 w-4" />ERP
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="clients" className="gap-2">
              <Building2 className="h-4 w-4" />Πελάτες
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2">
              <Shield className="h-4 w-4" />Χρήστες
            </TabsTrigger>
          )}
        </TabsList>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <TabsContent value="profile" className="mt-0">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="theme" className="mt-0">
            <ThemeTab />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="erp" className="mt-0">
              <ErpTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="clients" className="mt-0">
              <ClientsTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="users" className="mt-0">
              <UsersTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
