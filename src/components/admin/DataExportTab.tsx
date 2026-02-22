import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileSpreadsheet, Users, Building2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

type ExportType = "users" | "invoices" | "companies";

export default function DataExportTab() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<ExportType | null>(null);

  const handleExport = async (type: ExportType) => {
    setExporting(type);
    try {
      let rows: any[] = [];
      let filename = "";

      if (type === "invoices") {
        const { data, error } = await supabase
          .from("invoices")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        rows = (data || []).map((inv: any) => {
          // Συνένωση περιγραφών ειδών σε ένα string
          const itemDescriptions = Array.isArray(inv.items)
            ? inv.items.map((item: any) => item.description).filter(Boolean).join(" | ")
            : "";
          return {
            "Αρ. Τιμολογίου": inv.invoice_number || "",
            "Προμηθευτής": inv.supplier || "",
            "ΑΦΜ Προμηθευτή": inv.supplier_vat || "",
            "Περιγραφή Ειδών": itemDescriptions,
            "Ποσό": inv.amount || "",
            "Νόμισμα": inv.currency || "EUR",
            "Ημ/νία Τιμολογίου": inv.invoice_date || "",
            "Ημ/νία Λήξης": inv.due_date || "",
            "Κατάσταση": inv.status || "",
            "Σημειώσεις": inv.notes || "",
            "Δημιουργία": inv.created_at ? new Date(inv.created_at).toLocaleDateString("el-GR") : "",
          };
        });
        filename = `invoices_${new Date().toISOString().slice(0, 10)}.xlsx`;
      } else if (type === "companies") {
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .order("name");
        if (error) throw error;
        rows = (data || []).map((c: any) => ({
          "Επωνυμία": c.name || "",
          "ΑΦΜ": c.vat_number || "",
          "Email": c.email || "",
          "Τηλέφωνο": c.phone || "",
          "Διεύθυνση": c.address || "",
          "Δημιουργία": c.created_at ? new Date(c.created_at).toLocaleDateString("el-GR") : "",
        }));
        filename = `companies_${new Date().toISOString().slice(0, 10)}.xlsx`;
      } else if (type === "users") {
        const { data, error } = await supabase.functions.invoke("list-users");
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        rows = (data.users || []).map((u: any) => ({
          "Email": u.email || "",
          "Ρόλοι": u.roles.map((r: any) => r.role).join(", ") || "—",
          "Εταιρείες": u.memberships.map((m: any) => m.company_name).join(", ") || "—",
          "Κατάσταση": u.banned_until ? "Απενεργοποιημένος" : "Ενεργός",
          "Δημιουργία": u.created_at ? new Date(u.created_at).toLocaleDateString("el-GR") : "",
        }));
        filename = `users_${new Date().toISOString().slice(0, 10)}.xlsx`;
      }

      if (rows.length === 0) {
        toast({ title: "Δεν υπάρχουν δεδομένα για εξαγωγή." });
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type);
      XLSX.writeFile(wb, filename);
      toast({ title: `✅ Εξαγωγή ${rows.length} εγγραφών ολοκληρώθηκε!` });
    } catch (err: any) {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const exports: { type: ExportType; label: string; desc: string; icon: any }[] = [
    { type: "users", label: "Χρήστες", desc: "Email, ρόλοι, εταιρείες, κατάσταση", icon: Users },
    { type: "invoices", label: "Τιμολόγια", desc: "Όλα τα τιμολόγια με στοιχεία & κατάσταση", icon: FileText },
    { type: "companies", label: "Εταιρείες", desc: "Επωνυμία, ΑΦΜ, στοιχεία επικοινωνίας", icon: Building2 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-card-foreground">Εξαγωγή Δεδομένων</h3>
          <p className="text-xs text-muted-foreground">Κατεβάστε δεδομένα σε μορφή Excel</p>
        </div>
      </div>

      <div className="space-y-3">
        {exports.map(({ type, label, desc, icon: Icon }) => (
          <div
            key={type}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport(type)}
              disabled={exporting !== null}
            >
              {exporting === type ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Download className="mr-1 h-3 w-3" />
              )}
              Excel
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
