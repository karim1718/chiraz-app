-- Mouvements de stock depuis l'admin connecté (JWT = rôle `authenticated`).
-- Avant cette migration, seul `anon` avait INSERT/SELECT sur `stock_movements`
-- (voir 20260423130000_chiraz_rls_admin_anon.sql) → erreur
-- « new row violates row-level security policy for table stock_movements »
-- lors d'une entrée/sortie de stock depuis l'UI admin avec session.

GRANT SELECT, INSERT ON TABLE public.stock_movements TO authenticated;

DROP POLICY IF EXISTS "chiraz_authenticated_stock_movements_insert" ON public.stock_movements;
CREATE POLICY "chiraz_authenticated_stock_movements_insert"
  ON public.stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_authenticated_stock_movements_select" ON public.stock_movements;
CREATE POLICY "chiraz_authenticated_stock_movements_select"
  ON public.stock_movements
  FOR SELECT
  TO authenticated
  USING (true);
