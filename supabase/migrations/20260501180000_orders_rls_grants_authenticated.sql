-- Encaissement / liaison client : l’admin connecté utilise le rôle `authenticated`, pas `anon`.
-- Les politiques existantes sur `orders` ne ciblaient que `anon` → SELECT/UPDATE vides ou refusés
-- pour les sessions JWT, ce qui bloque `ensureOrderHasCustomer` et peut faire échouer le flux avant le RPC.

GRANT SELECT, UPDATE ON TABLE public.orders TO authenticated;

DROP POLICY IF EXISTS "chiraz_authenticated_orders_select" ON public.orders;
CREATE POLICY "chiraz_authenticated_orders_select"
ON public.orders
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "chiraz_authenticated_orders_update" ON public.orders;
CREATE POLICY "chiraz_authenticated_orders_update"
ON public.orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
