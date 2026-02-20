
-- Drop the old status check constraint and add a new one with all valid statuses
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('draft', 'review', 'approved', 'submitted', 'accountant_pending', 'accountant_approved', 'error'));
