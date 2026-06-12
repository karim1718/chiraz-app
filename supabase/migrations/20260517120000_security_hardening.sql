-- Chiraz — durcissement sécurité : RLS strict, RPC admin, catalogue boutique en lecture seule pour anon.
-- À appliquer dans Supabase SQL Editor (ou via supabase db push).

-- ─── Helper : admin JWT (app_metadata.role = admin) ───────────────────────
CREATE OR REPLACE FUNCTION public.is_chiraz_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

COMMENT ON FUNCTION public.is_chiraz_admin() IS
  'True when the current JWT has app_metadata.role = admin (Supabase Auth).';

-- ─── Révoquer les droits anon sur tables sensibles ─────────────────────────
REVOKE ALL ON TABLE public.customers FROM anon;
REVOKE ALL ON TABLE public.customer_accounts FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.payment_allocations FROM anon;
REVOKE ALL ON TABLE public.payment_instruments FROM anon;
REVOKE ALL ON TABLE public.payment_history FROM anon;
REVOKE ALL ON TABLE public.orders FROM anon;
REVOKE ALL ON TABLE public.order_items FROM anon;
REVOKE ALL ON TABLE public.order_status_history FROM anon;
REVOKE ALL ON TABLE public.stock_movements FROM anon;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.products FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.variants FROM anon;

GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT ON TABLE public.variants TO anon;

-- ─── Supprimer les anciennes policies permissives (anon / authenticated ouvert) ─
DROP POLICY IF EXISTS "chiraz_anon_orders_update" ON public.orders;
DROP POLICY IF EXISTS "chiraz_anon_orders_select" ON public.orders;
DROP POLICY IF EXISTS "chiraz_authenticated_orders_select" ON public.orders;
DROP POLICY IF EXISTS "chiraz_authenticated_orders_update" ON public.orders;

DROP POLICY IF EXISTS "chiraz_anon_order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "chiraz_anon_order_status_history_insert" ON public.order_status_history;
DROP POLICY IF EXISTS "chiraz_anon_order_status_history_select" ON public.order_status_history;

DROP POLICY IF EXISTS "chiraz_anon_variants_select" ON public.variants;
DROP POLICY IF EXISTS "chiraz_anon_variants_update" ON public.variants;
DROP POLICY IF EXISTS "chiraz_variants_insert_anon_auth" ON public.variants;
DROP POLICY IF EXISTS "chiraz_variants_delete_anon_auth" ON public.variants;
DROP POLICY IF EXISTS "chiraz_variants_select_authenticated" ON public.variants;
DROP POLICY IF EXISTS "chiraz_variants_update_authenticated" ON public.variants;

DROP POLICY IF EXISTS "chiraz_anon_stock_movements_insert" ON public.stock_movements;
DROP POLICY IF EXISTS "chiraz_anon_stock_movements_select" ON public.stock_movements;
DROP POLICY IF EXISTS "chiraz_authenticated_stock_movements_insert" ON public.stock_movements;
DROP POLICY IF EXISTS "chiraz_authenticated_stock_movements_select" ON public.stock_movements;

DROP POLICY IF EXISTS "chiraz_products_rw_anon_auth" ON public.products;
DROP POLICY IF EXISTS "chiraz_anon_customers_all" ON public.customers;
DROP POLICY IF EXISTS "chiraz_customers_rw_anon_auth" ON public.customers;
DROP POLICY IF EXISTS "chiraz_anon_customer_accounts_all" ON public.customer_accounts;
DROP POLICY IF EXISTS "chiraz_customer_accounts_rw_anon_auth" ON public.customer_accounts;
DROP POLICY IF EXISTS "chiraz_anon_payments_all" ON public.payments;
DROP POLICY IF EXISTS "chiraz_payments_rw_anon_auth" ON public.payments;
DROP POLICY IF EXISTS "chiraz_anon_payment_allocations_all" ON public.payment_allocations;
DROP POLICY IF EXISTS "chiraz_payment_allocations_rw_anon_auth" ON public.payment_allocations;
DROP POLICY IF EXISTS "chiraz_anon_payment_instruments_all" ON public.payment_instruments;
DROP POLICY IF EXISTS "chiraz_payment_instruments_rw_anon_auth" ON public.payment_instruments;
DROP POLICY IF EXISTS "chiraz_anon_payment_history_all" ON public.payment_history;
DROP POLICY IF EXISTS "chiraz_payment_history_rw_anon_auth" ON public.payment_history;

DROP POLICY IF EXISTS "chiraz_shop_shipping_update" ON public.shop_shipping_settings;

-- ─── Boutique (anon) : catalogue lecture seule ─────────────────────────────
DROP POLICY IF EXISTS "chiraz_anon_products_select_shop" ON public.products;
CREATE POLICY "chiraz_anon_products_select_shop"
  ON public.products
  FOR SELECT
  TO anon
  USING (is_active IS NULL OR is_active = true);

DROP POLICY IF EXISTS "chiraz_anon_variants_select_shop" ON public.variants;
CREATE POLICY "chiraz_anon_variants_select_shop"
  ON public.variants
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = variants.product_id
        AND (p.is_active IS NULL OR p.is_active = true)
    )
  );

-- shop_shipping : SELECT public, UPDATE admin
DROP POLICY IF EXISTS "chiraz_shop_shipping_select" ON public.shop_shipping_settings;
CREATE POLICY "chiraz_shop_shipping_select"
  ON public.shop_shipping_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "chiraz_shop_shipping_update_admin" ON public.shop_shipping_settings;
CREATE POLICY "chiraz_shop_shipping_update_admin"
  ON public.shop_shipping_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_chiraz_admin())
  WITH CHECK (public.is_chiraz_admin());

-- ─── Admin (authenticated + rôle admin) ────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products',
    'variants',
    'orders',
    'order_items',
    'order_status_history',
    'stock_movements',
    'customers',
    'customer_accounts',
    'payments',
    'payment_allocations',
    'payment_instruments',
    'payment_history'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS chiraz_admin_%I_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY chiraz_admin_%I_all ON public.%I FOR ALL TO authenticated USING (public.is_chiraz_admin()) WITH CHECK (public.is_chiraz_admin())',
      t,
      t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_items TO authenticated;
GRANT SELECT, INSERT ON TABLE public.order_status_history TO authenticated;
GRANT SELECT, INSERT ON TABLE public.stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_instruments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_history TO authenticated;

-- ─── Vues finance : admin uniquement ───────────────────────────────────────
REVOKE SELECT ON public.v_turnover_by_category FROM anon;
REVOKE SELECT ON public.v_turnover_global FROM anon;
REVOKE SELECT ON public.v_top_clients FROM anon;
REVOKE SELECT ON public.v_recent_payments FROM anon;
REVOKE SELECT ON public.v_outstanding_balances FROM anon;
REVOKE SELECT ON public.orders_outstanding FROM anon;

GRANT SELECT ON public.v_turnover_by_category TO authenticated;
GRANT SELECT ON public.v_turnover_global TO authenticated;
GRANT SELECT ON public.v_top_clients TO authenticated;
GRANT SELECT ON public.v_recent_payments TO authenticated;
GRANT SELECT ON public.v_outstanding_balances TO authenticated;
GRANT SELECT ON public.orders_outstanding TO authenticated;

-- ─── RPC : checkout public (restrictions si non-admin) ─────────────────────
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
  v_source text;
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  v_source := COALESCE(p_source, 'web');

  IF NOT public.is_chiraz_admin() THEN
    IF v_source NOT IN ('web', 'online') THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
    IF p_customer_id IS NOT NULL THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  v_delivery := GREATEST(COALESCE(p_delivery_cost, 0), 0);
  v_subtotal := p_total * p_quantity;
  v_grand_total := v_subtotal + v_delivery;

  v_payment_status := COALESCE(
    p_payment_status,
    CASE
      WHEN v_source IN ('web', 'online') THEN 'en_attente_encaissement'::public.payment_status
      ELSE 'non_paye'::public.payment_status
    END
  );

  IF NOT public.is_chiraz_admin() THEN
    v_payment_status := 'en_attente_encaissement'::public.payment_status;
    v_order_status := 'nouveau';
  ELSE
    v_order_status := COALESCE(NULLIF(BTRIM(p_order_status), ''), 'nouveau');
  END IF;

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
    v_source,
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

-- ─── RPC admin : garde is_chiraz_admin + EXECUTE réservé à authenticated ───
CREATE OR REPLACE FUNCTION public.chiraz_update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old text;
  v_n integer;
BEGIN
  IF NOT public.is_chiraz_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_order_id IS NULL OR p_new_status IS NULL OR btrim(p_new_status) = '' THEN
    RAISE EXCEPTION 'INVALID_ARGS';
  END IF;

  SELECT o.status::text
  INTO v_old
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  UPDATE public.orders o
  SET
    status = p_new_status,
    updated_at = now(),
    cancel_reason = CASE
      WHEN p_new_status = 'annulé' THEN p_reason
      ELSE o.cancel_reason
    END,
    refusal_reason = CASE
      WHEN p_new_status = 'refusé' THEN p_reason
      ELSE o.refusal_reason
    END
  WHERE o.id = p_order_id;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'ORDER_UPDATE_FAILED';
  END IF;

  INSERT INTO public.order_status_history (order_id, old_status, new_status, reason)
  VALUES (p_order_id, v_old, p_new_status, p_reason);

  RETURN json_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.chiraz_update_order_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.chiraz_update_order_status(uuid, text, text) TO authenticated;

-- register_order_payment : garde admin + corps inchangé (20260430120000)
CREATE OR REPLACE FUNCTION public.register_order_payment(
  p_customer_id uuid,
  p_order_id uuid,
  p_amount numeric(12, 2),
  p_method public.payment_method,
  p_status public.payment_status,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_cheque_number text DEFAULT NULL,
  p_bank_name text DEFAULT NULL,
  p_deposit_date date DEFAULT NULL,
  p_due_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_order_total numeric(12, 2);
  v_order_customer_id uuid;
  v_order_number text;
  v_order_source text;
  v_paid_so_far numeric(12, 2);
  v_remaining numeric(12, 2);
  v_paid_after numeric(12, 2);
  v_next_status public.payment_status;
  v_customer_ref text;
  v_paid_at timestamptz;
  v_eps numeric(12, 4) := 0.01;
  v_channel text;
BEGIN
  IF NOT public.is_chiraz_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_order_id IS NULL THEN
    INSERT INTO public.payments (customer_id, order_id, amount, method, status, reference, notes)
    VALUES (p_customer_id, NULL, p_amount, p_method, p_status, p_reference, p_notes)
    RETURNING id, paid_at INTO v_payment_id, v_paid_at;

    IF p_method IN ('cheque', 'bank_transfer', 'bill_of_exchange') THEN
      INSERT INTO public.payment_instruments (
        payment_id, cheque_number, bank_name, deposit_date, due_date, status
      )
      VALUES (
        v_payment_id, p_cheque_number, p_bank_name, p_deposit_date, p_due_date, 'pending'
      );
    END IF;

    INSERT INTO public.customer_accounts (customer_id)
    VALUES (p_customer_id)
    ON CONFLICT (customer_id) DO NOTHING;

    UPDATE public.customer_accounts
    SET
      total_paye = total_paye + p_amount,
      solde = solde - p_amount,
      updated_at = now()
    WHERE customer_id = p_customer_id;

    SELECT customer_ref INTO v_customer_ref
    FROM public.customers
    WHERE id = p_customer_id;

    INSERT INTO public.payment_history (payment_id, order_id, customer_id, event_type, payload)
    VALUES (
      v_payment_id,
      NULL,
      p_customer_id,
      'payment_created',
      jsonb_build_object(
        'amount', p_amount,
        'method', p_method::text,
        'status', p_status::text,
        'paid_at', v_paid_at,
        'order_number', NULL,
        'customer_ref', v_customer_ref,
        'channel', 'Boutique',
        'source', NULL
      )
    );

    RETURN v_payment_id;
  END IF;

  SELECT o.total, o.customer_id, o.order_number, o.source
  INTO v_order_total, v_order_customer_id, v_order_number, v_order_source
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order_customer_id IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'CUSTOMER_MISMATCH';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_paid_so_far
  FROM public.payments p
  WHERE p.order_id = p_order_id
    AND p.status <> 'en_retard';

  v_remaining := v_order_total - v_paid_so_far;

  IF v_remaining <= v_eps THEN
    INSERT INTO public.payment_history (payment_id, order_id, customer_id, event_type, payload)
    VALUES (
      NULL,
      p_order_id,
      p_customer_id,
      'payment_blocked_duplicate',
      jsonb_build_object(
        'reason', 'ORDER_ALREADY_PAID',
        'order_number', v_order_number,
        'order_total', v_order_total,
        'paid_so_far', v_paid_so_far,
        'attempted_amount', p_amount
      )
    );
    RAISE EXCEPTION 'ORDER_ALREADY_PAID';
  END IF;

  IF p_amount > v_remaining + v_eps THEN
    RAISE EXCEPTION 'AMOUNT_OVER_REMAINING';
  END IF;

  INSERT INTO public.payments (customer_id, order_id, amount, method, status, reference, notes)
  VALUES (p_customer_id, p_order_id, p_amount, p_method, p_status, p_reference, p_notes)
  RETURNING id, paid_at INTO v_payment_id, v_paid_at;

  INSERT INTO public.payment_allocations (payment_id, order_id, allocated_amount)
  VALUES (v_payment_id, p_order_id, p_amount);

  IF p_method IN ('cheque', 'bank_transfer', 'bill_of_exchange') THEN
    INSERT INTO public.payment_instruments (
      payment_id, cheque_number, bank_name, deposit_date, due_date, status
    )
    VALUES (
      v_payment_id, p_cheque_number, p_bank_name, p_deposit_date, p_due_date, 'pending'
    );
  END IF;

  INSERT INTO public.customer_accounts (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  UPDATE public.customer_accounts
  SET
    total_paye = total_paye + p_amount,
    solde = solde - p_amount,
    updated_at = now()
  WHERE customer_id = p_customer_id;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_paid_after
  FROM public.payments p
  WHERE p.order_id = p_order_id
    AND p.status <> 'en_retard';

  v_next_status := CASE
    WHEN v_paid_after <= 0 THEN 'non_paye'::public.payment_status
    WHEN v_paid_after + v_eps < v_order_total THEN 'partiellement_paye'::public.payment_status
    ELSE 'paye'::public.payment_status
  END;

  UPDATE public.orders
  SET payment_status = v_next_status
  WHERE id = p_order_id;

  SELECT c.customer_ref INTO v_customer_ref
  FROM public.customers c
  WHERE c.id = p_customer_id;

  v_channel := CASE
    WHEN lower(COALESCE(v_order_source, '')) IN ('web', 'online') THEN 'Commande en ligne'
    ELSE 'Boutique'
  END;

  INSERT INTO public.payment_history (payment_id, order_id, customer_id, event_type, payload)
  VALUES (
    v_payment_id,
    p_order_id,
    p_customer_id,
    'payment_created',
    jsonb_build_object(
      'amount', p_amount,
      'method', p_method::text,
      'status', p_status::text,
      'paid_at', v_paid_at,
      'order_number', v_order_number,
      'customer_ref', v_customer_ref,
      'channel', v_channel,
      'source', v_order_source
    )
  );

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_order_payment(
  uuid,
  uuid,
  numeric(12, 2),
  public.payment_method,
  public.payment_status,
  text,
  text,
  text,
  text,
  date,
  date
) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_order_payment(
  uuid,
  uuid,
  numeric(12, 2),
  public.payment_method,
  public.payment_status,
  text,
  text,
  text,
  text,
  date,
  date
) TO authenticated;

-- CRM RPCs
CREATE OR REPLACE FUNCTION public.update_customer_profile(
  p_customer_id uuid,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_category public.customer_category DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_chiraz_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.customers
  SET
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    category = COALESCE(p_category, category),
    address = COALESCE(p_address, address),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_customer_profile(uuid, text, text, public.customer_category, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_customer_profile(uuid, text, text, public.customer_category, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_customers_crm(
  p_search text DEFAULT NULL,
  p_category public.customer_category DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  category public.customer_category,
  address text,
  notes text,
  created_at timestamptz,
  total_du numeric,
  total_paye numeric,
  solde numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_chiraz_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.full_name,
    c.phone,
    c.category,
    c.address,
    c.notes,
    c.created_at,
    COALESCE(ca.total_du, 0) AS total_du,
    COALESCE(ca.total_paye, 0) AS total_paye,
    COALESCE(ca.solde, 0) AS solde
  FROM public.customers c
  LEFT JOIN public.customer_accounts ca ON ca.customer_id = c.id
  WHERE (p_category IS NULL OR c.category = p_category)
    AND (
      p_search IS NULL
      OR c.full_name ILIKE '%' || p_search || '%'
      OR c.phone ILIKE '%' || p_search || '%'
    )
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.list_customers_crm(text, public.customer_category, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_customers_crm(text, public.customer_category, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_customer_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_status public.payment_status,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_cheque_number text DEFAULT NULL,
  p_bank_name text DEFAULT NULL,
  p_deposit_date date DEFAULT NULL,
  p_due_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_total_paye numeric;
  v_solde numeric;
  v_order_total numeric;
  v_paid numeric;
  v_next_status public.payment_status;
BEGIN
  IF NOT public.is_chiraz_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.payments(customer_id, order_id, amount, method, status, reference, notes)
  VALUES (p_customer_id, p_order_id, p_amount, p_method, p_status, p_reference, p_notes)
  RETURNING id INTO v_payment_id;

  IF p_order_id IS NOT NULL THEN
    INSERT INTO public.payment_allocations(payment_id, order_id, allocated_amount)
    VALUES (v_payment_id, p_order_id, p_amount);
  END IF;

  IF p_method IN ('cheque', 'bank_transfer', 'bill_of_exchange') THEN
    INSERT INTO public.payment_instruments(
      payment_id, cheque_number, bank_name, deposit_date, due_date, status
    )
    VALUES (
      v_payment_id, p_cheque_number, p_bank_name, p_deposit_date, p_due_date, 'pending'
    );
  END IF;

  SELECT COALESCE(total_paye, 0), COALESCE(solde, 0)
  INTO v_total_paye, v_solde
  FROM public.customer_accounts
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  UPDATE public.customer_accounts
  SET total_paye = v_total_paye + p_amount,
      solde = v_solde - p_amount,
      updated_at = now()
  WHERE customer_id = p_customer_id;

  IF p_order_id IS NOT NULL THEN
    SELECT COALESCE(total, 0) INTO v_order_total FROM public.orders WHERE id = p_order_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
    WHERE order_id = p_order_id
      AND status <> 'en_retard';

    v_next_status := CASE
      WHEN v_paid <= 0 THEN 'non_paye'
      WHEN v_paid < v_order_total THEN 'partiellement_paye'
      ELSE 'paye'
    END;

    UPDATE public.orders SET payment_status = v_next_status WHERE id = p_order_id;
  END IF;

  INSERT INTO public.payment_history(payment_id, order_id, customer_id, event_type, payload)
  VALUES (
    v_payment_id,
    p_order_id,
    p_customer_id,
    'payment_created',
    jsonb_build_object('amount', p_amount, 'method', p_method, 'status', p_status)
  );

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_customer_payment(
  uuid, uuid, numeric, public.payment_method, public.payment_status, text, text, text, text, date, date
) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(
  uuid, uuid, numeric, public.payment_method, public.payment_status, text, text, text, text, date, date
) TO authenticated;

-- reconcile (admin) ; link_or_create : REVOKE anon API seulement (trigger DB conserve l'accès)
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
  IF NOT public.is_chiraz_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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

REVOKE ALL ON FUNCTION public.chiraz_reconcile_payment_statuses() FROM anon;
GRANT EXECUTE ON FUNCTION public.chiraz_reconcile_payment_statuses() TO authenticated;

REVOKE ALL ON FUNCTION public.chiraz_link_or_create_customer_for_order(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.chiraz_link_or_create_customer_for_order(uuid) TO authenticated;

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
  IF NOT public.is_chiraz_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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

REVOKE ALL ON FUNCTION public.chiraz_backfill_livre_customers() FROM anon;
GRANT EXECUTE ON FUNCTION public.chiraz_backfill_livre_customers() TO authenticated;

NOTIFY pgrst, 'reload schema';
