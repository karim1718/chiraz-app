-- Préparation encaissement depuis le CRM (sans enregistrement de paiement)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cashier_prep jsonb DEFAULT NULL;

COMMENT ON COLUMN public.orders.cashier_prep IS 'CRM: { completed_at, method, reference? } — validation préalable, pas un paiement.';
