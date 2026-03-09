/**
 * ExpenseDetail — View and edit a single expense record.
 * Focused on total amount, supplier info, and description. No line items.
 */

import { useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_STATUS_CONFIG, formatAmount } from "@/types/expense";
import type { Expense } from "@/types/expense";

type FormState = {
  supplier: string;
  supplier_vat: string;
  expense_number: string;
  expense_date: string;
  due_date: string;
  amount: string;
  currency: string;
  description: string;
  notes: string;
  status: string;
};

interface ExpenseDetailProps {
  expense: Expense;
  onBack: () => void;
}

export default function ExpenseDetail({ expense, onBack }: ExpenseDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>({
    supplier: expense.supplier || "",
    supplier_vat: expense.supplier_vat || "",
    expense_number: expense.expense_number || "",
    expense_date: expense.expense_date || "",
    due_date: expense.due_date || "",
    amount: expense.amount?.toString() || "",
    currency: expense.currency || "EUR",
    description: expense.description || "",
    notes: expense.notes || "",
    status: expense.status,
  });

  const update = (updates: Partial<FormState>) => setForm((prev) => ({ ...prev, ...updates }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("expenses")
        .update({
          supplier: form.supplier || null,
          supplier_vat: form.supplier_vat || null,
          expense_number: form.expense_number || null,
          expense_date: form.expense_date || null,
          due_date: form.due_date || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          currency: form.currency || "EUR",
          description: form.description || null,
          notes: form.notes || null,
          status: form.status,
        })
        .eq("id", expense.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Αποθηκεύτηκε!" });
    },
    onError: (err: any) => {
      toast({ title: "Σφάλμα", description: err.message, variant: "destructive" });
    },
  });

  const cfg = EXPENSE_STATUS_CONFIG[form.status] || EXPENSE_STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold text-foreground">Λεπτομέρειες Δαπάνης</h2>
        <Badge variant="outline" className={cfg.className}>
          <StatusIcon className="mr-1 h-3 w-3" />{cfg.label}
        </Badge>
        <div className="ml-auto">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Αποθήκευση
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Στοιχεία Προμηθευτή</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Προμηθευτής</Label>
              <Input value={form.supplier} onChange={(e) => update({ supplier: e.target.value })} />
            </div>
            <div>
              <Label>ΑΦΜ Προμηθευτή</Label>
              <Input value={form.supplier_vat} onChange={(e) => update({ supplier_vat: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Στοιχεία Δαπάνης</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Αρ. Παραστατικού</Label>
              <Input value={form.expense_number} onChange={(e) => update({ expense_number: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ημερομηνία</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => update({ expense_date: e.target.value })} />
              </div>
              <div>
                <Label>Ημ. Λήξης</Label>
                <Input type="date" value={form.due_date} onChange={(e) => update({ due_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ποσό</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => update({ amount: e.target.value })} />
              </div>
              <div>
                <Label>Νόμισμα</Label>
                <Input value={form.currency} onChange={(e) => update({ currency: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Κατάσταση</Label>
              <select
                value={form.status}
                onChange={(e) => update({ status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(EXPENSE_STATUS_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Περιγραφή & Σημειώσεις</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Περιγραφή</Label>
              <Input value={form.description} onChange={(e) => update({ description: e.target.value })} />
            </div>
            <div>
              <Label>Σημειώσεις</Label>
              <Textarea value={form.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
