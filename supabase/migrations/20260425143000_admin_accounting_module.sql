-- Chiraz - Module comptable admin (encaissements, clients, alertes)

-- 1) Types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM (
      'cash',
      'cheque',
      'bank_transfer',
      'bill_of_exchange',
      'mixed',
      'deferred'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM (
      'non_paye',
      'partiellement_paye',
      'paye',
      'en_attente_encaissement',
      'en_retard'
    );
  END IF;
END $$;

-- 2) Clients + compte client
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL UNIQUE,
  address text,
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  total_du numeric(12,2) NOT NULL DEFAULT 0,
  total_paye numeric(12,2) NOT NULL DEFAULT 0,
  solde numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Liaison commande -> client + statut paiement
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'non_paye';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS due_date date;

-- 4) Paiements
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'non_paye',
  reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  cheque_number text,
  bank_name text,
  deposit_date date,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  allocated_amount numeric(12,2) NOT NULL CHECK (allocated_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Historique paiements pour audit
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) Fonction atomique: création commande + décrément stock + mouvement stock + client
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
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  INSERT INTO public.customers(full_name, phone, address, notes)
  VALUES (p_customer_name, p_phone, p_city, null)
  ON CONFLICT (phone) DO UPDATE SET
    full_name = EXCLUDED.full_name,
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

GRANT EXECUTE ON FUNCTION public.create_order_with_stock(uuid, numeric, text, text, text, text, numeric, integer, text) TO anon, authenticated;

-- 7) RLS permissif aligné architecture actuelle admin anon
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chiraz_anon_customers_all" ON public.customers;
CREATE POLICY "chiraz_anon_customers_all" ON public.customers FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_customer_accounts_all" ON public.customer_accounts;
CREATE POLICY "chiraz_anon_customer_accounts_all" ON public.customer_accounts FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_payments_all" ON public.payments;
CREATE POLICY "chiraz_anon_payments_all" ON public.payments FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_payment_instruments_all" ON public.payment_instruments;
CREATE POLICY "chiraz_anon_payment_instruments_all" ON public.payment_instruments FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_payment_allocations_all" ON public.payment_allocations;
CREATE POLICY "chiraz_anon_payment_allocations_all" ON public.payment_allocations FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chiraz_anon_payment_history_all" ON public.payment_history;
CREATE POLICY "chiraz_anon_payment_history_all" ON public.payment_history FOR ALL TO anon USING (true) WITH CHECK (true);
