import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

export type Invoice = {
  id: string;
  supplier: string | null;
  supplier_vat: string | null;
  amount: number | null;
  currency: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  items: any;
  raw_ocr_text: string | null;
  status: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
};

export type InvoiceStatus = {
  label: string;
  className: string;
  icon: typeof Clock;
};

export const STATUS_CONFIG: Record<string, InvoiceStatus> = {
  draft: { label: "Draft", className: "bg-info/10 text-info", icon: Clock },
  review: { label: "Αναμονή", className: "bg-warning/10 text-warning", icon: AlertCircle },
  approved: { label: "Εγκρίθηκε", className: "bg-success/10 text-success", icon: CheckCircle2 },
  submitted: { label: "Υποβλήθηκε", className: "bg-success/10 text-success", icon: CheckCircle2 },
  accountant_pending: { label: "Αναμονή Λογιστή", className: "bg-warning/10 text-warning", icon: AlertCircle },
  accountant_approved: { label: "Εγκρίθηκε (Λογιστής)", className: "bg-success/10 text-success", icon: CheckCircle2 },
  error: { label: "Σφάλμα", className: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

/** Statuses where the invoice has left the user's control */
export const LOCKED_STATUSES = new Set(["accountant_pending", "accountant_approved", "submitted"]);

/** Formatting helpers */
export const MONTH_NAMES: Record<string, string> = {
  "01": "Ιανουάριος", "02": "Φεβρουάριος", "03": "Μάρτιος",
  "04": "Απρίλιος",   "05": "Μάιος",       "06": "Ιούνιος",
  "07": "Ιούλιος",    "08": "Αύγουστος",   "09": "Σεπτέμβριος",
  "10": "Οκτώβριος",  "11": "Νοέμβριος",   "12": "Δεκέμβριος",
};

export function getMonthKey(invoice: Invoice): string {
  const d = invoice.invoice_date || invoice.created_at;
  if (!d) return "unknown";
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthKey(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[month] ?? month} ${year}`;
}

export function formatAmount(amount: number, currency = "EUR"): string {
  return `${amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} ${currency === "EUR" ? "€" : currency}`;
}
