-- Chiraz - Segmentation clients + robustesse encaissement + reporting

-- 1) Types métier
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_category') THEN
    CREATE TYPE public.customer_category AS ENUM ('b2b', 'boutique', 'online');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_instrument_status') THEN
    CREATE TYPE public.payment_instrument_status AS ENUM ('pending', 'cleared', 'rejected');
  END IF;
END $$;

-- 2) Customers: segmentation B2B/Boutique/Online
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS category public.customer_category NOT NULL DEFAULT 'boutique';

-- Backfill simple depuis orders.source pour les clients existants.
WITH source_counts AS (
  SELECT
    o.customer_id,
    o.source,
    COUNT(*) AS source_count
  FROM public.orders o
  WHERE o.customer_id IS NOT NULL
  GROUP BY o.customer_id, o.source
),
preferred_source AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    source
  FROM source_counts
  ORDER BY customer_id, source_count DESC, source
)
UPDATE public.customers c
SET category = CASE
  WHEN ps.source IN ('web', 'online') THEN 'online'::public.customer_category
  WHEN ps.source IN ('direct', 'boutique') THEN 'boutique'::public.customer_category
  ELSE 'b2b'::public.customer_category
END
FROM preferred_source ps
WHERE c.id = ps.customer_id
  AND c.category = 'boutique';

-- 3) Payment instruments lifecycle
ALTER TABLE public.payment_instruments
  ADD COLUMN IF NOT EXISTS status public.payment_instrument_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.payment_instruments
  DROP CONSTRAINT IF EXISTS payment_instruments_status_dates_check;

ALTER TABLE public.payment_instruments
  ADD CONSTRAINT payment_instruments_status_dates_check
  CHECK (
    (status = 'pending' AND cleared_at IS NULL AND rejected_at IS NULL)
    OR (status = 'cleared' AND cleared_at IS NOT NULL AND rejected_at IS NULL)
    OR (status = 'rejected' AND rejected_at IS NOT NULL AND cleared_at IS NULL)
  );

-- 4) Intégrité allocations paiement/commande
ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_payment_order_unique UNIQUE (payment_id, order_id);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_order_id ON public.payment_allocations(order_id);

CREATE OR REPLACE FUNCTION public.validate_payment_allocation_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_amount numeric(12,2);
  v_payment_customer uuid;
  v_order_customer uuid;
  v_alloc_total numeric(12,2);
BEGIN
  SELECT amount, customer_id
  INTO v_payment_amount, v_payment_customer
  FROM public.payments
  WHERE id = NEW.payment_id;

  SELECT customer_id
  INTO v_order_customer
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_payment_customer IS DISTINCT FROM v_order_customer THEN
    RAISE EXCEPTION 'Allocation invalide: payment.customer_id (%), order.customer_id (%)', v_payment_customer, v_order_customer;
  END IF;

  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_alloc_total
  FROM public.payment_allocations
  WHERE payment_id = NEW.payment_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_alloc_total := v_alloc_total + NEW.allocated_amount;

  IF v_alloc_total > v_payment_amount THEN
    RAISE EXCEPTION 'Allocation invalide: total alloué (%) > montant paiement (%)', v_alloc_total, v_payment_amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_allocation_integrity ON public.payment_allocations;
CREATE TRIGGER trg_validate_payment_allocation_integrity
BEFORE INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.validate_payment_allocation_integrity();

-- 5) Index de reporting
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);

CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

CREATE INDEX IF NOT EXISTS idx_payment_instruments_status ON public.payment_instruments(status);
CREATE INDEX IF NOT EXISTS idx_payment_instruments_due_date ON public.payment_instruments(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_instruments_payment_id ON public.payment_instruments(payment_id);

-- 6) Vues reporting (lecture)
CREATE OR REPLACE VIEW public.v_turnover_by_category AS
SELECT
  c.category,
  COUNT(o.id) AS orders_count,
  COALESCE(SUM(o.total), 0)::numeric(12,2) AS turnover
FROM public.orders o
JOIN public.customers c ON c.id = o.customer_id
WHERE o.status NOT IN ('annulé', 'refusé')
GROUP BY c.category;

CREATE OR REPLACE VIEW public.v_turnover_global AS
SELECT
  COUNT(o.id) AS orders_count,
  COALESCE(SUM(o.total), 0)::numeric(12,2) AS turnover
FROM public.orders o
WHERE o.status NOT IN ('annulé', 'refusé');

CREATE OR REPLACE VIEW public.v_top_clients AS
SELECT
  c.id AS customer_id,
  c.full_name,
  c.category,
  COALESCE(SUM(o.total), 0)::numeric(12,2) AS turnover,
  COALESCE(MAX(o.created_at), c.created_at) AS last_order_at,
  COALESCE(ca.solde, 0)::numeric(12,2) AS outstanding_balance
FROM public.customers c
LEFT JOIN public.orders o
  ON o.customer_id = c.id
  AND o.status NOT IN ('annulé', 'refusé')
LEFT JOIN public.customer_accounts ca ON ca.customer_id = c.id
GROUP BY c.id, c.full_name, c.category, ca.solde, c.created_at;

CREATE OR REPLACE VIEW public.v_recent_payments AS
SELECT
  p.id,
  p.customer_id,
  c.full_name AS customer_name,
  c.category,
  p.order_id,
  p.amount,
  p.method,
  p.status,
  p.reference,
  p.paid_at
FROM public.payments p
JOIN public.customers c ON c.id = p.customer_id;

CREATE OR REPLACE VIEW public.v_outstanding_balances AS
SELECT
  c.id AS customer_id,
  c.full_name,
  c.category,
  COALESCE(ca.total_du, 0)::numeric(12,2) AS total_due,
  COALESCE(ca.total_paye, 0)::numeric(12,2) AS total_paid,
  COALESCE(ca.solde, 0)::numeric(12,2) AS outstanding_balance
FROM public.customers c
LEFT JOIN public.customer_accounts ca ON ca.customer_id = c.id
WHERE COALESCE(ca.solde, 0) > 0;

GRANT SELECT ON public.v_turnover_by_category TO anon;
GRANT SELECT ON public.v_turnover_global TO anon;
GRANT SELECT ON public.v_top_clients TO anon;
GRANT SELECT ON public.v_recent_payments TO anon;
GRANT SELECT ON public.v_outstanding_balances TO anon;

-- 7) Aligner la création de commandes web/direct sur la catégorie client.
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
AS $$
DECLARE
  v_variant_id uuid;
  v_order_id uuid;
  v_customer_id uuid;
  v_customer_category public.customer_category;
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  v_customer_category := CASE
    WHEN COALESCE(p_source, 'web') IN ('web', 'online') THEN 'online'::public.customer_category
    WHEN COALESCE(p_source, 'web') IN ('direct', 'boutique') THEN 'boutique'::public.customer_category
    ELSE 'b2b'::public.customer_category
  END;

  INSERT INTO public.customers(full_name, phone, category, address, notes)
  VALUES (p_customer_name, p_phone, v_customer_category, p_city, null)
  ON CONFLICT (phone) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    category = EXCLUDED.category,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  INSERT INTO public.customer_accounts(customer_id)
  VALUES (v_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT v.id
  INTO v_variant_id
  FROM public.variants v
  WHERE v.product_id = p_product_id
    AND v.size = p_size
    AND ((p_color IS NULL AND v.color IS NULL) OR v.color = p_color)
    AND v.stock >= p_quantity
  LIMIT 1
  FOR UPDATE;

  IF v_variant_id IS NULL THEN
    RAISE EXCEPTION 'Stock insuffisant ou variante introuvable';
  END IF;

  INSERT INTO public.orders(
    customer_name, phone, city, total, status, source, customer_id, payment_status
  ) VALUES (
    p_customer_name, p_phone, p_city, p_total, 'nouveau', COALESCE(p_source, 'web'), v_customer_id, 'non_paye'
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items(order_id, variant_id, quantity, price)
  VALUES (v_order_id, v_variant_id, p_quantity, p_total);

  UPDATE public.variants
  SET stock = stock - p_quantity
  WHERE id = v_variant_id;

  INSERT INTO public.stock_movements(variant_id, type, quantity, reason, order_id)
  VALUES (v_variant_id, 'sortie', p_quantity, 'Commande client', v_order_id);

  UPDATE public.customer_accounts
  SET total_du = total_du + p_total,
      solde = solde + p_total,
      updated_at = now()
  WHERE customer_id = v_customer_id;

  RETURN v_order_id;
END;
$$;
