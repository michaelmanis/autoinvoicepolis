
-- ─── Audit Log ───────────────────────────────────────────────────────────────
CREATE TABLE public.invoice_actions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,
  user_email  text,
  action      text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_actions ENABLE ROW LEVEL SECURITY;

-- Owners + accountants/admins can read
CREATE POLICY "View invoice actions"
ON public.invoice_actions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_id AND user_id = auth.uid())
  OR has_role(auth.uid(), 'accountant')
  OR has_role(auth.uid(), 'admin')
);

-- Authenticated users can log their own actions
CREATE POLICY "Insert own invoice actions"
ON public.invoice_actions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ─── ERP Settings (singleton) ─────────────────────────────────────────────────
CREATE TABLE public.erp_settings (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_type         text    NOT NULL DEFAULT 'softone',
  endpoint_url     text    NOT NULL DEFAULT '',
  api_key          text    NOT NULL DEFAULT '',
  company_id       text    NOT NULL DEFAULT '',
  branch_id        text    NOT NULL DEFAULT '',
  is_enabled       boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.erp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ERP settings"
ON public.erp_settings FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants view ERP settings"
ON public.erp_settings FOR SELECT
USING (has_role(auth.uid(), 'accountant'));

-- Trigger for updated_at
CREATE TRIGGER update_erp_settings_updated_at
BEFORE UPDATE ON public.erp_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.erp_settings (erp_type, endpoint_url, is_enabled)
VALUES ('softone', '', false);
