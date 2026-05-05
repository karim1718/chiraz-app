import { supabase } from '../lib/supabase';
import type { PaymentMethod, PaymentStatus } from '../types/order';
import type {
  CategoryTurnover,
  CustomerCategory,
  GlobalTurnover,
  OutstandingBalance,
  RecentPaymentRow,
  TopClient,
} from '../types/finance';

export interface CreateCustomerInput {
  fullName: string;
  phone: string;
  category?: CustomerCategory;
  address?: string;
  photoUrl?: string;
  notes?: string;
}

export interface ListCustomersInput {
  search?: string;
  category?: CustomerCategory | 'all';
  page?: number;
  pageSize?: number;
}

export interface CustomerListItem {
  id: string;
  full_name: string;
  phone: string;
  category: CustomerCategory;
  address: string | null;
  notes: string | null;
  photo_url?: string | null;
  created_at: string;
  customer_ref?: string | null;
}

export interface CustomerSummary {
  customer: CustomerListItem;
  account: {
    total_du: number;
    total_paye: number;
    solde: number;
  };
}

export async function upsertCustomer(input: CreateCustomerInput): Promise<string> {
  const payload = {
    full_name: input.fullName,
    phone: input.phone,
    category: input.category || 'boutique',
    address: input.address || null,
    photo_url: input.photoUrl || null,
    notes: input.notes || null,
  };

  const { data, error } = await supabase.from('customers').insert(payload).select('id').single();

  if (error || !data) {
    if (error?.message?.toLowerCase().includes('row-level security')) {
      throw new Error(
        'RLS bloque la création client. Exécute la migration Supabase la plus récente puis réessaie.',
      );
    }
    throw new Error(error?.message || 'Impossible de créer le client.');
  }

  const { error: accountError } = await supabase
    .from('customer_accounts')
    .upsert({ customer_id: data.id }, { onConflict: 'customer_id' });

  if (accountError) throw new Error(accountError.message);

  return data.id as string;
}

export async function updateCustomerProfile(
  customerId: string,
  patch: Partial<
    Pick<CreateCustomerInput, 'fullName' | 'phone' | 'category' | 'address' | 'notes' | 'photoUrl'>
  >,
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};
  if (patch.fullName !== undefined) updatePayload.full_name = patch.fullName;
  if (patch.phone !== undefined) updatePayload.phone = patch.phone;
  if (patch.category !== undefined) updatePayload.category = patch.category;
  if (patch.address !== undefined) updatePayload.address = patch.address || null;
  if (patch.notes !== undefined) updatePayload.notes = patch.notes || null;
  if (patch.photoUrl !== undefined) updatePayload.photo_url = patch.photoUrl || null;
  updatePayload.updated_at = new Date().toISOString();

  const { error } = await supabase.from('customers').update(updatePayload).eq('id', customerId);
  if (error) throw new Error(error.message);
}

const PRODUCT_IMAGES_BUCKET =
  import.meta.env.VITE_SUPABASE_PRODUCT_IMAGES_BUCKET || 'product-images';

/** Upload avatar into the same public bucket as product images: `customers/{customerId}/…` */
export async function uploadCustomerAvatar(file: File, customerId: string): Promise<string> {
  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
  const path = `customers/${customerId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });

  if (error) {
    if (error.message?.toLowerCase().includes('bucket not found')) {
      throw new Error(
        `Bucket Storage "${PRODUCT_IMAGES_BUCKET}" introuvable. Créez-le ou définissez VITE_SUPABASE_PRODUCT_IMAGES_BUCKET.`,
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function listCustomers(input: ListCustomersInput = {}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('customers')
    .select('id, full_name, phone, category, address, notes, photo_url, created_at, customer_ref', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (input.category && input.category !== 'all') {
    query = query.eq('category', input.category);
  }

  if (input.search?.trim()) {
    const term = input.search.trim();
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    customers: (data || []) as CustomerListItem[],
    total: count || 0,
    page,
    pageSize,
  };
}

export async function getCustomerSummary(customerId: string): Promise<CustomerSummary> {
  const [{ data: customer, error: customerError }, { data: account, error: accountError }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('id, full_name, phone, category, address, notes, photo_url, created_at, customer_ref')
        .eq('id', customerId)
        .maybeSingle(),
      supabase
        .from('customer_accounts')
        .select('total_du, total_paye, solde')
        .eq('customer_id', customerId)
        .maybeSingle(),
    ]);

  if (customerError || !customer) throw new Error(customerError?.message || 'Client introuvable.');
  if (accountError) throw new Error(accountError.message);

  return {
    customer: customer as CustomerListItem,
    account: {
      total_du: Number(account?.total_du || 0),
      total_paye: Number(account?.total_paye || 0),
      solde: Number(account?.solde || 0),
    },
  };
}

export async function getCustomerOrders(customerId: string, page = 1, pageSize = 50) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('orders')
    .select('id, order_number, created_at, total, status, payment_status, source, cashier_prep', { count: 'exact' })
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return { rows: data || [], total: count || 0, page, pageSize };
}

export async function getCustomerPayments(customerId: string, page = 1, pageSize = 50) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('payments')
    .select('id, order_id, paid_at, amount, method, status, reference', { count: 'exact' })
    .eq('customer_id', customerId)
    .order('paid_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return { rows: data || [], total: count || 0, page, pageSize };
}

export async function ensureOrderHasCustomer(orderId: string): Promise<string> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, customer_id, customer_name, phone, city, total, source')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !order) {
    throw new Error(error?.message || 'Commande introuvable.');
  }

  if (order.customer_id) {
    return order.customer_id as string;
  }

  const src = String(order.source || '').toLowerCase();
  const category: CustomerCategory = src === 'web' || src === 'online' ? 'online' : 'boutique';

  const rawPhone = typeof order.phone === 'string' ? order.phone.trim() : '';
  const normalizedPhone = rawPhone || `sans-tel-${orderId.slice(0, 8)}`;

  const { data: byPhoneRows, error: findErr } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', normalizedPhone)
    .limit(1);

  if (findErr) {
    throw new Error(findErr.message);
  }

  const existing = byPhoneRows?.[0];
  let customerId: string;

  if (existing?.id) {
    customerId = existing.id as string;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('customers')
      .insert({
        full_name: (order.customer_name as string) || 'Client',
        phone: normalizedPhone,
        category,
        address: (order.city as string) || null,
        notes: null,
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      throw new Error(insErr?.message || 'Impossible de créer la fiche client pour cette commande.');
    }
    customerId = inserted.id as string;
  }

  const { error: acctErr } = await supabase
    .from('customer_accounts')
    .upsert({ customer_id: customerId }, { onConflict: 'customer_id' });

  if (acctErr) throw new Error(acctErr.message);

  const { error: linkError } = await supabase
    .from('orders')
    .update({ customer_id: customerId })
    .eq('id', orderId);

  if (linkError) throw new Error(linkError.message);

  const { data: paymentRows } = await supabase
    .from('payments')
    .select('amount, status')
    .eq('order_id', orderId);

  const alreadyPaid = (paymentRows || []).reduce((sum, row) => {
    const st = String(row.status || '').toLowerCase();
    if (st === 'en_retard') return sum;
    return sum + Number(row.amount || 0);
  }, 0);
  const remaining = Math.max(Number(order.total || 0) - alreadyPaid, 0);

  if (remaining > 0) {
    const { data: account } = await supabase
      .from('customer_accounts')
      .select('total_du, solde')
      .eq('customer_id', customerId)
      .maybeSingle();

    await supabase
      .from('customer_accounts')
      .update({
        total_du: Number(account?.total_du || 0) + remaining,
        solde: Number(account?.solde || 0) + remaining,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customerId);
  }

  return customerId;
}

/** Promote orphan delivered orders to linked customers (idempotent). Bounded for safety. */
export async function promoteOrphanLivreOrders(): Promise<{ promoted: number }> {
  const livreStatuses = ['livré', 'livre'];
  const q1 = await supabase
    .from('orders_outstanding')
    .select('id')
    .is('customer_id', null)
    .in('status', livreStatuses)
    .limit(500);

  let rows: { id: string }[] = [];
  if (q1.error) {
    const q2 = await supabase
      .from('orders')
      .select('id')
      .is('customer_id', null)
      .in('status', livreStatuses)
      .limit(500);
    if (q2.error) {
      console.warn('[promoteOrphanLivreOrders]', q2.error.message);
      return { promoted: 0 };
    }
    rows = (q2.data as { id: string }[]) || [];
  } else {
    rows = (q1.data as { id: string }[]) || [];
  }

  let promoted = 0;
  for (const row of rows) {
    const id = row.id as string;
    try {
      await ensureOrderHasCustomer(id);
      promoted += 1;
    } catch (e) {
      console.warn('[promoteOrphanLivreOrders]', id, e);
    }
  }
  return { promoted };
}

export interface RegisterPaymentInput {
  customerId: string;
  orderId?: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  notes?: string;
  chequeNumber?: string;
  bankName?: string;
  depositDate?: string;
  dueDate?: string;
}

function mapRegisterPaymentRpcError(raw: string | undefined): string {
  const m = (raw || '').toUpperCase();
  if (m.includes('ORDER_ALREADY_PAID')) {
    return (
      'Cette commande a déjà été entièrement encaissée. Rafraîchissez la page si la liste ne ' +
      's’est pas mise à jour. Aucune action supplémentaire n’est possible.'
    );
  }
  if (m.includes('AMOUNT_OVER_REMAINING')) {
    return 'Le montant dépasse le reliquat restant sur cette commande.';
  }
  if (m.includes('CUSTOMER_MISMATCH')) {
    return 'Le client sélectionné ne correspond pas à la commande.';
  }
  if (m.includes('ORDER_NOT_FOUND')) {
    return 'Commande introuvable.';
  }
  if (m.includes('INVALID_AMOUNT')) {
    return 'Montant invalide.';
  }
  return raw || 'Paiement non enregistré.';
}

export async function registerPayment(input: RegisterPaymentInput): Promise<string> {
  const parseDate = (s?: string) => {
    if (!s || !String(s).trim()) return null;
    const d = String(s).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  };

  const { data, error } = await supabase.rpc('register_order_payment', {
    p_customer_id: input.customerId,
    p_order_id: input.orderId ?? null,
    p_amount: input.amount,
    p_method: input.method,
    p_status: input.status,
    p_reference: input.reference ?? null,
    p_notes: input.notes ?? null,
    p_cheque_number: input.chequeNumber ?? null,
    p_bank_name: input.bankName ?? null,
    p_deposit_date: parseDate(input.depositDate),
    p_due_date: parseDate(input.dueDate),
  });

  if (error) {
    throw new Error(mapRegisterPaymentRpcError(error.message));
  }
  if (!data) {
    throw new Error('Paiement non enregistré.');
  }

  return data as string;
}

export interface CustomerFinanceDashboard {
  orders: Array<{
    id: string;
    created_at: string;
    total: number;
    status: string;
    payment_status: PaymentStatus;
    order_number?: string | null;
  }>;
  payments: Array<{
    id: string;
    order_id: string | null;
    amount: number;
    method: PaymentMethod;
    status: PaymentStatus;
    reference: string | null;
    paid_at: string;
  }>;
  instruments: Array<{
    id: string;
    payment_id: string;
    status: 'pending' | 'cleared' | 'rejected';
    cheque_number: string | null;
    bank_name: string | null;
    deposit_date: string | null;
    due_date: string | null;
    cleared_at: string | null;
    rejected_at: string | null;
    rejection_reason: string | null;
  }>;
}

export async function getCustomerFinanceDashboard(customerId: string): Promise<CustomerFinanceDashboard> {
  const [{ data: orders }, { data: payments }, { data: instruments }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, created_at, total, status, payment_status, order_number')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, order_id, amount, method, status, reference, paid_at')
      .eq('customer_id', customerId)
      .order('paid_at', { ascending: false }),
    supabase
      .from('payment_instruments')
      .select(
        `
        id, payment_id, status, cheque_number, bank_name, deposit_date, due_date,
        cleared_at, rejected_at, rejection_reason,
        payments!inner(customer_id)
      `,
      )
      .eq('payments.customer_id', customerId)
      .order('due_date', { ascending: true }),
  ]);

  return {
    orders: (orders || []) as CustomerFinanceDashboard['orders'],
    payments: (payments || []) as CustomerFinanceDashboard['payments'],
    instruments: (instruments || []) as CustomerFinanceDashboard['instruments'],
  };
}

export async function getTurnoverByCategory(): Promise<CategoryTurnover[]> {
  const { data, error } = await supabase
    .from('v_turnover_by_category')
    .select('category, orders_count, turnover')
    .order('turnover', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as CategoryTurnover[];
}

export async function getGlobalTurnover(): Promise<GlobalTurnover> {
  const { data, error } = await supabase
    .from('v_turnover_global')
    .select('orders_count, turnover')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data || { orders_count: 0, turnover: 0 }) as GlobalTurnover;
}

export async function getTopClients(limit = 10): Promise<TopClient[]> {
  const { data, error } = await supabase
    .from('v_top_clients')
    .select('customer_id, full_name, category, turnover, last_order_at, outstanding_balance')
    .order('turnover', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as TopClient[];
}

export async function getRecentPayments(limit = 20): Promise<RecentPaymentRow[]> {
  const { data, error } = await supabase
    .from('v_recent_payments')
    .select('id, customer_id, customer_name, category, order_id, amount, method, status, reference, paid_at')
    .order('paid_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as RecentPaymentRow[];
}

export async function getOutstandingBalances(limit = 20): Promise<OutstandingBalance[]> {
  const { data, error } = await supabase
    .from('v_outstanding_balances')
    .select('customer_id, full_name, category, total_due, total_paid, outstanding_balance')
    .order('outstanding_balance', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as OutstandingBalance[];
}
