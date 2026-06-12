import { supabase } from '../lib/supabase';

export type OrderLeadStatus = 'draft' | 'converted' | 'archived';

export interface OrderLeadPayload {
  fullName: string;
  phone: string;
  city: string;
  productId: string;
  productName: string;
  selectedSize: number | null;
  selectedColor: string | null;
  quantity: number;
  unitPrice: number;
  deliveryCost: number;
  total: number;
}

export interface OrderLead {
  id: string;
  session_key: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  product_id: string | null;
  product_name: string | null;
  selected_size: number | null;
  selected_color: string | null;
  quantity: number;
  unit_price: number | null;
  delivery_cost: number | null;
  total: number | null;
  status: OrderLeadStatus;
  converted_order_id: string | null;
  last_saved_at: string;
  created_at: string;
  updated_at: string;
}

/** Nouvelle session à chaque ouverture du modal = un prospect distinct par tentative. */
export function createLeadSessionKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function hasMeaningfulLeadData(payload: OrderLeadPayload): boolean {
  const name = payload.fullName.trim();
  const tel = payload.phone.trim();
  const ville = payload.city.trim();
  return Boolean(name || tel || ville);
}

export async function upsertOrderLead(
  sessionKey: string,
  payload: OrderLeadPayload,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('upsert_order_lead', {
    p_session_key: sessionKey,
    p_full_name: payload.fullName.trim() || null,
    p_phone: payload.phone.trim() || null,
    p_city: payload.city.trim() || null,
    p_product_id: payload.productId,
    p_product_name: payload.productName,
    p_selected_size: payload.selectedSize,
    p_selected_color: payload.selectedColor,
    p_quantity: payload.quantity,
    p_unit_price: payload.unitPrice,
    p_delivery_cost: payload.deliveryCost,
    p_total: payload.total,
  });

  if (error) {
    console.warn('[orderLead] upsert failed:', error.message);
    return null;
  }

  return (data as string) ?? null;
}

export async function markOrderLeadConverted(
  sessionKey: string,
  orderId: string,
): Promise<void> {
  const { error } = await supabase.rpc('mark_order_lead_converted', {
    p_session_key: sessionKey,
    p_order_id: orderId,
  });
  if (error) {
    console.warn('[orderLead] mark converted failed:', error.message);
  }
}

export async function fetchOrderLeads(options?: {
  status?: OrderLeadStatus | 'all';
  search?: string;
  limit?: number;
}): Promise<OrderLead[]> {
  let query = supabase
    .from('order_leads')
    .select('*')
    .order('last_saved_at', { ascending: false });

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as OrderLead[];
}

export async function archiveOrderLead(id: string): Promise<void> {
  const { error } = await supabase
    .from('order_leads')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
