import { Mail, ScanText, FileText, Database, Clock, CheckCircle2, AlertCircle, ArrowRight, UserCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell } from
"recharts";

const pipelineSteps = [
{ icon: Mail, label: "Email", color: "text-info" },
{ icon: ScanText, label: "OCR", color: "text-accent" },
{ icon: FileText, label: "Draft", color: "text-primary" },
{ icon: CheckCircle2, label: "Έγκριση", color: "text-success" },
{ icon: Database, label: "ERP", color: "text-success" },
{ icon: UserCheck, label: "Λογιστής", color: "text-warning" }];


const statusConfig: Record<string, {label: string;shortLabel: string;className: string;icon: typeof CheckCircle2;barColor: string;}> = {
  draft: { label: "Draft", shortLabel: "Draft", className: "bg-info/10 text-info", icon: Clock, barColor: "hsl(210 60% 50%)" },
  review: { label: "Αναμονή Ελέγχου", shortLabel: "Αναμονή", className: "bg-warning/10 text-warning", icon: AlertCircle, barColor: "hsl(38 92% 50%)" },
  approved: { label: "Εγκρίθηκε", shortLabel: "Εγκρίθηκε", className: "bg-success/10 text-success", icon: CheckCircle2, barColor: "hsl(152 60% 42%)" },
  submitted: { label: "Υποβλήθηκε στο ERP", shortLabel: "ERP", className: "bg-success/10 text-success", icon: CheckCircle2, barColor: "hsl(152 50% 35%)" },
  accountant_pending: { label: "Αναμονή Λογιστή", shortLabel: "Λογ. Αναμ.", className: "bg-warning/10 text-warning", icon: AlertCircle, barColor: "hsl(38 80% 45%)" },
  accountant_approved: { label: "Εγκρίθηκε (Λογιστής)", shortLabel: "Λογ. Εγκρ.", className: "bg-success/10 text-success", icon: CheckCircle2, barColor: "hsl(152 60% 60%)" },
  error: { label: "Σφάλμα", shortLabel: "Σφάλμα", className: "bg-destructive/10 text-destructive", icon: AlertCircle, barColor: "hsl(0 72% 51%)" }
};

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const entry = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-2 shadow-elevated">
        <p className="text-sm font-medium text-card-foreground">{entry.label}</p>
        <p className="text-2xl font-semibold text-primary">{payload[0].value}</p>
        <p className="text-xs text-muted-foreground">τιμολόγια</p>
      </div>);

  }
  return null;
}

export default function PipelineView() {
  const { data: invoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("status, created_at");
      if (error) throw error;
      return data;
    }
  });

  const stageCounts = Object.entries(statusConfig).map(([key, cfg]) => ({
    status: key,
    label: cfg.label,
    shortLabel: cfg.shortLabel,
    count: invoices?.filter((inv) => inv.status === key).length ?? 0,
    barColor: cfg.barColor,
    className: cfg.className,
    icon: cfg.icon
  }));

  const total = invoices?.length ?? 0;
  const today = invoices?.filter((inv) => {
    const d = new Date(inv.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length ?? 0;

  const draftCount = stageCounts.find((s) => s.status === "draft")?.count ?? 0;
  const reviewCount = stageCounts.find((s) => s.status === "review")?.count ?? 0;
  const doneCount =
  (stageCounts.find((s) => s.status === "approved")?.count ?? 0) + (
  stageCounts.find((s) => s.status === "submitted")?.count ?? 0) + (
  stageCounts.find((s) => s.status === "accountant_approved")?.count ?? 0);

  return (
    <div className="space-y-8">
      {/* Pipeline Flow */}
      <div className="rounded-xl border border-border bg-card px-6 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline</span>
          {pipelineSteps.map((step, i) =>
          <div key={step.label} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5">
                <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                <span className="text-xs font-medium text-card-foreground">{step.label}</span>
              </div>
              {i < pipelineSteps.length - 1 &&
            <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
            }
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
        { label: "Σήμερα", value: today, sub: "νέα τιμολόγια" },
        { label: "Σε Draft", value: draftCount, sub: "αναμένουν επεξεργασία" },
        { label: "Αναμονή ελέγχου", value: reviewCount, sub: "προς έγκριση" },
        { label: "Ολοκληρωμένα", value: doneCount, sub: "εγκεκριμένα" }].
        map((stat) =>
        <div key={stat.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold text-card-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
          </div>
        )}
      </div>

      {/* BI: Invoice Stage Distribution */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-6">
          <h2 className="font-sans text-lg font-semibold text-card-foreground">Κατανομή ανά Στάδιο</h2>
          <p className="text-sm text-muted-foreground">Σύνολο: {total} τιμολόγ{total === 1 ? "ιο" : "ια"}</p>
        </div>

        {/* Stage breakdown cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {stageCounts.map((stage) => {
            const Icon = stage.icon;
            const pct = total > 0 ? Math.round(stage.count / total * 100) : 0;
            return;










          })}
        </div>

        {/* Bar Chart */}
        <div className="w-full">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stageCounts} barCategoryGap="20%" margin={{ bottom: 5, left: 0, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={0} />

              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={28} />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--secondary))" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} minPointSize={4}>
                {stageCounts.map((entry) =>
                <Cell key={entry.status} fill={entry.barColor} />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>);

}