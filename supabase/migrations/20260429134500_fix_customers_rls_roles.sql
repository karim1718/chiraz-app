-- Fix RLS/permissions for customer upsert from admin frontend.
-- Admin can run with anon key or authenticated session, both must be allowed.

GRANT SELECT, INSERT, UPDATE ON TABLE public.customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_accounts TO anon, authenticated;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chiraz_customers_rw_anon_auth" ON public.customers;
CREATE POLICY "chiraz_customers_rw_anon_auth"
ON public.customers
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_customer_accounts_rw_anon_auth" ON public.customer_accounts;
CREATE POLICY "chiraz_customer_accounts_rw_anon_auth"
ON public.customer_accounts
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
