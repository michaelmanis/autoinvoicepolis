
-- Fix RLS policies: change from RESTRICTIVE to PERMISSIVE
-- The RESTRICTIVE policies were blocking ALL access since they require BOTH conditions

-- Fix invoices policies
DROP POLICY IF EXISTS "Accountants can update invoice status" ON public.invoices;
DROP POLICY IF EXISTS "Accountants can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can create own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;

-- Re-create as PERMISSIVE (default)
CREATE POLICY "Users can view own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Accountants can view all invoices"
ON public.invoices FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Users can create own invoices"
ON public.invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
ON public.invoices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Accountants can update invoice status"
ON public.invoices FOR UPDATE
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Users can delete own invoices"
ON public.invoices FOR DELETE
USING (auth.uid() = user_id);

-- Fix projects policies
DROP POLICY IF EXISTS "Accountants can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;

CREATE POLICY "Users can view own projects"
ON public.projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Accountants can view all projects"
ON public.projects FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Users can create own projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);

-- Fix user_roles policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
