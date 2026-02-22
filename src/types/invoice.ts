/**
 * Shared invoice types, status configuration, and formatting utilities.
 * All invoice-related components should import from here to avoid duplication.
 */

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

// ─── Core types ───────────────────────────────────────────────────────────────

/** Represents a single invoice record from the database */
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

/** UI configuration for a single invoice status */
export type InvoiceStatus = {
  label: string;
  className: string;
  icon: typeof Clock;
};

// ─── Status configuration ─────────────────────────────────────────────────────

/** Maps status strings to display label, Tailwind classes, and icon */
export const STATUS_CONFIG: Record<string, InvoiceStatus> = {
  draft:               { label: "Draft",                  className: "bg-info/10 text-info",               icon: Clock },
  review:              { label: "Αναμονή",                className: "bg-warning/10 text-warning",         icon: AlertCircle },
  approved:            { label: "Εγκρίθηκε",              className: "bg-success/10 text-success",         icon: CheckCircle2 },
  submitted:           { label: "Υποβλήθηκε",             className: "bg-success/10 text-success",         icon: CheckCircle2 },
  accountant_pending:  { label: "Αναμονή Λογιστή",        className: "bg-warning/10 text-warning",         icon: AlertCircle },
  accountant_approved: { label: "Εγκρίθηκε (Λογιστής)",  className: "bg-success/10 text-success",         icon: CheckCircle2 },
  error:               { label: "Σφάλμα",                 className: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

/** Statuses where the invoice has left the user's control (no edit/delete) */
export const LOCKED_STATUSES = new Set(["accountant_pending", "accountant_approved", "submitted"]);

// ─── Month helpers ────────────────────────────────────────────────────────────

/** Greek month names indexed by zero-padded month number */
export const MONTH_NAMES: Record<string, string> = {
  "01": "Ιανουάριος", "02": "Φεβρουάριος", "03": "Μάρτιος",
  "04": "Απρίλιος",   "05": "Μάιος",       "06": "Ιούνιος",
  "07": "Ιούλιος",    "08": "Αύγουστος",   "09": "Σεπτέμβριος",
  "10": "Οκτώβριος",  "11": "Νοέμβριος",   "12": "Δεκέμβριος",
};

/** Returns a YYYY-MM key from an invoice's date (falls back to created_at) */
export function getMonthKey(invoice: Invoice): string {
  const d = invoice.invoice_date || invoice.created_at;
  if (!d) return "unknown";
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Converts a YYYY-MM key to a human-readable Greek month + year label */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[month] ?? month} ${year}`;
}

/** Formats a numeric amount with Greek locale and currency symbol */
export function formatAmount(amount: number, currency = "EUR"): string {
  return `${amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} ${currency === "EUR" ? "€" : currency}`;
}
