-- Brouillons / prospects : sauvegarde automatique du formulaire commande (sans stock ni commande officielle).

CREATE TYPE public.order_lead_status AS ENUM ('draft', 'converted', 'archived');

CREATE TABLE IF NOT EXISTS public.order_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text NOT NULL,
  full_name text,
  phone text,
  city text,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  product_name text,
  selected_size numeric,
  selected_color text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12, 2),
  delivery_cost numeric(12, 2) DEFAULT 0,
  total numeric(12, 2),
  status public.order_lead_status NOT NULL DEFAULT 'draft',
  converted_order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_leads_session_key_unique UNIQUE (session_key),
  CONSTRAINT order_leads_quantity_positive CHECK (quantity >= 1)
);

CREATE INDEX IF NOT EXISTS idx_order_leads_status ON public.order_leads (status);
CREATE INDEX IF NOT EXISTS idx_order_leads_last_saved_at ON public.order_leads (last_saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_leads_phone ON public.order_leads (phone);

COMMENT ON TABLE public.order_leads IS
  'Prospects / formulaires abandonnés avant clic Commander. Ne décrémente pas le stock.';

ALTER TABLE public.order_leads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_leads FROM anon;

GRANT SELECT, UPDATE ON TABLE public.order_leads TO authenticated;

DROP POLICY IF EXISTS chiraz_admin_order_leads_all ON public.order_leads;
CREATE POLICY chiraz_admin_order_leads_all
  ON public.order_leads
  FOR ALL
  TO authenticated
  USING (public.is_chiraz_admin())
  WITH CHECK (public.is_chiraz_admin());

-- ─── RPC public : upsert brouillon par session_key ───────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_order_lead(
  p_session_key text,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_product_name text DEFAULT NULL,
  p_selected_size numeric DEFAULT NULL,
  p_selected_color text DEFAULT NULL,
  p_quantity integer DEFAULT 1,
  p_unit_price numeric DEFAULT NULL,
  p_delivery_cost numeric DEFAULT 0,
  p_total numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_key text;
BEGIN
  v_key := NULLIF(BTRIM(p_session_key), '');
  IF v_key IS NULL OR length(v_key) < 8 OR length(v_key) > 128 THEN
    RAISE EXCEPTION 'INVALID_SESSION_KEY';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  INSERT INTO public.order_leads (
    session_key,
    full_name,
    phone,
    city,
    product_id,
    product_name,
    selected_size,
    selected_color,
    quantity,
    unit_price,
    delivery_cost,
    total,
    status,
    last_saved_at,
    updated_at
  )
  VALUES (
    v_key,
    NULLIF(BTRIM(p_full_name), ''),
    NULLIF(BTRIM(p_phone), ''),
    NULLIF(BTRIM(p_city), ''),
    p_product_id,
    NULLIF(BTRIM(p_product_name), ''),
    p_selected_size,
    NULLIF(BTRIM(p_selected_color), ''),
    p_quantity,
    p_unit_price,
    GREATEST(COALESCE(p_delivery_cost, 0), 0),
    p_total,
    'draft',
    now(),
    now()
  )
  ON CONFLICT (session_key) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city,
    product_id = EXCLUDED.product_id,
    product_name = EXCLUDED.product_name,
    selected_size = EXCLUDED.selected_size,
    selected_color = EXCLUDED.selected_color,
    quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price,
    delivery_cost = EXCLUDED.delivery_cost,
    total = EXCLUDED.total,
    last_saved_at = now(),
    updated_at = now()
  WHERE public.order_leads.status = 'draft'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT ol.id INTO v_id
    FROM public.order_leads ol
    WHERE ol.session_key = v_key;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_order_lead(
  text, text, text, text, uuid, text, numeric, text, integer, numeric, numeric, numeric
) TO anon, authenticated;

-- ─── RPC public : marquer converti après createOrder ───────────────────────
CREATE OR REPLACE FUNCTION public.mark_order_lead_converted(
  p_session_key text,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_n integer;
BEGIN
  v_key := NULLIF(BTRIM(p_session_key), '');
  IF v_key IS NULL OR p_order_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.order_leads
  SET
    status = 'converted',
    converted_order_id = p_order_id,
    updated_at = now()
  WHERE session_key = v_key
    AND status = 'draft';

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_lead_converted(text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
