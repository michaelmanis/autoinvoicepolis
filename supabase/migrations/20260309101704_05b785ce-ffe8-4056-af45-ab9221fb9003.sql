
-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplier TEXT,
  supplier_vat TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'EUR',
  expense_number TEXT,
  expense_date DATE,
  due_date DATE,
  description TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  file_url TEXT,
  file_name TEXT,
  project_id UUID REFERENCES public.projects(id),
  company_id UUID REFERENCES public.companies(id),
  raw_ocr_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all expenses" ON public.expenses FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all expenses" ON public.expenses FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all expenses" ON public.expenses FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Accountants can view all expenses" ON public.expenses FOR SELECT USING (has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update expense status" ON public.expenses FOR UPDATE USING (has_role(auth.uid(), 'accountant'));

-- Updated_at trigger
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
