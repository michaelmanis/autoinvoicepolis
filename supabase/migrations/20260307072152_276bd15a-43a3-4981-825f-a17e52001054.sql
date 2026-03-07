
CREATE TABLE public.business_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company TEXT,
  contact_surname TEXT,
  contact_name TEXT,
  title TEXT,
  email TEXT,
  mobile_phone TEXT,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business cards" ON public.business_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own business cards" ON public.business_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own business cards" ON public.business_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own business cards" ON public.business_cards FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all business cards" ON public.business_cards FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_business_cards_updated_at BEFORE UPDATE ON public.business_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
