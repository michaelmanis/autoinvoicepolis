import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, CheckCircle2, Plug } from "lucide-react";

type ErpSettings = {
  id: string;
  erp_type: string;
  endpoint_url: string;
  api_key: string;
  company_id: string;
  branch_id: string;
  is_enabled: boolean;
};

export default function SettingsPage() {
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
    erp_type:     "softone",
    endpoint_url: "",
    api_key:      "",
    company_id:   "",
    branch_id:    "",
    is_enabled:   false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        erp_type:     settings.erp_type,
        endpoint_url: settings.endpoint_url,
        api_key:      settings.api_key,
        company_id:   settings.company_id,
        branch_id:    settings.branch_id,
        is_enabled:   settings.is_enabled,
      });
    }
  }, [settings]);

  const patch = (k: keyof typeof form, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error("Settings not found");
      const { error } = await supabase
        .from("erp_settings")
        .update(form)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-settings"] });
      toast({ title: "✅ Αποθηκεύτηκε!" });
    },
    onError: (err: any) =>
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Ρυθμίσεις</h2>
        <p className="text-sm text-muted-foreground">
          Διαχείριση σύνδεσης με εξωτερικό ERP
        </p>
      </div>

      {/* ERP Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-5">
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
            <Switch
              checked={form.is_enabled}
              onCheckedChange={(v) => patch("is_enabled", v)}
            />
          </div>
        </div>

        <div className="space-y-4">
          {/* ERP Type */}
          <div className="space-y-2">
            <Label>Τύπος ERP</Label>
            <Select value={form.erp_type} onValueChange={(v) => patch("erp_type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="softone">Softone</SelectItem>
                <SelectItem value="entersoft">Entersoft</SelectItem>
                <SelectItem value="custom">Custom (generic JSON)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint URL */}
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

          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key / Bearer Token</Label>
            <Input
              type="password"
              placeholder="••••••••••••••••"
              value={form.api_key}
              onChange={(e) => patch("api_key", e.target.value)}
            />
          </div>

          {/* Company ID */}
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

        {/* Payload preview */}
        <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Πεδία που αποστέλλονται
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "invoice_number","supplier","supplier_vat",
              "amount","currency","invoice_date","due_date","items",
              ...(form.erp_type === "softone" ? ["clientID","OBJECT"] : []),
              ...(form.erp_type === "entersoft" ? ["documentType","branchId"] : []),
            ].map((f) => (
              <span key={f} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-mono text-card-foreground">
                <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                {f}
              </span>
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Αποθήκευση...</>
            : <><Save className="mr-2 h-4 w-4" />Αποθήκευση Ρυθμίσεων</>
          }
        </Button>
      </div>
    </div>
  );
}
