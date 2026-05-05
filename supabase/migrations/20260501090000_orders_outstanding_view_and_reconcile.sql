-- Vue : reste à encaisser par commande (alignée sur register_order_payment : exclut paiements en_retard du cumul).
-- Fonction : réaligne orders.payment_status sur la somme réelle des paiements (données historiques / manuelles).

-- ─── Diagnostic (lecture seule, exécuter dans l’éditeur SQL) ─────────────────
-- SELECT order_number, status, payment_status, total, paid_sum, outstanding
-- FROM public.orders_outstanding
-- WHERE status = 'livré' AND outstanding > 0.01
-- ORDER BY paid_sum DESC;
--
-- Après première déploiement : aligner les anciennes lignes (idempotent) :
-- SELECT public.chiraz_reconcile_payment_statuses();

CREATE OR REPLACE VIEW public.orders_outstanding
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.customer_id,
  o.customer_name,
  o.phone,
  o.city,
  o.source::text AS source,
  o.order_number,
  o.total,
  o.payment_status,
  o.status::text AS status,
  o.created_at,
  COALESCE(p.paid_sum, 0)::numeric(12, 2) AS paid_sum,
  (o.total - COALESCE(p.paid_sum, 0))::numeric(12, 2) AS outstanding
FROM public.orders o
LEFT JOIN (
  SELECT
    order_id,
    COALESCE(SUM(amount), 0)::numeric(12, 2) AS paid_sum
  FROM public.payments
  WHERE order_id IS NOT NULL
    AND status IS DISTINCT FROM 'en_retard'::public.payment_status
  GROUP BY order_id
) p ON p.order_id = o.id
WHERE o.status::text IS DISTINCT FROM 'annulé'
  AND o.status::text IS DISTINCT FROM 'refusé';

GRANT SELECT ON public.orders_outstanding TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.chiraz_reconcile_payment_statuses()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  n integer := 0;
  r record;
  v_eps numeric(12, 4) := 0.01;
  v_next public.payment_status;
BEGIN
  FOR r IN
    SELECT
      o.id,
      o.total,
      o.payment_status AS cur_status,
      o.source::text AS src,
      COALESCE(s.paid_sum, 0)::numeric(12, 2) AS paid_sum
    FROM public.orders o
    LEFT JOIN (
      SELECT
        order_id,
        COALESCE(SUM(amount), 0)::numeric(12, 2) AS paid_sum
      FROM public.payments
      WHERE order_id IS NOT NULL
        AND status IS DISTINCT FROM 'en_retard'::public.payment_status
      GROUP BY order_id
    ) s ON s.order_id = o.id
    WHERE o.status::text IS DISTINCT FROM 'annulé'
      AND o.status::text IS DISTINCT FROM 'refusé'
  LOOP
    IF r.cur_status = 'en_retard'::public.payment_status
       AND r.paid_sum < r.total - v_eps THEN
      v_next := 'en_retard'::public.payment_status;
    ELSIF r.paid_sum >= r.total - v_eps THEN
      v_next := 'paye'::public.payment_status;
    ELSIF r.paid_sum > 0 THEN
      v_next := 'partiellement_paye'::public.payment_status;
    ELSIF lower(coalesce(r.src, '')) IN ('web', 'online') THEN
      v_next := 'en_attente_encaissement'::public.payment_status;
    ELSE
      v_next := 'non_paye'::public.payment_status;
    END IF;

    IF v_next IS DISTINCT FROM r.cur_status THEN
      UPDATE public.orders
      SET payment_status = v_next
      WHERE id = r.id;
      n := n + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('updated', n);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.chiraz_reconcile_payment_statuses() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
