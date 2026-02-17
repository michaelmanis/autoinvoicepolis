import { Mail, ScanText, Truck, FileText, Database, Clock, CheckCircle2, AlertCircle, Plus } from "lucide-react";

const pipelineSteps = [
{ icon: Mail, label: "Email", description: "Λήψη email", color: "text-info" },
{ icon: ScanText, label: "OCR", description: "Αναγνώριση", color: "text-accent" },
{ icon: Truck, label: "Shipment", description: "Draft αποστολής", color: "text-primary" },
{ icon: FileText, label: "Invoice", description: "Draft τιμολογίου", color: "text-primary" },
{ icon: Database, label: "ERP", description: "Καταχώρηση", color: "text-success" },
];


const recentItems = [
{ id: "INV-2024-0891", sender: "ACME Corp", status: "completed", step: "ERP", date: "17 Φεβ 2026" },
{ id: "INV-2024-0890", sender: "Ελληνικά Τρόφιμα ΑΕ", status: "processing", step: "OCR", date: "17 Φεβ 2026" },
{ id: "INV-2024-0889", sender: "Tech Solutions", status: "review", step: "Invoice Draft", date: "16 Φεβ 2026" },
{ id: "INV-2024-0888", sender: "Μεταφορική Βορρά", status: "completed", step: "ERP", date: "16 Φεβ 2026" },
{ id: "INV-2024-0887", sender: "Global Trade Ltd", status: "error", step: "ERP", date: "15 Φεβ 2026" }];


const statusConfig: Record<string, {label: string;className: string;icon: typeof CheckCircle2;}> = {
  completed: { label: "Ολοκληρώθηκε", className: "bg-success/10 text-success", icon: CheckCircle2 },
  processing: { label: "Επεξεργασία", className: "bg-info/10 text-info", icon: Clock },
  review: { label: "Αναμονή", className: "bg-warning/10 text-warning", icon: AlertCircle },
  error: { label: "Σφάλμα", className: "bg-destructive/10 text-destructive", icon: AlertCircle }
};

export default function PipelineView() {
  return (
    <div className="space-y-8">
      {/* Pipeline Flow */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-6 font-sans text-lg font-semibold text-card-foreground">Pipeline Επεξεργασίας</h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {pipelineSteps.map((step, i) =>
          <div key={step.label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary transition-shadow hover:shadow-elevated">
                  <step.icon className={`h-6 w-6 ${step.color}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-card-foreground">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {i < pipelineSteps.length - 1

            }
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
        { label: "Σήμερα", value: "12", sub: "νέα emails" },
        { label: "Σε επεξεργασία", value: "3", sub: "τιμολόγια" },
        { label: "Αναμονή ελέγχου", value: "5", sub: "drafts" },
        { label: "Ολοκληρωμένα", value: "847", sub: "αυτόν τον μήνα" }].
        map((stat) =>
        <div key={stat.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold text-card-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
          </div>
        )}
      </div>

      {/* Recent Items */}
      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-sans text-lg font-semibold text-card-foreground">Πρόσφατα Τιμολόγια</h2>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Νέο Email
          </button>
        </div>
        <div className="divide-y divide-border">
          {recentItems.map((item) => {
            const status = statusConfig[item.status];
            const StatusIcon = status.icon;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-secondary/50">

                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">{item.id}</p>
                    <p className="text-sm text-muted-foreground">{item.sender}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="hidden text-sm text-muted-foreground md:block">{item.step}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                  <span className="hidden text-sm text-muted-foreground lg:block">{item.date}</span>
                </div>
              </div>);

          })}
        </div>
      </div>
    </div>);

}