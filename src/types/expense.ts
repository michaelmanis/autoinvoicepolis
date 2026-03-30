/**
 * Shared expense types, status configuration, and formatting utilities.
 * Mirrors invoice workflow statuses for full ERP pipeline support.
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
  document_type: string | null;
};

export type ExpenseStatus = {
  label: string;
  className: string;
  icon: typeof Clock;
};

export const EXPENSE_STATUS_CONFIG: Record<string, ExpenseStatus> = {
  draft:               { label: "Draft",                  className: "bg-info/10 text-info",               icon: Clock },
  review:              { label: "Αναμονή",                className: "bg-warning/10 text-warning",         icon: AlertCircle },
  approved:            { label: "Εγκρίθηκε",              className: "bg-success/10 text-success",         icon: CheckCircle2 },
  submitted:           { label: "Υποβλήθηκε",             className: "bg-success/10 text-success",         icon: CheckCircle2 },
  accountant_pending:  { label: "Αναμονή Λογιστή",        className: "bg-warning/10 text-warning",         icon: AlertCircle },
  accountant_approved: { label: "Εγκρίθηκε (Λογιστής)",  className: "bg-success/10 text-success",         icon: CheckCircle2 },
  error:               { label: "Σφάλμα",                 className: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

/** Statuses where the expense has left the user's control */
export const LOCKED_EXPENSE_STATUSES = new Set(["accountant_pending", "accountant_approved", "submitted"]);

/** Returns a YYYY-MM key from an expense's date (falls back to created_at) */
export function getExpenseMonthKey(expense: Expense): string {
  const d = expense.expense_date || expense.created_at;
  if (!d) return "unknown";
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatAmount(amount: number, currency = "EUR"): string {
  return `${amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} ${currency === "EUR" ? "€" : currency}`;
}
