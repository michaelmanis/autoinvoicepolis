import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";

type AuditEntry = {
  id: string;
  invoice_id: string;
  action: string;
  user_id: string;
  user_email: string | null;
  metadata: any;
  created_at: string;
};

const actionLabels: Record<string, { label: string; emoji: string }> = {
  approved: { label: "Έγκριση", emoji: "✅" },
  rejected: { label: "Απόρριψη", emoji: "❌" },
  erp_posted: { label: "Αποστολή ERP", emoji: "📤" },
  status_change: { label: "Αλλαγή Status", emoji: "🔄" },
  created: { label: "Δημιουργία", emoji: "📝" },
  deleted: { label: "Διαγραφή", emoji: "🗑️" },
  archived: { label: "Αρχειοθέτηση", emoji: "📦" },
};

export default function AuditLogTab() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as AuditEntry[];
    },
  });

  const filtered = entries.filter((e) => {
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (e.user_email || "").toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.invoice_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueActions = [...new Set(entries.map((e) => e.action))];

  const handleExport = () => {
    const rows = filtered.map((e) => ({
      "Ημ/νία": new Date(e.created_at).toLocaleString("el-GR"),
      "Ενέργεια": actionLabels[e.action]?.label || e.action,
      "Email": e.user_email || e.user_id,
      "Invoice ID": e.invoice_id,
      "Metadata": JSON.stringify(e.metadata),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
    XLSX.writeFile(wb, `audit_log_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <History className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-card-foreground">Ιστορικό Ενεργειών</h3>
          <p className="text-xs text-muted-foreground">Κεντρική προβολή όλων των ενεργειών στο σύστημα</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="mr-1 h-3 w-3" /> Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση email, action, invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Όλες οι ενέργειες" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες οι ενέργειες</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabels[a]?.emoji || "•"} {actionLabels[a]?.label || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">Δεν βρέθηκαν ενέργειες.</p>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {filtered.map((e) => {
            const info = actionLabels[e.action] || { label: e.action, emoji: "•" };
            return (
              <div
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <span className="text-lg leading-none mt-0.5">{info.emoji}</span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-card-foreground">{info.label}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      {e.invoice_id.slice(0, 8)}…
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {e.user_email || e.user_id.slice(0, 8) + "…"} · {new Date(e.created_at).toLocaleString("el-GR")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Εμφανίζονται {filtered.length} από {entries.length} εγγραφές
      </p>
    </div>
  );
}
