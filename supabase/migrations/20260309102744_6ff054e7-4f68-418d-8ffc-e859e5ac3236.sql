
-- Create expense_actions table mirroring invoice_actions
CREATE TABLE public.expense_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_email text,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies matching invoice_actions pattern
CREATE POLICY "View own expense actions" ON public.expense_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_actions.expense_id
        AND expenses.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'accountant'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Insert own expense actions" ON public.expense_actions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all expense actions" ON public.expense_actions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert expense actions" ON public.expense_actions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
