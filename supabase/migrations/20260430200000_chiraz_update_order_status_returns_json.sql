-- PostgREST PGRST202 : si 20260430180000 avait créé RETURNS void, OR REPLACE ne suffit pas pour passer en json.
-- Cette migration assure DROP + CREATE sur les dépôts où l’historique marque déjà 20260430180000 comme appliquée.

DROP FUNCTION IF EXISTS public.chiraz_update_order_status(uuid, text, text);

CREATE FUNCTION public.chiraz_update_order_status(
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

GRANT EXECUTE ON FUNCTION public.chiraz_update_order_status(uuid, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
