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
  Cell,
} from "recharts";

const pipelineSteps = [
  { icon: Mail, label: "Email", color: "text-info" },
  { icon: ScanText, label: "OCR", color: "text-accent" },
  { icon: FileText, label: "Draft", color: "text-primary" },
  { icon: CheckCircle2, label: "Έγκριση", color: "text-success" },
  { icon: Database, label: "ERP", color: "text-success" },
  { icon: UserCheck, label: "Λογιστής", color: "text-warning" },
];

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2; barColor: string }> = {
  draft: { label: "Draft", className: "bg-info/10 text-info", icon: Clock, barColor: "hsl(210 60% 50%)" },
  review: { label: "Αναμονή Ελέγχου", className: "bg-warning/10 text-warning", icon: AlertCircle, barColor: "hsl(38 92% 50%)" },
  approved: { label: "Εγκρίθηκε", className: "bg-success/10 text-success", icon: CheckCircle2, barColor: "hsl(152 60% 42%)" },
  submitted: { label: "Υποβλήθηκε στο ERP", className: "bg-success/10 text-success", icon: CheckCircle2, barColor: "hsl(152 60% 42%)" },
  accountant_pending: { label: "Αναμονή Λογιστή", className: "bg-warning/10 text-warning", icon: AlertCircle, barColor: "hsl(38 92% 50%)" },
  accountant_approved: { label: "Εγκρίθηκε (Λογιστής)", className: "bg-success/10 text-success", icon: CheckCircle2, barColor: "hsl(152 60% 60%)" },
  error: { label: "Σφάλμα", className: "bg-destructive/10 text-destructive", icon: AlertCircle, barColor: "hsl(0 72% 51%)" },
};

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-2 shadow-elevated">
        <p className="text-sm font-medium text-card-foreground">{label}</p>
        <p className="text-2xl font-semibold text-primary">{payload[0].value}</p>
        <p className="text-xs text-muted-foreground">τιμολόγια</p>
      </div>
    );
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
    },
  });

  // Build stage counts
  const stageCounts = Object.entries(statusConfig).map(([key, cfg]) => ({
    status: key,
    label: cfg.label,
    count: invoices?.filter((inv) => inv.status === key).length ?? 0,
    barColor: cfg.barColor,
    className: cfg.className,
    icon: cfg.icon,
  }));

  const total = invoices?.length ?? 0;
  const today = invoices?.filter((inv) => {
    const d = new Date(inv.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length ?? 0;

  return (
    <div className="space-y-8">
      {/* Pipeline Flow */}
      <div className="rounded-xl border border-border bg-card px-6 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline</span>
          {pipelineSteps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5">
                <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                <span className="text-xs font-medium text-card-foreground">{step.label}</span>
              </div>
              {i < pipelineSteps.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Σήμερα", value: String(today), sub: "νέα τιμολόγια" },
          { label: "Σε επεξεργασία", value: String(stageCounts.find(s => s.status === "draft")?.count ?? 0), sub: "σε draft" },
          { label: "Αναμονή ελέγχου", value: String(stageCounts.find(s => s.status === "review")?.count ?? 0), sub: "drafts" },
          { label: "Ολοκληρωμένα", value: String((stageCounts.find(s => s.status === "approved")?.count ?? 0) + (stageCounts.find(s => s.status === "submitted")?.count ?? 0)), sub: "εγκεκριμένα" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold text-card-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* BI: Invoice Stage Distribution */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-sans text-lg font-semibold text-card-foreground">Κατανομή ανά Στάδιο</h2>
            <p className="text-sm text-muted-foreground">Σύνολο: {total} τιμολόγια</p>
          </div>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Δεν υπάρχουν τιμολόγια ακόμα</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Bar Chart */}
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stageCounts} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--secondary))" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stageCounts.map((entry) => (
                      <Cell key={entry.status} fill={entry.barColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stage breakdown cards */}
            <div className="grid grid-cols-2 gap-3 lg:w-64 lg:grid-cols-1">
              {stageCounts.map((stage) => {
                const Icon = stage.icon;
                const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
                return (
                  <div key={stage.status} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
                    <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${stage.className}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground">{stage.label}</p>
                      <p className="text-lg font-semibold text-card-foreground leading-tight">{stage.count}</p>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
