-- Vente directe (B2B / Boutique) : lier la commande au client existant, statut logistique « livré »,
-- statut comptable « en attente d’encaissement », mise à jour du compte client (total dû / solde).

DROP FUNCTION IF EXISTS public.create_order_with_stock(uuid, numeric, text, text, text, text, numeric, integer, text);

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_product_id uuid,
  p_size numeric,
  p_color text,
  p_customer_name text,
  p_phone text,
  p_city text,
  p_total numeric,
  p_quantity integer DEFAULT 1,
  p_source text DEFAULT 'web',
  p_customer_id uuid DEFAULT NULL,
  p_order_status text DEFAULT NULL,
  p_payment_status public.payment_status DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variant_id uuid;
  v_order_id uuid;
  v_payment_status public.payment_status;
  v_order_status text;
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  v_payment_status := COALESCE(
    p_payment_status,
    CASE
      WHEN COALESCE(p_source, 'web') IN ('web', 'online') THEN 'en_attente_encaissement'::public.payment_status
      ELSE 'non_paye'::public.payment_status
    END
  );

  v_order_status := COALESCE(NULLIF(BTRIM(p_order_status), ''), 'nouveau');

  SELECT v.id
  INTO v_variant_id
  FROM public.variants v
  WHERE v.product_id = p_product_id
    AND v.size = p_size
    AND (
      (p_color IS NULL AND v.color IS NULL)
      OR v.color = p_color
    )
    AND v.stock >= p_quantity
  LIMIT 1
  FOR UPDATE;

  IF v_variant_id IS NULL THEN
    RAISE EXCEPTION 'Stock insuffisant ou variante introuvable';
  END IF;

  INSERT INTO public.orders(
    customer_name, phone, city, total, status, source, customer_id, payment_status
  ) VALUES (
    p_customer_name,
    p_phone,
    p_city,
    p_total,
    v_order_status,
    COALESCE(p_source, 'web'),
    p_customer_id,
    v_payment_status
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, variant_id, quantity, price)
  VALUES (v_order_id, v_variant_id, p_quantity, p_total);

  UPDATE public.variants
  SET stock = stock - p_quantity
  WHERE id = v_variant_id;

  INSERT INTO public.stock_movements (variant_id, type, quantity, reason, order_id)
  VALUES (v_variant_id, 'sortie', p_quantity, 'Commande client', v_order_id);

  IF p_customer_id IS NOT NULL THEN
    INSERT INTO public.customer_accounts (customer_id)
    VALUES (p_customer_id)
    ON CONFLICT (customer_id) DO NOTHING;

    UPDATE public.customer_accounts
    SET
      total_du = total_du + p_total,
      solde = solde + p_total,
      updated_at = now()
    WHERE customer_id = p_customer_id;
  END IF;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_stock(
  uuid,
  numeric,
  text,
  text,
  text,
  text,
  numeric,
  integer,
  text,
  uuid,
  text,
  public.payment_status
) TO anon, authenticated;
