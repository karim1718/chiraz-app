-- Lier / créer une fiche client au passage en « livré » (commandes web sans customer_id).
-- Les listes AdminPaymentsV2 / AdminCustomersV2 lisent `customers` : sans ce lien, l’acheteur reste invisible.
--
-- Après déploiement, exécuter une fois pour les commandes déjà livrées :
-- SELECT public.chiraz_backfill_livre_customers();

CREATE OR REPLACE FUNCTION public.chiraz_link_or_create_customer_for_order(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  rec record;
  v_cust uuid;
  v_phone text;
  v_cat public.customer_category;
  v_paid numeric(12, 2);
  v_outstanding numeric(12, 2);
  v_eps numeric(12, 4) := 0.01;
BEGIN
  SELECT
    o.id,
    o.customer_id,
    o.customer_name,
    o.phone,
    o.city,
    o.source::text AS src,
    o.total,
    o.status::text AS st
  INTO rec
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF rec.customer_id IS NOT NULL THEN
    RETURN rec.customer_id;
  END IF;

  IF rec.st IN ('annulé', 'refusé') THEN
    RETURN NULL;
  END IF;

  IF rec.st NOT IN ('livré', 'livre') THEN
    RETURN NULL;
  END IF;

  v_phone := NULLIF(btrim(COALESCE(rec.phone, '')), '');
  IF v_phone IS NULL THEN
    v_phone := 'sans-tel-' || left(replace(p_order_id::text, '-', ''), 8);
  END IF;

  SELECT c.id
  INTO v_cust
  FROM public.customers c
  WHERE btrim(c.phone) = btrim(v_phone)
  LIMIT 1;

  IF v_cust IS NULL THEN
    v_cat := CASE
      WHEN lower(coalesce(rec.src, '')) IN ('web', 'online') THEN 'online'::public.customer_category
      ELSE 'boutique'::public.customer_category
    END;

    INSERT INTO public.customers (full_name, phone, category, address, notes)
    VALUES (
      COALESCE(NULLIF(btrim(rec.customer_name), ''), 'Client'),
      v_phone,
      v_cat,
      rec.city,
      NULL
    )
    RETURNING id INTO v_cust;
  END IF;

  UPDATE public.orders
  SET customer_id = v_cust
  WHERE id = p_order_id
    AND customer_id IS NULL;

  INSERT INTO public.customer_accounts (customer_id)
  VALUES (v_cust)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT COALESCE(SUM(p.amount), 0)::numeric(12, 2)
  INTO v_paid
  FROM public.payments p
  WHERE p.order_id = p_order_id
    AND p.status IS DISTINCT FROM 'en_retard'::public.payment_status;

  v_outstanding := COALESCE(rec.total, 0) - COALESCE(v_paid, 0);

  IF v_outstanding > v_eps THEN
    UPDATE public.customer_accounts ca
    SET
      total_du = ca.total_du + v_outstanding,
      solde = ca.solde + v_outstanding,
      updated_at = now()
    WHERE ca.customer_id = v_cust;
  END IF;

  RETURN v_cust;
END;
$function$;

CREATE OR REPLACE FUNCTION public.chiraz_orders_link_customer_on_livre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  st text;
BEGIN
  st := NEW.status::text;
  IF st NOT IN ('livré', 'livre') OR NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.chiraz_link_or_create_customer_for_order(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.chiraz_link_or_create_customer_for_order(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_chiraz_orders_link_customer_on_livre ON public.orders;

CREATE TRIGGER trg_chiraz_orders_link_customer_on_livre
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.chiraz_orders_link_customer_on_livre();

CREATE OR REPLACE FUNCTION public.chiraz_backfill_livre_customers()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  n integer := 0;
  rid uuid;
BEGIN
  FOR rid IN
    SELECT o.id
    FROM public.orders o
    WHERE o.customer_id IS NULL
      AND o.status::text IN ('livré', 'livre')
  LOOP
    PERFORM public.chiraz_link_or_create_customer_for_order(rid);
    n := n + 1;
  END LOOP;

  RETURN json_build_object('linked', n);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.chiraz_link_or_create_customer_for_order(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chiraz_backfill_livre_customers() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
