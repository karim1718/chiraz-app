-- Encaissement atomique : verrou ligne commande + une transaction (évite doublons concurrents).

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

  -- Verrou commande : sérialise les encaissements sur la même référence
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
) TO anon, authenticated;
