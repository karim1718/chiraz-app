# Checklist migration Supabase — Chiraz

À utiliser **à chaque nouvelle table, vue ou RPC** dans `supabase/migrations/`.

Contexte Supabase (2026) : les nouvelles tables `public` ne sont plus exposées à la Data API sans **`GRANT` explicite**. Voir [changelog Supabase](https://supabase.com/changelog).

---

## Avant d’écrire la migration

- [ ] Nom de fichier : `supabase migration new <description>` (ne pas inventer le nom à la main)
- [ ] La table est-elle **boutique publique**, **admin uniquement**, ou **RPC uniquement** ?
- [ ] Le front utilise-t-il `.from('table')` ou seulement `.rpc('...')` ?

---

## 1. Schéma

- [ ] `CREATE TABLE` dans le schéma `public` (ou autre schéma documenté)
- [ ] Clé primaire (`uuid` + `gen_random_uuid()` si convention Chiraz)
- [ ] `created_at` / `updated_at` si utile pour l’admin
- [ ] Index sur les colonnes filtrées (`status`, `created_at`, `phone`, etc.)
- [ ] `COMMENT ON TABLE` si le rôle métier n’est pas évident

---

## 2. Sécurité (obligatoire)

- [ ] **`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`**
- [ ] **`REVOKE ALL ON TABLE ... FROM anon;`** sauf accès public volontaire
- [ ] **`GRANT` explicites** vers `anon` et/ou `authenticated` selon le cas (voir modèles ci-dessous)
- [ ] Policies RLS nommées `chiraz_*` cohérentes avec le reste du projet
- [ ] Admin : policies avec `public.is_chiraz_admin()`
- [ ] Boutique publique : **pas** de policy ouverte sur données sensibles ; préférer **RPC `SECURITY DEFINER`**

---

## 3. Grants selon le type de table

### A. Catalogue boutique (lecture publique)

Exemple : `products`, `variants`, `shop_shipping_settings`

- [ ] `GRANT SELECT ON TABLE public.<table> TO anon, authenticated;`
- [ ] Policy SELECT restrictive (ex. produits actifs uniquement)
- [ ] Pas de `INSERT` / `UPDATE` / `DELETE` pour `anon`

### B. Données admin (CRM, commandes, stock, prospects…)

Exemple : `orders`, `customers`, `order_leads`

- [ ] `REVOKE ALL ON TABLE public.<table> FROM anon;`
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table> TO authenticated;` (ajuster selon besoin)
- [ ] Policy `FOR ALL TO authenticated USING (is_chiraz_admin()) WITH CHECK (is_chiraz_admin())`

### C. Accès site public sans exposer la table

Exemple : `order_leads` + `upsert_order_lead`

- [ ] `REVOKE ALL ON TABLE public.<table> FROM anon;`
- [ ] RPC `SECURITY DEFINER` + validation des paramètres
- [ ] `GRANT EXECUTE ON FUNCTION public.<rpc>(...) TO anon, authenticated;`
- [ ] Pas de `GRANT` direct sur la table pour `anon`

### D. Vues (`orders_outstanding`, rapports…)

- [ ] `REVOKE SELECT` de `anon` si données sensibles
- [ ] `GRANT SELECT ON public.<view> TO authenticated;` (admin)
- [ ] Postgres 15+ : `CREATE VIEW ... WITH (security_invoker = true)` si applicable

---

## 4. RPC / fonctions

- [ ] `SECURITY DEFINER` + `SET search_path = public`
- [ ] Garde `IF NOT public.is_chiraz_admin()` pour les opérations admin
- [ ] Garde métier pour le public (ex. `source IN ('web','online')`, pas de `customer_id` côté anon)
- [ ] `GRANT EXECUTE` uniquement aux rôles nécessaires (`anon` vs `authenticated`)
- [ ] `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` si fonction sensible
- [ ] Fin de migration : `NOTIFY pgrst, 'reload schema';`

---

## 5. Front Chiraz

- [ ] Si la table est admin-only : accès uniquement depuis pages `/admin/*` (session `authenticated`)
- [ ] Si la boutique appelle `.from()` : vérifier que `anon` a bien `GRANT SELECT` + policy OK
- [ ] Si erreur silencieuse (0 ligne) : vérifier **GRANT + RLS SELECT** (UPDATE exige aussi SELECT en RLS)
- [ ] Types TS / services mis à jour si nouvelles colonnes

---

## 6. Avant merge / déploiement

- [ ] Migration appliquée sur le projet Supabase lié à `VITE_SUPABASE_URL`
- [ ] **Security Advisor** (dashboard Supabase) : pas d’alerte critique
- [ ] Test manuel :
  - [ ] Boutique (non connecté) : comportement attendu
  - [ ] Admin connecté : lecture / écriture OK
  - [ ] Anon ne peut pas lire/écrire les tables sensibles
- [ ] `npm run build` OK

---

## 7. Rappel calendrier Supabase

| Date | Impact |
|------|--------|
| **30 mai 2026** | Nouveaux projets Supabase : grants obligatoires dès la création de table |
| **30 oct. 2026** | Nouvelles tables sur projets existants (Chiraz) : grants obligatoires |

**Tables déjà en prod** : comportement actuel conservé jusqu’à cette date ; seules les **nouvelles** tables sans `GRANT` poseront problème.

---

## Modèle SQL à copier

```sql
-- ─── Nouvelle table admin-only ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.example_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.example_admin ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.example_admin FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.example_admin TO authenticated;

DROP POLICY IF EXISTS chiraz_admin_example_admin_all ON public.example_admin;
CREATE POLICY chiraz_admin_example_admin_all
  ON public.example_admin
  FOR ALL
  TO authenticated
  USING (public.is_chiraz_admin())
  WITH CHECK (public.is_chiraz_admin());

NOTIFY pgrst, 'reload schema';
```

```sql
-- ─── Nouvelle table lue par la boutique (catalogue) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.example_shop (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true
);

ALTER TABLE public.example_shop ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.example_shop FROM anon;
GRANT SELECT ON TABLE public.example_shop TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.example_shop TO authenticated;

DROP POLICY IF EXISTS chiraz_anon_example_shop_select ON public.example_shop;
CREATE POLICY chiraz_anon_example_shop_select
  ON public.example_shop
  FOR SELECT
  TO anon
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS chiraz_admin_example_shop_all ON public.example_shop;
CREATE POLICY chiraz_admin_example_shop_all
  ON public.example_shop
  FOR ALL
  TO authenticated
  USING (public.is_chiraz_admin())
  WITH CHECK (public.is_chiraz_admin());

NOTIFY pgrst, 'reload schema';
```

---

## Références dans ce repo

| Fichier | Rôle |
|---------|------|
| [`20260517120000_security_hardening.sql`](migrations/20260517120000_security_hardening.sql) | Modèle global REVOKE anon + admin policies |
| [`20260520100000_order_leads_autosave.sql`](migrations/20260520100000_order_leads_autosave.sql) | Table admin + RPC public |
| [`20260505100000_shop_shipping_order_totals.sql`](migrations/20260505100000_shop_shipping_order_totals.sql) | Réglage boutique + grants SELECT |
