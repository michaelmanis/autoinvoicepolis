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
  Building2, UserPlus, X, ChevronRight, Ban, History, FileSpreadsheet,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AuditLogTab from "@/components/admin/AuditLogTab";
import DataExportTab from "@/components/admin/DataExportTab";

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

type EnrichedUser = {
  id: string;
  email: string;
  created_at: string;
  banned_until: string | null;
  roles: { id: string; role: string }[];
  memberships: { id: string; company_id: string; company_name: string; permissions: string[] }[];
};

type CompanyOption = { id: string; name: string };

function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "accountant" | "user">("user");
  const [creatingUser, setCreatingUser] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [assignCompanyId, setAssignCompanyId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  // Fetch all users with roles & memberships
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-users");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { users: EnrichedUser[]; companies: CompanyOption[] };
    },
  });

  const users = data?.users ?? [];
  const companies = data?.companies ?? [];

  const roleLabel: Record<string, string> = {
    admin: "👑 Admin",
    accountant: "📋 Λογιστής",
    user: "👤 Υπάλληλος",
  };

  const roleBadgeClass: Record<string, string> = {
    admin: "bg-warning/15 text-warning border-warning/30",
    accountant: "bg-info/15 text-info border-info/30",
    user: "bg-muted text-muted-foreground border-border",
  };

  const handleDeleteRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) toast({ title: "Σφάλμα", description: error.message, variant: "destructive" });
    else {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast({ title: "Ρόλος αφαιρέθηκε." });
    }
  };

  const handleChangeRole = async (userId: string, oldRoleId: string | null, newRoleValue: string) => {
    if (oldRoleId) {
      const { error } = await supabase.from("user_roles").update({ role: newRoleValue } as any).eq("id", oldRoleId);
      if (error) { toast({ title: "Σφάλμα", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRoleValue } as any);
      if (error) { toast({ title: "Σφάλμα", description: error.message, variant: "destructive" }); return; }
    }
    queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
    toast({ title: "✅ Ρόλος ενημερώθηκε!" });
  };

  const handleAssignCompany = async (userId: string) => {
    if (!assignCompanyId) return;
    const { error } = await supabase.from("company_members").insert({
      company_id: assignCompanyId,
      user_id: userId,
      permissions: ["view_invoices"],
    } as any);
    if (error) toast({ title: "Σφάλμα", description: error.message, variant: "destructive" });
    else {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast({ title: "✅ Ανατέθηκε σε εταιρεία!" });
      setAssignCompanyId("");
    }
  };

  const handleRemoveMembership = async (membershipId: string) => {
    const { error } = await supabase.from("company_members").delete().eq("id", membershipId);
    if (error) toast({ title: "Σφάλμα", description: error.message, variant: "destructive" });
    else {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast({ title: "Αφαιρέθηκε από εταιρεία." });
    }
  };

  const handleBanUser = async (userId: string, ban: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: ban ? "ban" : "unban", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast({ title: ban ? "Χρήστης απενεργοποιήθηκε." : "Χρήστης ενεργοποιήθηκε." });
    } catch (err: any) {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast({ title: "Χρήστης διαγράφηκε." });
    } catch (err: any) {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    } finally {
      setConfirmDeleteUserId(null);
    }
  };

  const handleBulkAssignRole = async () => {
    if (selectedUsers.size === 0 || !bulkRole) return;
    setBulkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "bulk_assign_role", user_id: [...selectedUsers].join(","), role: bulkRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast({ title: `✅ Ρόλος ανατέθηκε σε ${selectedUsers.size} χρήστες!` });
      setSelectedUsers(new Set());
      setBulkRole("");
    } catch (err: any) {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(users.map(u => u.id)));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-card-foreground">Διαχείριση Χρηστών</h3>
          <p className="text-xs text-muted-foreground">Ρόλοι, εταιρείες & δικαιώματα</p>
        </div>
      </div>

      {/* Create user */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-medium text-card-foreground">Δημιουργία Νέου Χρήστη</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Email *</Label>
            <Input placeholder="user@example.com" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Κωδικός *</Label>
            <Input placeholder="Τουλάχιστον 6 χαρακτήρες" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ρόλος</Label>
          <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">👤 Υπάλληλος</SelectItem>
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
              queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
              toast({ title: "✅ Χρήστης δημιουργήθηκε!" });
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

      {/* Bulk actions bar */}
      {selectedUsers.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <Checkbox
            checked={selectedUsers.size === users.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium text-card-foreground">
            {selectedUsers.size} επιλεγμένοι
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={bulkRole} onValueChange={setBulkRole}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Ρόλος..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">👤 Υπάλληλος</SelectItem>
                <SelectItem value="accountant">📋 Λογιστής</SelectItem>
                <SelectItem value="admin">👑 Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="default" className="h-8 text-xs" disabled={!bulkRole || bulkLoading} onClick={handleBulkAssignRole}>
              {bulkLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Ανάθεση Ρόλου
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedUsers(new Set())}>
              Ακύρωση
            </Button>
          </div>
        </div>
      )}

      {/* Users list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : users.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">Δεν υπάρχουν χρήστες.</p>
      ) : (
        <div className="space-y-2">
          {/* Select all */}
          <div className="flex items-center gap-2 px-4 py-1">
            <Checkbox
              checked={selectedUsers.size === users.length && users.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-muted-foreground">Επιλογή όλων</span>
          </div>
          {users.map((u) => {
            const isExpanded = expandedUser === u.id;
            const primaryRole = u.roles[0];
            const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date();
            return (
              <div key={u.id} className={`rounded-lg border transition-all ${isBanned ? "border-destructive/30 bg-destructive/5" : isExpanded ? "border-primary bg-primary/5" : "border-border"}`}>
                {/* User header */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <Checkbox
                    checked={selectedUsers.has(u.id)}
                    onCheckedChange={() => toggleSelectUser(u.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                    className="flex-1 flex items-center justify-between text-left min-w-0"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-card-foreground truncate">{u.email}</p>
                        {isBanned && (
                          <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            <Ban className="mr-1 h-3 w-3" />Απενεργοποιημένος
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {u.roles.length > 0 ? u.roles.map((r) => (
                          <span key={r.id} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadgeClass[r.role] || roleBadgeClass.user}`}>
                            {roleLabel[r.role] || r.role}
                          </span>
                        )) : (
                          <span className="text-xs text-muted-foreground">Χωρίς ρόλο</span>
                        )}
                        {u.memberships.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {u.memberships.map((m) => m.company_name).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-4">
                    {/* Role management */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ρόλος</p>
                      <Select
                        value={primaryRole?.role || ""}
                        onValueChange={(v) => handleChangeRole(u.id, primaryRole?.id || null, v)}
                      >
                        <SelectTrigger className="w-48 h-8 text-sm"><SelectValue placeholder="Επιλέξτε ρόλο" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">👤 Υπάλληλος</SelectItem>
                          <SelectItem value="accountant">📋 Λογιστής</SelectItem>
                          <SelectItem value="admin">👑 Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      {primaryRole && (
                        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => handleDeleteRole(primaryRole.id)}>
                          <Trash2 className="mr-1 h-3 w-3" /> Αφαίρεση ρόλου
                        </Button>
                      )}
                    </div>

                    {/* Company assignments */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Εταιρείες</p>
                      {u.memberships.length > 0 ? (
                        <div className="space-y-1.5">
                          {u.memberships.map((m) => (
                            <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-card-foreground">{m.company_name}</p>
                                <p className="text-xs text-muted-foreground">{m.permissions.join(", ")}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMembership(m.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Δεν ανήκει σε εταιρεία.</p>
                      )}

                      {/* Assign to company */}
                      <div className="flex items-center gap-2 pt-1">
                        <Select value={assignCompanyId} onValueChange={setAssignCompanyId}>
                          <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="Επιλέξτε εταιρεία..." /></SelectTrigger>
                          <SelectContent>
                            {companies
                              .filter((c) => !u.memberships.some((m) => m.company_id === c.id))
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!assignCompanyId} onClick={() => handleAssignCompany(u.id)}>
                          <Plus className="mr-1 h-3 w-3" /> Ανάθεση
                        </Button>
                      </div>
                    </div>

                    {/* Ban / Delete actions */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ενέργειες Χρήστη</p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isBanned ? "default" : "outline"}
                          className="text-xs"
                          onClick={() => handleBanUser(u.id, !isBanned)}
                        >
                          <Ban className="mr-1 h-3 w-3" />
                          {isBanned ? "Ενεργοποίηση" : "Απενεργοποίηση"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs"
                          onClick={() => setConfirmDeleteUserId(u.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Διαγραφή
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!confirmDeleteUserId} onOpenChange={(open) => !open && setConfirmDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή Χρήστη</AlertDialogTitle>
            <AlertDialogDescription>
              Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον χρήστη; Η ενέργεια είναι μη αναστρέψιμη και θα αφαιρεθούν όλοι οι ρόλοι και οι συνδέσεις εταιρειών.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteUserId && handleDeleteUser(confirmDeleteUserId)}
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [confirmDeleteCompanyId, setConfirmDeleteCompanyId] = useState<string | null>(null);
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
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteCompanyId(c.id); }}
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

      {/* Delete company confirmation */}
      <AlertDialog open={!!confirmDeleteCompanyId} onOpenChange={(open) => !open && setConfirmDeleteCompanyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή Εταιρείας</AlertDialogTitle>
            <AlertDialogDescription>
              Είστε σίγουροι ότι θέλετε να διαγράψετε αυτήν την εταιρεία; Θα αφαιρεθούν και όλα τα μέλη της.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDeleteCompanyId) { deleteCompany.mutate(confirmDeleteCompanyId); setConfirmDeleteCompanyId(null); } }}
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <TabsList className="w-full justify-start flex-wrap">
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
          {isAdmin && (
            <TabsTrigger value="audit" className="gap-2">
              <History className="h-4 w-4" />Ιστορικό
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="export" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />Export
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
          {isAdmin && (
            <TabsContent value="audit" className="mt-0">
              <AuditLogTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="export" className="mt-0">
              <DataExportTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
