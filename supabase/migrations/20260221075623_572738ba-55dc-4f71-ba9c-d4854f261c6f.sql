
-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  vat_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create permission type
CREATE TYPE public.company_permission AS ENUM (
  'view_invoices',
  'upload_edit',
  'approve_erp',
  'manage_projects'
);

-- Create company_members table
CREATE TABLE public.company_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permissions company_permission[] NOT NULL DEFAULT '{view_invoices}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Add company_id to projects
ALTER TABLE public.projects ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add company_id to invoices
ALTER TABLE public.invoices ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Trigger for updated_at on companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function: check if user belongs to a company
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

-- Helper function: check if user has a specific permission in a company
CREATE OR REPLACE FUNCTION public.has_company_permission(_user_id UUID, _company_id UUID, _permission company_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id 
      AND company_id = _company_id 
      AND _permission = ANY(permissions)
  )
$$;

-- RLS for companies: admins manage all, members can view their own
CREATE POLICY "Admins manage all companies"
  ON public.companies FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view their company"
  ON public.companies FOR SELECT
  USING (is_company_member(auth.uid(), id));

-- RLS for company_members: admins manage, users see own memberships
CREATE POLICY "Admins manage all members"
  ON public.company_members FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own memberships"
  ON public.company_members FOR SELECT
  USING (auth.uid() = user_id);
