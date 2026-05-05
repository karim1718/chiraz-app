-- Customer CRM RPC + transactional payment recording

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
AS $$
BEGIN
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
LANGUAGE sql
SECURITY DEFINER
AS $$
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
$$;

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
AS $$
DECLARE
  v_payment_id uuid;
  v_total_paye numeric;
  v_solde numeric;
  v_order_total numeric;
  v_paid numeric;
  v_next_status public.payment_status;
BEGIN
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

CREATE INDEX IF NOT EXISTS idx_customers_category_name ON public.customers(category, full_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer_paid_at ON public.payments(customer_id, paid_at DESC);

GRANT EXECUTE ON FUNCTION public.update_customer_profile(uuid, text, text, public.customer_category, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.list_customers_crm(text, public.customer_category, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(
  uuid, uuid, numeric, public.payment_method, public.payment_status, text, text, text, text, date, date
) TO anon;
