-- CMD / CLT references, duplicate phones allowed, create_order_without customer at checkout

-- 1) orders.order_number + daily sequence
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text;

CREATE TABLE IF NOT EXISTS public.order_number_counters (
  day text PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.bump_order_number_seq(p_day text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v int;
BEGIN
  INSERT INTO public.order_number_counters (day, last_value)
  VALUES (p_day, 1)
  ON CONFLICT (day) DO UPDATE
  SET last_value = public.order_number_counters.last_value + 1
  RETURNING last_value INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  d text;
  n int;
BEGIN
  IF NEW.order_number IS NOT NULL AND btrim(NEW.order_number) <> '' THEN
    RETURN NEW;
  END IF;
  d := to_char(((now() AT TIME ZONE 'Africa/Algiers'))::date, 'YYYYMMDD');
  n := public.bump_order_number_seq(d);
  NEW.order_number := 'CMD-' || d || '-' || lpad(n::text, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_order_number ON public.orders;
CREATE TRIGGER trg_assign_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_number();

-- Backfill existing orders (preserve per-day ordering by created_at)
WITH ranked AS (
  SELECT
    id,
    to_char(((created_at AT TIME ZONE 'Africa/Algiers'))::date, 'YYYYMMDD') AS d,
    row_number() OVER (
      PARTITION BY ((created_at AT TIME ZONE 'Africa/Algiers'))::date
      ORDER BY created_at
    ) AS n
  FROM public.orders
  WHERE order_number IS NULL OR btrim(order_number) = ''
)
UPDATE public.orders o
SET order_number = 'CMD-' || r.d || '-' || lpad(r.n::text, 5, '0')
FROM ranked r
WHERE o.id = r.id;

INSERT INTO public.order_number_counters (day, last_value)
SELECT
  split_part(o.order_number, '-', 2) AS day,
  max(nullif(split_part(o.order_number, '-', 3), '')::int) AS last_value
FROM public.orders o
WHERE o.order_number ~ '^CMD-[0-9]{8}-[0-9]+$'
GROUP BY 1
ON CONFLICT (day) DO UPDATE
SET last_value = GREATEST(public.order_number_counters.last_value, EXCLUDED.last_value);

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders (order_number);

-- 2) customers.customer_ref + sequence; drop unique phone
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_ref text;

CREATE SEQUENCE IF NOT EXISTS public.customer_ref_seq;

CREATE OR REPLACE FUNCTION public.assign_customer_ref()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_ref IS NOT NULL AND btrim(NEW.customer_ref) <> '' THEN
    RETURN NEW;
  END IF;
  NEW.customer_ref := 'CLT-' || lpad(nextval('public.customer_ref_seq')::text, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_customer_ref ON public.customers;
CREATE TRIGGER trg_assign_customer_ref
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.assign_customer_ref();

WITH numbered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at) AS rn
  FROM public.customers
  WHERE customer_ref IS NULL OR btrim(customer_ref) = ''
)
UPDATE public.customers c
SET customer_ref = 'CLT-' || lpad(n.rn::text, 5, '0')
FROM numbered n
WHERE c.id = n.id;

SELECT setval(
  'public.customer_ref_seq',
  GREATEST(
    1,
    COALESCE(
      (
        SELECT MAX(SUBSTRING(customer_ref FROM 5)::integer)
        FROM public.customers
        WHERE customer_ref ~ '^CLT-[0-9]+$'
      ),
      0
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_ref_key ON public.customers (customer_ref);

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_phone_key;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);

-- 3) create_order_with_stock: no customer at checkout; optional en_attente_encaissement for web
CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_product_id uuid,
  p_size numeric,
  p_color text,
  p_customer_name text,
  p_phone text,
  p_city text,
  p_total numeric,
  p_quantity integer DEFAULT 1,
  p_source text DEFAULT 'web'
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
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  v_payment_status := CASE
    WHEN COALESCE(p_source, 'web') IN ('web', 'online') THEN 'en_attente_encaissement'::public.payment_status
    ELSE 'non_paye'::public.payment_status
  END;

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
    p_customer_name, p_phone, p_city, p_total, 'nouveau', COALESCE(p_source, 'web'), NULL, v_payment_status
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, variant_id, quantity, price)
  VALUES (v_order_id, v_variant_id, p_quantity, p_total);

  UPDATE public.variants
  SET stock = stock - p_quantity
  WHERE id = v_variant_id;

  INSERT INTO public.stock_movements (variant_id, type, quantity, reason, order_id)
  VALUES (v_variant_id, 'sortie', p_quantity, 'Commande client', v_order_id);

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_stock(uuid, numeric, text, text, text, text, numeric, integer, text) TO anon, authenticated;
