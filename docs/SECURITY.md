# Sécurité Chiraz

## Déploiement Supabase (obligatoire)

1. Exécuter les migrations dans l’ordre, notamment :
   - `supabase/migrations/20260517120000_security_hardening.sql`
   - `supabase/migrations/20260517120100_storage_product_images_policies.sql`
2. Vérifier que le compte admin a `app_metadata.role = "admin"` (Dashboard → Authentication → Users → user → Edit → App Metadata).
3. Désactiver l’inscription publique : Authentication → Providers → Email → désactiver « Enable sign ups » si non nécessaire.
4. Activer MFA pour le compte admin (recommandé).
5. Si le site était déjà public avant durcissement : **rotater la clé anon** (Settings → API) et mettre à jour `VITE_SUPABASE_ANON_KEY` sur Vercel.

## Modèle d’accès

| Rôle | Boutique | Admin |
|------|----------|-------|
| `anon` (visiteur) | Catalogue en lecture, commande via `create_order_with_stock` | Refusé |
| `authenticated` + `role=admin` | Comme admin | CRUD complet + RPC admin |

## Vérification rapide

Avec la clé **anon** seule, ces appels doivent **échouer** :

- `GET /rest/v1/customers`
- `POST /rest/v1/rpc/chiraz_update_order_status`
- `POST /rest/v1/rpc/register_order_payment`

Le checkout public doit **réussir** via `create_order_with_stock`.
