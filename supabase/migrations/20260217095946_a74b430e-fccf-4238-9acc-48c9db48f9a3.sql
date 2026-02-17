
-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier TEXT,
  supplier_vat TEXT,
  amount NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  items JSONB DEFAULT '[]'::jsonb,
  raw_ocr_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','submitted','error')),
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);

-- Storage policies: users can manage their own folder
CREATE POLICY "Users can upload invoice files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own invoice files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own invoice files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
