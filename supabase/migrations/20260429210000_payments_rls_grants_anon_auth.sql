-- Paiements : GRANT + RLS pour anon ET authenticated (admin Chiraz sans JWT ou avec session).
-- Corrige : "new row violates row-level security policy for table payments"

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_allocations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_instruments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_history TO anon, authenticated;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chiraz_anon_payments_all" ON public.payments;
DROP POLICY IF EXISTS "chiraz_payments_rw_anon_auth" ON public.payments;
CREATE POLICY "chiraz_payments_rw_anon_auth"
ON public.payments
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_payment_allocations_all" ON public.payment_allocations;
DROP POLICY IF EXISTS "chiraz_payment_allocations_rw_anon_auth" ON public.payment_allocations;
CREATE POLICY "chiraz_payment_allocations_rw_anon_auth"
ON public.payment_allocations
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_payment_instruments_all" ON public.payment_instruments;
DROP POLICY IF EXISTS "chiraz_payment_instruments_rw_anon_auth" ON public.payment_instruments;
CREATE POLICY "chiraz_payment_instruments_rw_anon_auth"
ON public.payment_instruments
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_payment_history_all" ON public.payment_history;
DROP POLICY IF EXISTS "chiraz_payment_history_rw_anon_auth" ON public.payment_history;
CREATE POLICY "chiraz_payment_history_rw_anon_auth"
ON public.payment_history
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
