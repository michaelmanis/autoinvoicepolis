/**
 * Shared expense types, status configuration, and formatting utilities.
 */

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

export type Expense = {
  id: string;
  supplier: string | null;
  supplier_vat: string | null;
  amount: number | null;
  currency: string | null;
  expense_number: string | null;
  expense_date: string | null;
  due_date: string | null;
  description: string | null;
  notes: string | null;
  raw_ocr_text: string | null;
  status: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
};

export type ExpenseStatus = {
  label: string;
  className: string;
  icon: typeof Clock;
};

export const EXPENSE_STATUS_CONFIG: Record<string, ExpenseStatus> = {
  draft:    { label: "Draft",       className: "bg-info/10 text-info",               icon: Clock },
  review:   { label: "Αναμονή",    className: "bg-warning/10 text-warning",         icon: AlertCircle },
  approved: { label: "Εγκρίθηκε",  className: "bg-success/10 text-success",         icon: CheckCircle2 },
  error:    { label: "Σφάλμα",     className: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

export function formatAmount(amount: number, currency = "EUR"): string {
  return `${amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} ${currency === "EUR" ? "€" : currency}`;
}
