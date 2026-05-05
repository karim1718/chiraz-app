-- Chiraz — politiques RLS pour l’admin « mot de passe » (client Supabase = rôle `anon`, pas de JWT).
-- Sans politique UPDATE sur `orders` pour `anon`, l’UPDATE ne touche aucune ligne : le tableau
-- renvoyé par PostgREST est vide → erreur côté app.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- Si une politique du même nom existe déjà, supprimez-la ou renommez ce fichier selon votre flux.

-- ─── orders ───────────────────────────────────────────────────────────────
GRANT SELECT, UPDATE ON TABLE public.orders TO anon;

DROP POLICY IF EXISTS "chiraz_anon_orders_update" ON public.orders;
CREATE POLICY "chiraz_anon_orders_update"
  ON public.orders
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- (Souvent déjà présent ; recréer ne pose pas problème si vous n’avez pas de doublon de nom.)
DROP POLICY IF EXISTS "chiraz_anon_orders_select" ON public.orders;
CREATE POLICY "chiraz_anon_orders_select"
  ON public.orders
  FOR SELECT
  TO anon
  USING (true);

-- ─── order_status_history (insert après changement de statut) ─────────────
GRANT SELECT, INSERT ON TABLE public.order_status_history TO anon;

DROP POLICY IF EXISTS "chiraz_anon_order_status_history_insert" ON public.order_status_history;
CREATE POLICY "chiraz_anon_order_status_history_insert"
  ON public.order_status_history
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_order_status_history_select" ON public.order_status_history;
CREATE POLICY "chiraz_anon_order_status_history_select"
  ON public.order_status_history
  FOR SELECT
  TO anon
  USING (true);

-- ─── order_items (lecture pour annulation / retour) ───────────────────────
GRANT SELECT ON TABLE public.order_items TO anon;

DROP POLICY IF EXISTS "chiraz_anon_order_items_select" ON public.order_items;
CREATE POLICY "chiraz_anon_order_items_select"
  ON public.order_items
  FOR SELECT
  TO anon
  USING (true);

-- ─── variants (stock sur annulation / refus / retour) ──────────────────────
GRANT SELECT, UPDATE ON TABLE public.variants TO anon;

DROP POLICY IF EXISTS "chiraz_anon_variants_select" ON public.variants;
CREATE POLICY "chiraz_anon_variants_select"
  ON public.variants
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "chiraz_anon_variants_update" ON public.variants;
CREATE POLICY "chiraz_anon_variants_update"
  ON public.variants
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ─── stock_movements ───────────────────────────────────────────────────────
GRANT SELECT, INSERT ON TABLE public.stock_movements TO anon;

DROP POLICY IF EXISTS "chiraz_anon_stock_movements_insert" ON public.stock_movements;
CREATE POLICY "chiraz_anon_stock_movements_insert"
  ON public.stock_movements
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_stock_movements_select" ON public.stock_movements;
CREATE POLICY "chiraz_anon_stock_movements_select"
  ON public.stock_movements
  FOR SELECT
  TO anon
  USING (true);
