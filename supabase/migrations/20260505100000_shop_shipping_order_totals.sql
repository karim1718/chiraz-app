-- Paramètres boutique : frais de livraison par défaut + activation.
-- Commandes : sous-total articles et frais de livraison (total = sous-total + livraison).

-- ─── shop_shipping_settings (ligne singleton id = 1) ───────────────────────
CREATE TABLE IF NOT EXISTS public.shop_shipping_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shipping_enabled boolean NOT NULL DEFAULT true,
  default_shipping_fee numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (default_shipping_fee >= 0 AND default_shipping_fee <= 999999.99)
);

INSERT INTO public.shop_shipping_settings (id, shipping_enabled, default_shipping_fee)
VALUES (1, true, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.shop_shipping_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chiraz_shop_shipping_select" ON public.shop_shipping_settings;
CREATE POLICY "chiraz_shop_shipping_select"
  ON public.shop_shipping_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "chiraz_shop_shipping_update" ON public.shop_shipping_settings;
CREATE POLICY "chiraz_shop_shipping_update"
  ON public.shop_shipping_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON TABLE public.shop_shipping_settings TO anon, authenticated;
GRANT UPDATE ON TABLE public.shop_shipping_settings TO authenticated;

COMMENT ON TABLE public.shop_shipping_settings IS 'Boutique : frais de livraison par défaut et activation (id fixe = 1).';

-- ─── orders : sous-total et livraison ─────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(12, 2),
  ADD COLUMN IF NOT EXISTS delivery_cost numeric(12, 2) NOT NULL DEFAULT 0;

UPDATE public.orders
SET
  subtotal = COALESCE(subtotal, GREATEST(total - COALESCE(delivery_cost, 0), 0)),
  delivery_cost = COALESCE(delivery_cost, 0)
WHERE subtotal IS NULL;

COMMENT ON COLUMN public.orders.subtotal IS 'Total lignes (hors livraison), avant frais.';
COMMENT ON COLUMN public.orders.delivery_cost IS 'Frais de livraison facturés sur la commande.';

-- ─── create_order_with_stock : total = (prix unitaire × qté) + livraison ───
DROP FUNCTION IF EXISTS public.create_order_with_stock(
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
);

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
  p_payment_status public.payment_status DEFAULT NULL,
  p_delivery_cost numeric DEFAULT 0
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
  v_subtotal numeric;
  v_delivery numeric;
  v_grand_total numeric;
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  v_delivery := GREATEST(COALESCE(p_delivery_cost, 0), 0);
  v_subtotal := p_total * p_quantity;
  v_grand_total := v_subtotal + v_delivery;

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
    customer_name,
    phone,
    city,
    total,
    subtotal,
    delivery_cost,
    status,
    source,
    customer_id,
    payment_status
  ) VALUES (
    p_customer_name,
    p_phone,
    p_city,
    v_grand_total,
    v_subtotal,
    v_delivery,
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
      total_du = total_du + v_grand_total,
      solde = solde + v_grand_total,
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
  public.payment_status,
  numeric
) TO anon, authenticated;
