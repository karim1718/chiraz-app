-- Catalogue admin : produits + variants — GRANT + RLS pour anon ET authenticated.
-- Corrige : "new row violates row-level security policy for table products"
-- (l’UI admin utilise la clé anon et/ou une session JWT = rôle authenticated).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO anon, authenticated;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chiraz_products_rw_anon_auth" ON public.products;
CREATE POLICY "chiraz_products_rw_anon_auth"
ON public.products
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Variants : INSERT/DELETE pour création de produit + édition ; droits authenticated alignés sur anon.
GRANT INSERT, DELETE ON TABLE public.variants TO anon, authenticated;

DROP POLICY IF EXISTS "chiraz_variants_insert_anon_auth" ON public.variants;
CREATE POLICY "chiraz_variants_insert_anon_auth"
ON public.variants
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_variants_delete_anon_auth" ON public.variants;
CREATE POLICY "chiraz_variants_delete_anon_auth"
ON public.variants
FOR DELETE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "chiraz_variants_select_authenticated" ON public.variants;
CREATE POLICY "chiraz_variants_select_authenticated"
ON public.variants
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "chiraz_variants_update_authenticated" ON public.variants;
CREATE POLICY "chiraz_variants_update_authenticated"
ON public.variants
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
