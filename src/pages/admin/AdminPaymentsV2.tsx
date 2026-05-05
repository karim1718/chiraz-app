import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CURRENCY, formatCurrencyAmount as fmt } from '../../lib/vocab';
import {
  ensureOrderHasCustomer,
  getCustomerFinanceDashboard,
  promoteOrphanLivreOrders,
  registerPayment,
} from '../../services/financeService';
import type { CustomerCategory } from '../../types/finance';
import type { PaymentMethod, PaymentStatus } from '../../types/order';
import {
  Search,
  Loader2,
  X,
  CheckCircle2,
  Wallet,
  FileText,
  Landmark,
  ChevronRight,
  Users,
  Lock,
  BadgeCheck,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import useDebounce from '../../components/admin/ui/useDebounce';
import { CustomerAvatar } from '../../components/admin/CustomerAvatar';
import { CustomerEncaissementIndicator } from '../../components/admin/CustomerEncaissementIndicator';
import { OrderPickerCombobox } from '../../components/admin/OrderPickerCombobox';
import type { CustomerEncaissementListStatus } from '../../utils/customerEncaissementList';
import {
  ACCOUNT_LABEL,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TOKEN,
  asPaymentStatus,
  paymentMethodLabel,
} from '../../utils/paymentVocab';
import { logisticsThemeFor } from '../../utils/logisticsTheme';
import { SEMANTIC_TOKEN } from '../../utils/statusTokens';

type OrderLite = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  phone: string;
  city: string | null;
  source: string | null;
  order_number: string | null;
  total: number;
  payment_status: PaymentStatus;
  /** Statut logistique (nouveau, livré, …) — vue orders_outstanding */
  status: string;
  /** Somme des paiements (hors en_retard), alignée sur register_order_payment */
  paid_sum: number;
  created_at?: string;
};
type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  category: CustomerCategory;
  photo_url?: string | null;
};
type AccountRow = { customer_id: string; total_du: number; total_paye: number; solde: number };
type DashboardData = Awaited<ReturnType<typeof getCustomerFinanceDashboard>>;
type HistoryTab = 'orders' | 'payments' | 'instruments';

const INSTRUMENT_PILL = {
  pending: SEMANTIC_TOKEN.warning.pill,
  cleared: SEMANTIC_TOKEN.success.pill,
  rejected: SEMANTIC_TOKEN.danger.pill,
} as const;

const CATEGORY_THEME: Record<
  CustomerCategory,
  { label: string; short: string; pill: string; listBar: string }
> = {
  b2b: {
    label: 'B2B',
    short: 'B2B',
    pill: 'bg-amber-100 text-amber-950 ring-amber-200/80',
    listBar: 'border-l-amber-500',
  },
  boutique: {
    label: 'Boutique',
    short: 'Boutique',
    pill: 'bg-purple-100 text-purple-900 ring-purple-200/80',
    listBar: 'border-l-purple-500',
  },
  online: {
    label: 'Online',
    short: 'Web',
    pill: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80',
    listBar: 'border-l-emerald-500',
  },
};

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const inputClass =
  'h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10';

const CATEGORY_KEYS: CustomerCategory[] = ['b2b', 'boutique', 'online'];

const SEGMENT_STORAGE_KEY = 'chiraz.adminPayments.segment';

function readStoredSegment(): CustomerCategory {
  if (typeof window === 'undefined') return 'b2b';
  try {
    const v = localStorage.getItem(SEGMENT_STORAGE_KEY);
    if (v && CATEGORY_KEYS.includes(v as CustomerCategory)) return v as CustomerCategory;
  } catch {
    /* private mode / quota */
  }
  return 'b2b';
}

function persistStoredSegment(cat: CustomerCategory) {
  try {
    localStorage.setItem(SEGMENT_STORAGE_KEY, cat);
  } catch {
    /* ignore */
  }
}

function remainingAmount(o: Pick<OrderLite, 'total' | 'paid_sum'>) {
  return Math.max(0, Number(o.total) - Number(o.paid_sum ?? 0));
}

/** Commande encore à encaisser : reste > 0 ou statut paiement « ouvert » (secours si paid_sum désynchro). */
function isOutstanding(o: OrderLite) {
  if (remainingAmount(o) > 0.01) return true;
  return (
    o.payment_status === 'non_paye' ||
    o.payment_status === 'partiellement_paye' ||
    o.payment_status === 'en_retard' ||
    o.payment_status === 'en_attente_encaissement'
  );
}

function isFullySettled(o: Pick<OrderLite, 'total' | 'paid_sum'>) {
  return remainingAmount(o) <= 0.01;
}

function isOrderDeliveredStatus(status: string) {
  return status === 'livré' || status === 'livre';
}

function isWebOrderSource(source: string | null | undefined) {
  const s = String(source || '').toLowerCase();
  return s === 'web' || s === 'online';
}

/** Même téléphone côté commande / fiche client (espaces ignorés). */
function phoneMatch(orderPhone: string, customerPhone: string) {
  const a = String(orderPhone || '').replace(/\s+/g, '').trim();
  const b = String(customerPhone || '').replace(/\s+/g, '').trim();
  return a.length > 0 && a === b;
}

/** Commandes rattachées à une fiche (même règles que la colonne de droite). */
function ordersLinkedToCustomerRow(c: CustomerRow, allOrders: OrderLite[]): OrderLite[] {
  return allOrders.filter((o) => {
    if (o.customer_id === c.id) return true;
    if (
      c.category === 'online' &&
      isWebOrderSource(o.source) &&
      o.customer_id == null &&
      phoneMatch(o.phone, c.phone)
    ) {
      return true;
    }
    return false;
  });
}

function listStatusRank(s: CustomerEncaissementListStatus): number {
  if (s === 'pending') return 0;
  if (s === 'settled') return 1;
  return 2;
}

/** Libellé montant pour la pastille pending (solde compte prioritaire, sinon somme des reliquats). */
function listPendingAmountLabel(
  c: CustomerRow,
  status: CustomerEncaissementListStatus,
  allOrders: OrderLite[],
  accounts: Record<string, AccountRow>,
): string | null {
  if (status !== 'pending') return null;
  const acc = accounts[c.id];
  if (acc && acc.solde > 0.01) return fmt(acc.solde);
  const linked = ordersLinkedToCustomerRow(c, allOrders);
  const sumRem = linked.reduce((s, o) => s + remainingAmount(o), 0);
  if (sumRem > 0.01) return fmt(sumRem);
  if (acc) return fmt(Math.max(0, acc.solde));
  return fmt(0);
}

function normalizeOutstandingOrders(rows: unknown): OrderLite[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    customer_id: (row.customer_id as string | null) ?? null,
    customer_name: String(row.customer_name ?? ''),
    phone: String(row.phone ?? ''),
    city: (row.city as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    order_number: (row.order_number as string | null) ?? null,
    total: Number(row.total ?? 0),
    payment_status: row.payment_status as PaymentStatus,
    status: String(row.status ?? ''),
    paid_sum: Number(row.paid_sum ?? 0),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  }));
}

/** Colonnes communes à orders_outstanding pour Encaissements. */
const ORDERS_OUTSTANDING_SELECT =
  'id, customer_id, customer_name, phone, city, source, total, payment_status, order_number, status, paid_sum, created_at';

const RECENT_ORDERS_FOR_PAYMENTS = 250;
/** Plafond pour ne pas charger indéfiniment ; augmenter si besoin. */
const LIVRE_ORDERS_CAP = 10_000;

function mergeOutstandingRowLists(...lists: (unknown[] | null | undefined)[]): OrderLite[] {
  const byId = new Map<string, Record<string, unknown>>();
  const pickBetter = (prev: Record<string, unknown>, next: Record<string, unknown>) => {
    const pc = prev.customer_id;
    const nc = next.customer_id;
    if (pc == null && nc != null) return next;
    if (nc == null && pc != null) return prev;
    return prev;
  };
  for (const list of lists) {
    if (!list) continue;
    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? '');
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, r);
      else byId.set(id, pickBetter(byId.get(id)!, r));
    }
  }
  return normalizeOutstandingOrders(Array.from(byId.values()));
}

/**
 * Même logique métier qu’AdminOrders (statut livré) : toutes les commandes livrées
 * doivent être disponibles pour encaissement, pas seulement les 250 dernières au global.
 */
async function fetchOrdersForEncaissementPage(): Promise<OrderLite[]> {
  const [recentRes, livreRes] = await Promise.all([
    supabase
      .from('orders_outstanding')
      .select(ORDERS_OUTSTANDING_SELECT)
      .neq('status', 'annulé')
      .neq('status', 'refusé')
      .order('created_at', { ascending: false })
      .limit(RECENT_ORDERS_FOR_PAYMENTS),
    supabase
      .from('orders_outstanding')
      .select(ORDERS_OUTSTANDING_SELECT)
      .in('status', ['livré', 'livre'])
      .order('created_at', { ascending: false })
      .limit(LIVRE_ORDERS_CAP),
  ]);
  return mergeOutstandingRowLists(recentRes.data, livreRes.data);
}

function AutoPrefillPill() {
  return (
    <span
      title="Pré-rempli depuis le lien"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800"
    >
      <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
      Auto
    </span>
  );
}

export default function AdminPaymentsV2() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [accounts, setAccounts] = useState<Record<string, AccountRow>>({});
  const [selectedCategory, setSelectedCategory] = useState<CustomerCategory>(() => readStoredSegment());
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('orders');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [status, setStatus] = useState<PaymentStatus>('paye');
  const [reference, setReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData>({ orders: [], payments: [], instruments: [] });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [orderPaidSums, setOrderPaidSums] = useState<Record<string, number>>({});
  const [orderRefMissing, setOrderRefMissing] = useState<string | null>(null);
  const [customerIdMissing, setCustomerIdMissing] = useState<string | null>(null);
  const [prefillFlags, setPrefillFlags] = useState({
    orderId: false,
    customerId: false,
    category: false,
  });
  const [showSettledOrdersInPicker, setShowSettledOrdersInPicker] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshAccounts = async () => {
    const { data: a } = await supabase.from('customer_accounts').select('customer_id, total_du, total_paye, solde');
    setAccounts(Object.fromEntries(((a || []) as AccountRow[]).map((row) => [row.customer_id, row])));
  };

  const refreshOrdersAndCustomers = async () => {
    const [{ data: c }, merged] = await Promise.all([
      supabase.from('customers').select('id, full_name, phone, category, photo_url').order('full_name', { ascending: true }),
      fetchOrdersForEncaissementPage(),
    ]);
    setCustomers((c || []) as CustomerRow[]);
    setOrders(merged);
  };

  useEffect(() => {
    const load = async () => {
      setPageLoading(true);
      try {
        await promoteOrphanLivreOrders().catch(() => undefined);
        const [{ data: c }, { data: a }, mergedOrders] = await Promise.all([
          supabase
            .from('customers')
            .select('id, full_name, phone, category, photo_url')
            .order('full_name', { ascending: true }),
          supabase.from('customer_accounts').select('customer_id, total_du, total_paye, solde'),
          fetchOrdersForEncaissementPage(),
        ]);
        const list = (c || []) as CustomerRow[];
        setCustomers(list);
        setAccounts(Object.fromEntries(((a || []) as AccountRow[]).map((row) => [row.customer_id, row])));
        setOrders(mergedOrders);
        const spInit =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const pendingRef = spInit?.get('orderRef')?.trim() || null;
        const pendingCustomerId = spInit?.get('customerId')?.trim() || null;
        if (list.length && !selectedCustomerId && !pendingRef && !pendingCustomerId) {
          const cat = readStoredSegment();
          const first = list.find((x) => x.category === cat) || list[0];
          setSelectedCustomerId(first.id);
        }
      } finally {
        setPageLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (method === 'cash') setReference('');
  }, [method]);

  useEffect(() => {
    setSubmitError(null);
  }, [orderId]);

  const urlParamsConsumed = useRef(false);

  /** Résolution unique des query params (orderRef, customerId), URL nettoyée dans tous les cas. */
  useEffect(() => {
    if (urlParamsConsumed.current || pageLoading) return;
    urlParamsConsumed.current = true;

    const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const orderRefRaw = sp.get('orderRef')?.trim() || '';
    const customerIdParam = sp.get('customerId')?.trim() || '';

    setOrderRefMissing(null);
    setCustomerIdMissing(null);

    let appliedOrder = false;
    let appliedCustomerFromUrl = false;
    let categoryFromUrl = false;

    if (orderRefRaw) {
      const row = orders.find((o) => o.order_number === orderRefRaw);
      if (row) {
        setOrderId(row.id);
        appliedOrder = true;
        if (row.customer_id && customers.some((c) => c.id === row.customer_id)) {
          setSelectedCustomerId(row.customer_id);
          const cust = customers.find((c) => c.id === row.customer_id);
          if (cust) {
            setSelectedCategory(cust.category);
            persistStoredSegment(cust.category);
          }
          appliedCustomerFromUrl = true;
          categoryFromUrl = true;
        } else {
          setSelectedCustomerId('');
          setSelectedCategory('online');
          persistStoredSegment('online');
          categoryFromUrl = true;
        }
      } else {
        setOrderRefMissing(orderRefRaw);
      }
    }

    if (!appliedCustomerFromUrl && customerIdParam) {
      const c = customers.find((x) => x.id === customerIdParam);
      if (c) {
        setSelectedCustomerId(c.id);
        setSelectedCategory(c.category);
        persistStoredSegment(c.category);
        appliedCustomerFromUrl = true;
        categoryFromUrl = true;
      } else {
        setCustomerIdMissing(customerIdParam);
      }
    }

    setPrefillFlags({
      orderId: appliedOrder,
      customerId: appliedCustomerFromUrl && Boolean(customerIdParam || orderRefRaw),
      category: categoryFromUrl,
    });

    const path = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', path);
  }, [pageLoading, customers, orders]);

  const countsByCategory = useMemo(() => {
    const base: Record<CustomerCategory, number> = { boutique: 0, b2b: 0, online: 0 };
    customers.forEach((c) => {
      base[c.category]++;
    });
    return base;
  }, [customers]);

  /** Statut encaissement par client : commandes chargées + repli compte (solde) si aucune ligne dans le merge. */
  const customerEncaissementListStatus = useMemo(() => {
    const map = new Map<string, CustomerEncaissementListStatus>();
    for (const c of customers) {
      const rows = orders.filter((o) => o.customer_id === c.id);
      if (rows.length > 0) {
        map.set(c.id, rows.some(isOutstanding) ? 'pending' : 'settled');
        continue;
      }
      const acc = accounts[c.id];
      if (!acc) map.set(c.id, 'none');
      else map.set(c.id, acc.solde > 0.01 ? 'pending' : 'settled');
    }
    return map;
  }, [customers, orders, accounts]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (c.category !== selectedCategory) return false;
      if (!debouncedSearch.trim()) return true;
      const q = debouncedSearch.toLowerCase().trim();
      return c.full_name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
    });
  }, [customers, selectedCategory, debouncedSearch]);

  const sortedFilteredCustomers = useMemo(() => {
    const rows = [...filteredCustomers];
    const st = customerEncaissementListStatus;
    rows.sort((a, b) => {
      const ra = listStatusRank(st.get(a.id) ?? 'none');
      const rb = listStatusRank(st.get(b.id) ?? 'none');
      if (ra !== rb) return ra - rb;
      return (a.full_name || '').localeCompare(b.full_name || '', 'fr', { sensitivity: 'base' });
    });
    return rows;
  }, [filteredCustomers, customerEncaissementListStatus]);

  useEffect(() => {
    if (!sortedFilteredCustomers.length) return;
    if (!selectedCustomerId) return;
    if (!sortedFilteredCustomers.some((c) => c.id === selectedCustomerId)) {
      setSelectedCustomerId(sortedFilteredCustomers[0].id);
    }
  }, [sortedFilteredCustomers, selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => (selectedCustomerId ? customers.find((c) => c.id === selectedCustomerId) ?? null : null),
    [customers, selectedCustomerId],
  );

  /** Commandes rattachées à la fiche : id explicite ou commande web orpheline avec le même téléphone (Online). */
  const customerOrders = useMemo(() => {
    if (!selectedCustomerId || !selectedCustomer) return [];
    return orders.filter((o) => {
      if (o.customer_id === selectedCustomerId) return true;
      if (
        selectedCustomer.category === 'online' &&
        isWebOrderSource(o.source) &&
        o.customer_id == null &&
        phoneMatch(o.phone, selectedCustomer.phone)
      ) {
        return true;
      }
      return false;
    });
  }, [orders, selectedCustomerId, selectedCustomer]);

  const activeOrderForForm = useMemo(() => orders.find((o) => o.id === orderId) ?? null, [orders, orderId]);
  /** Vrai orphelin : pas de rattachement possible par téléphone avec la fiche sélectionnée. */
  const orphanCashierSession = Boolean(
    activeOrderForForm &&
      activeOrderForForm.customer_id == null &&
      orderId &&
      !(
        selectedCustomer?.category === 'online' &&
        phoneMatch(activeOrderForForm.phone, selectedCustomer.phone)
      ),
  );
  const showMainPanel = Boolean(selectedCustomer) || orphanCashierSession;

  useEffect(() => {
    if (orphanCashierSession) {
      setHistoryLoading(false);
      return;
    }
    if (!selectedCustomerId) {
      setDashboard({ orders: [], payments: [], instruments: [] });
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    const requestedId = selectedCustomerId;
    setDashboard({ orders: [], payments: [], instruments: [] });
    setHistoryLoading(true);
    void (async () => {
      const data = await getCustomerFinanceDashboard(requestedId);
      if (cancelled) return;
      setDashboard(data);
      setHistoryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId, orphanCashierSession]);

  useEffect(() => {
    if (orphanCashierSession) return;
    if (!selectedCustomerId) return;

    const forCustomer = customerOrders;
    const current = orderId ? orders.find((o) => o.id === orderId) : null;
    const linkedToSelection = Boolean(
      current &&
        (current.customer_id === selectedCustomerId ||
          (selectedCustomer?.category === 'online' &&
            isWebOrderSource(current.source) &&
            current.customer_id == null &&
            phoneMatch(current.phone, selectedCustomer?.phone ?? ''))),
    );
    const keepOrder = Boolean(current && linkedToSelection && isOutstanding(current));
    if (keepOrder) {
      return;
    }
    const priority = forCustomer.find((o) => isOutstanding(o)) || forCustomer[0];
    if (priority) {
      setOrderId(priority.id);
    } else {
      setOrderId('');
      setAmount(0);
    }
  }, [selectedCustomerId, orders, orphanCashierSession, orderId, customerOrders, selectedCustomer]);

  const selectedAccount = selectedCustomerId ? accounts[selectedCustomerId] : undefined;

  const livreOutstanding = useMemo(
    () => orders.filter((o) => isOrderDeliveredStatus(o.status) && remainingAmount(o) > 0.01),
    [orders],
  );
  const livreOutstandingIds = useMemo(() => new Set(livreOutstanding.map((o) => o.id)), [livreOutstanding]);

  const orphanToCollect = useMemo(
    () =>
      orders.filter(
        (o) =>
          !livreOutstandingIds.has(o.id) &&
          o.customer_id == null &&
          isOutstanding(o),
      ),
    [orders, livreOutstandingIds],
  );

  const ordersToCollect = useMemo(
    () => customerOrders.filter((o) => !livreOutstandingIds.has(o.id) && isOutstanding(o)),
    [customerOrders, livreOutstandingIds],
  );

  /** Commandes web/en ligne liées à une autre fiche client : invisibles avant car le sélecteur ne listait que le client courant. */
  const onlineLinkedToCollect = useMemo(
    () =>
      orders.filter(
        (o) =>
          !livreOutstandingIds.has(o.id) &&
          (o.source === 'web' || o.source === 'online') &&
          isOutstanding(o) &&
          o.customer_id != null &&
          o.customer_id !== selectedCustomerId,
      ),
    [orders, selectedCustomerId, livreOutstandingIds],
  );

  useEffect(() => {
    const m: Record<string, number> = {};
    for (const o of orders) {
      m[o.id] = Number(o.paid_sum ?? 0);
    }
    setOrderPaidSums(m);
  }, [orders]);

  const prevAmountSyncOrderRef = useRef<string>('');
  const prevAmountSyncPaidRef = useRef<number | null>(null);
  useEffect(() => {
    if (!activeOrderForForm || isFullySettled(activeOrderForForm)) return;
    const oid = activeOrderForForm.id;
    const paid = orderPaidSums[oid] ?? 0;
    const rem = Math.max(0, Number(activeOrderForForm.total) - paid);
    const prevOid = prevAmountSyncOrderRef.current;
    const prevPaid = prevAmountSyncPaidRef.current;
    if (prevOid !== oid || prevPaid !== paid) {
      prevAmountSyncOrderRef.current = oid;
      prevAmountSyncPaidRef.current = paid;
      setAmount(rem);
    }
  }, [activeOrderForForm, orderPaidSums]);

  useEffect(() => {
    setHistoryTab('orders');
  }, [selectedCustomerId]);

  useEffect(() => {
    setShowSettledOrdersInPicker(false);
  }, [selectedCustomerId]);

  useEffect(() => {
    if (!submitSuccess) return;
    const t = window.setTimeout(() => setSubmitSuccess(false), 4000);
    return () => window.clearTimeout(t);
  }, [submitSuccess]);

  useEffect(() => {
    setConfirmOpen(false);
  }, [orderId]);

  const orderFullyPaidById = useMemo(
    () => Object.fromEntries(dashboard.orders.map((o) => [o.id, o.payment_status === 'paye'])),
    [dashboard.orders],
  );

  /** Commandes rattachées à la fiche sélectionnée (id explicite + règle web orphelin / téléphone). */
  const customerOrderIds = useMemo(() => new Set(customerOrders.map((o) => o.id)), [customerOrders]);

  const orderPickerGroups = useMemo(() => {
    const g: { label: string; orders: OrderLite[] }[] = [];
    const livrePick = selectedCustomerId
      ? livreOutstanding.filter((o) => customerOrderIds.has(o.id))
      : livreOutstanding;
    const orphanPick = selectedCustomerId
      ? orphanToCollect.filter((o) => customerOrderIds.has(o.id))
      : orphanToCollect;
    /** Avec un client choisi dans la colonne gauche, on ne propose pas les commandes d’autres fiches. */
    const linkedPick = selectedCustomerId ? [] : onlineLinkedToCollect;

    if (livrePick.length) {
      g.push({ label: 'Livré — à encaisser', orders: livrePick });
    }
    if (orphanPick.length) {
      g.push({ label: 'Web — à encaisser (sans fiche client)', orders: orphanPick });
    }
    if (linkedPick.length) {
      g.push({
        label: 'E‑commerce — à encaisser (autre fiche client)',
        orders: linkedPick,
      });
    }
    if (ordersToCollect.length) {
      g.push({ label: 'À encaisser (client sélectionné)', orders: ordersToCollect });
    }
    return g;
  }, [
    livreOutstanding,
    orphanToCollect,
    onlineLinkedToCollect,
    ordersToCollect,
    selectedCustomerId,
    customerOrderIds,
  ]);

  const onlineOutstandingOrders = useMemo(
    () => customerOrders.filter((o) => isOutstanding(o)),
    [customerOrders],
  );

  const hasOpenWork = Boolean(customerOrders.some(isOutstanding) || orphanCashierSession);

  const hideOrderPickerForOnlineSingle = Boolean(
    selectedCustomer?.category === 'online' && onlineOutstandingOrders.length === 1,
  );

  const orderPickerGroupsResolved = useMemo(() => {
    let base: { label: string; orders: OrderLite[] }[];
    if (selectedCustomer?.category === 'online' && onlineOutstandingOrders.length > 1) {
      base = [{ label: 'Commandes web — à encaisser', orders: onlineOutstandingOrders }];
    } else {
      base = orderPickerGroups;
    }
    if (!showSettledOrdersInPicker || !selectedCustomerId) return base;
    const settled = customerOrders
      .filter((o) => !isOutstanding(o))
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    if (!settled.length) return base;
    return [...base, { label: 'Commandes soldées', orders: settled }];
  }, [
    selectedCustomer,
    onlineOutstandingOrders,
    orderPickerGroups,
    showSettledOrdersInPicker,
    selectedCustomerId,
    customerOrders,
  ]);

  const onOrderPickerChange = useCallback(
    (id: string) => {
      setPrefillFlags((f) => ({ ...f, orderId: false }));
      setOrderRefMissing(null);
      setOrderId(id);
      if (!id) return;
      const o = orders.find((x) => x.id === id);
      if (o?.customer_id) {
        setSelectedCustomerId(o.customer_id);
        const cust = customers.find((c) => c.id === o.customer_id);
        if (cust?.category) {
          setSelectedCategory(cust.category as CustomerCategory);
          persistStoredSegment(cust.category as CustomerCategory);
        }
      }
    },
    [orders, customers],
  );

  const remainingForActiveOrder = useMemo(() => {
    if (!activeOrderForForm || isFullySettled(activeOrderForForm)) return 0;
    const paidSel = orderPaidSums[activeOrderForForm.id] ?? 0;
    return Math.max(0, Number(activeOrderForForm.total) - paidSel);
  }, [activeOrderForForm, orderPaidSums]);

  const paidSelected =
    activeOrderForForm && orderId === activeOrderForForm.id
      ? (orderPaidSums[activeOrderForForm.id] ?? 0)
      : 0;

  const executePayment = async () => {
    if (!activeOrderForForm) return;
    if (isFullySettled(activeOrderForForm)) {
      setSubmitError('Cette commande est déjà payée. Un seul encaissement complet est autorisé.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const customerId = await ensureOrderHasCustomer(activeOrderForForm.id);
      await registerPayment({
        customerId,
        orderId: activeOrderForForm.id,
        amount: Number(amount),
        method,
        status: ['cheque', 'bank_transfer', 'bill_of_exchange'].includes(method)
          ? 'en_attente_encaissement'
          : status,
        reference: method === 'cash' ? undefined : reference || undefined,
        bankName: bankName || undefined,
        depositDate: depositDate || undefined,
        dueDate: dueDate || undefined,
      });
      const paidAmt = Number(amount);
      const orderOid = activeOrderForForm.id;
      const basePaid = orderPaidSums[orderOid] ?? Number(activeOrderForForm.paid_sum ?? 0);
      setOrderPaidSums((prev) => ({ ...prev, [orderOid]: basePaid + paidAmt }));
      setOrders((prev) =>
        prev.map((o) => (o.id === orderOid ? { ...o, paid_sum: basePaid + paidAmt } : o)),
      );
      setAccounts((prev) => {
        const row = prev[customerId];
        if (!row) return prev;
        return {
          ...prev,
          [customerId]: {
            ...row,
            total_paye: Number(row.total_paye) + paidAmt,
            solde: Math.max(0, Number(row.solde) - paidAmt),
          },
        };
      });
      await refreshAccounts();
      await refreshOrdersAndCustomers();
      const { data: newCust } = await supabase
        .from('customers')
        .select('category')
        .eq('id', customerId)
        .maybeSingle();
      if (newCust?.category) {
        setSelectedCategory(newCust.category as CustomerCategory);
        persistStoredSegment(newCust.category as CustomerCategory);
      }
      setSelectedCustomerId(customerId);
      setDashboard(await getCustomerFinanceDashboard(customerId));
      setSubmitSuccess(true);
      setConfirmOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Enregistrement impossible.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConfirmModal = () => {
    if (!activeOrderForForm) return;
    if (isFullySettled(activeOrderForForm)) {
      setSubmitError('Cette commande est déjà payée. Un seul encaissement complet est autorisé.');
      return;
    }
    const paidSel = orderPaidSums[activeOrderForForm.id] ?? 0;
    const rem = Math.max(0, Number(activeOrderForForm.total) - paidSel);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setSubmitError('Indiquez un montant valide supérieur à 0.');
      return;
    }
    if (amt > rem + 0.01) {
      setSubmitError(`Le montant ne peut pas dépasser le ${ACCOUNT_LABEL.remainder.toLowerCase()} (${fmt(rem)}).`);
      return;
    }
    setSubmitError(null);
    setConfirmOpen(true);
  };

  const showInstrumentFields = ['cheque', 'bank_transfer', 'bill_of_exchange'].includes(method);
  const methodLabel = paymentMethodLabel(method);
  const solde = Number(selectedAccount?.solde || 0);

  const encStatusSelected = selectedCustomerId ? customerEncaissementListStatus.get(selectedCustomerId) : undefined;
  const dataTension = Boolean(
    selectedCustomer && !orphanCashierSession && encStatusSelected === 'pending' && !hasOpenWork,
  );

  const amountOverRemaining =
    Boolean(activeOrderForForm && !isFullySettled(activeOrderForForm)) &&
    Number(amount) > remainingForActiveOrder + 0.01;

  const amountDiffersFromOrder =
    activeOrderForForm &&
    !isFullySettled(activeOrderForForm) &&
    Math.abs(Number(amount) - Number(activeOrderForForm.total)) > 0.01;

  const orderAlreadyPaid = Boolean(activeOrderForForm && isFullySettled(activeOrderForForm));

  /** Commande soldée (reliquat nul) ou déjà marquée encaissée côté compta — pas de nouvel encaissement. */
  const orderPaidComplete = Boolean(
    activeOrderForForm &&
      (isFullySettled(activeOrderForForm) || activeOrderForForm.payment_status === 'paye'),
  );

  const showCalmEmpty = Boolean(
    selectedCustomer &&
      !orphanCashierSession &&
      !hasOpenWork &&
      !dataTension &&
      solde <= 0.01 &&
      !(orderId && activeOrderForForm && !isOutstanding(activeOrderForForm)),
  );

  const paymentsForSettledOrder = useMemo(() => {
    if (!activeOrderForForm?.id) return [];
    return dashboard.payments.filter((p) => p.order_id === activeOrderForForm.id);
  }, [activeOrderForForm?.id, dashboard.payments]);

  const settledOrderPaidAmount = useMemo(() => {
    if (!activeOrderForForm) return 0;
    const fromOrder = Number(activeOrderForForm.paid_sum || 0);
    const fromRows = paymentsForSettledOrder.reduce((s, p) => s + Number(p.amount || 0), 0);
    if (fromOrder > 0.01) return fromOrder;
    if (fromRows > 0.01) return fromRows;
    return Number(activeOrderForForm.total || 0);
  }, [activeOrderForForm, paymentsForSettledOrder]);

  /** Libellé du picker quand la commande soldée n’apparaît plus dans les groupes (évite le faux « Choisir une commande »). */
  const settledPickerButtonLabel = useMemo(() => {
    if (!activeOrderForForm) return undefined;
    const name = orphanCashierSession
      ? activeOrderForForm.customer_name
      : selectedCustomer?.full_name || activeOrderForForm.customer_name;
    const num = activeOrderForForm.order_number || `#${activeOrderForForm.id.slice(0, 8)}`;
    const parts = [name?.trim(), num].filter(Boolean);
    return parts.length ? parts.join(' · ') : num;
  }, [activeOrderForForm, orphanCashierSession, selectedCustomer?.full_name]);

  const confirmStatusLabel =
    showInstrumentFields || ['cheque', 'bank_transfer', 'bill_of_exchange'].includes(method)
      ? PAYMENT_STATUS_LABEL.en_attente_encaissement
      : PAYMENT_STATUS_LABEL[status] ?? status;

  const historyTabs: { id: HistoryTab; label: string; count: number; icon: typeof FileText }[] = [
    { id: 'orders', label: 'Commandes', count: dashboard.orders.length, icon: FileText },
    { id: 'payments', label: 'Paiements', count: dashboard.payments.length, icon: Wallet },
    { id: 'instruments', label: 'Instruments', count: dashboard.instruments.length, icon: Landmark },
  ];

  return (
    <div className="min-h-full bg-[#F3F4F6] pb-12 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[1520px] px-4 py-6 sm:px-5 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Trésorerie</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-neutral-950">Encaissements</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
              Choisissez un client, vérifiez le solde, puis enregistrez le paiement. L’historique est regroupé par onglets
              pour garder l’écran lisible.
            </p>
          </div>
          {selectedCustomer ? (
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-200/90 bg-white px-4 py-2.5 text-sm text-neutral-600 shadow-sm">
              <Users className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={2} />
              <span>
                <span className="font-medium text-neutral-900">{sortedFilteredCustomers.length}</span> dans la liste
              </span>
              <span className="text-neutral-300">·</span>
              <span className="truncate">{CATEGORY_THEME[selectedCategory].label}</span>
            </div>
          ) : null}
        </header>

        {/* Barre unique : segments compacts + recherche (moins de hauteur, même fonction) */}
        <div className="mb-6 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Segment client">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                Segment
              </span>
              {CATEGORY_KEYS.map((key) => {
                const theme = CATEGORY_THEME[key];
                const active = selectedCategory === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setPrefillFlags((f) => ({ ...f, category: false }));
                      setSelectedCategory(key);
                      persistStoredSegment(key);
                    }}
                    className={[
                      'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition',
                      active
                        ? prefillFlags.category
                          ? 'bg-neutral-900 text-white shadow-md ring-2 ring-emerald-300/70 ring-offset-2'
                          : 'bg-neutral-900 text-white shadow-md ring-1 ring-neutral-900'
                        : 'bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200/90 hover:bg-neutral-100',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs tabular-nums',
                        active ? 'bg-white/20 text-white' : `${theme.pill} ring-1 ring-inset`,
                      ].join(' ')}
                    >
                      {countsByCategory[key]}
                    </span>
                    {theme.label}
                  </button>
                );
              })}
            </div>
            <div className="h-px w-full bg-neutral-100 lg:hidden" />
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                strokeWidth={2}
              />
              <input
                type="search"
                placeholder={`Rechercher dans ${CATEGORY_THEME[selectedCategory].label}…`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50/80 pl-10 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-700"
                  aria-label="Effacer"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,300px)_1fr] lg:items-start">
          {/* Rail clients : sticky, respiration visuelle */}
          <aside
            className="lg:sticky lg:top-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-neutral-200/90 lg:bg-white lg:shadow-sm"
            aria-label="Liste des clients"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/95 px-4 py-3 lg:rounded-t-2xl">
              <div>
                <p className="text-xs font-semibold text-neutral-900">Clients</p>
                <p className="text-[11px] text-neutral-500">{sortedFilteredCustomers.length} résultat(s)</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${CATEGORY_THEME[selectedCategory].pill}`}
              >
                {CATEGORY_THEME[selectedCategory].short}
              </span>
            </div>
            {customerIdMissing ? (
              <div
                className="flex items-start gap-2 border-b border-amber-100 bg-amber-50/95 px-3 py-2.5 text-xs text-amber-950"
                role="status"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
                <p className="min-w-0 flex-1 leading-snug">
                  Client lié au lien introuvable. Sélectionnez un client dans la liste.
                </p>
                <button
                  type="button"
                  onClick={() => setCustomerIdMissing(null)}
                  className="shrink-0 rounded-md p-1 text-amber-700 hover:bg-amber-100/80"
                  aria-label="Fermer l’avertissement"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            ) : null}
            <div className="max-h-[50vh] overflow-y-auto overscroll-contain lg:max-h-[calc(100vh-11rem)]">
              {pageLoading ? (
                <div className="flex flex-col items-center py-14">
                  <Loader2 className="h-7 w-7 animate-spin text-neutral-300" strokeWidth={1.5} />
                  <p className="mt-3 text-xs text-neutral-500">Chargement…</p>
                </div>
              ) : sortedFilteredCustomers.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">
                  Aucun client ne correspond. Essayez un autre segment ou effacez la recherche.
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {sortedFilteredCustomers.map((c) => {
                    const active = selectedCustomerId === c.id;
                    const th = CATEGORY_THEME[c.category];
                    const encSt = customerEncaissementListStatus.get(c.id) ?? 'none';
                    const settledRow = encSt === 'settled';
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPrefillFlags((f) => ({ ...f, customerId: false }));
                            setCustomerIdMissing(null);
                            setSelectedCustomerId(c.id);
                          }}
                          className={[
                            'flex w-full items-center gap-3 border-l-[3px] px-3 py-3 text-left transition',
                            th.listBar,
                            settledRow && !active ? 'opacity-60' : '',
                            active
                              ? 'bg-neutral-900/[0.04] ring-1 ring-inset ring-neutral-200/80 opacity-100'
                              : 'border-l-transparent hover:bg-neutral-50',
                            active && prefillFlags.customerId
                              ? 'ring-2 ring-emerald-300/70 ring-offset-1 ring-offset-white'
                              : '',
                          ].join(' ')}
                        >
                          <CustomerAvatar name={c.full_name} photoUrl={c.photo_url} size={42} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className={[
                                  'min-w-0 truncate text-sm font-semibold',
                                  settledRow && !active ? 'text-neutral-500' : 'text-neutral-950',
                                ].join(' ')}
                              >
                                {c.full_name}
                              </p>
                              <CustomerEncaissementIndicator
                                status={encSt}
                                className="shrink-0"
                                pendingAmountLabel={listPendingAmountLabel(c, encSt, orders, accounts)}
                              />
                            </div>
                            <p className="truncate text-xs text-neutral-500">{c.phone}</p>
                          </div>
                          {active ? (
                            <span className="flex shrink-0 items-center gap-1">
                              {prefillFlags.customerId ? <AutoPrefillPill /> : null}
                              <ChevronRight className="h-4 w-4 text-neutral-400" strokeWidth={2} />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <main className="min-w-0 space-y-6">
            {!showMainPanel ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white/90 px-6 py-16 text-center shadow-sm">
                <Users className="mb-3 h-10 w-10 text-neutral-300" strokeWidth={1.25} />
                <p className="font-medium text-neutral-800">Sélectionnez un client</p>
                <p className="mt-1 max-w-sm text-sm text-neutral-500">
                  Utilisez la liste à gauche (ou au-dessus sur mobile) pour ouvrir une fiche et encaisser. Vous pouvez aussi
                  ouvrir une commande via le lien Encaisser depuis les commandes (réf. CMD).
                </p>
              </div>
            ) : (
              <>
                {submitSuccess ? (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 shadow-sm"
                    role="status"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2} />
                    <span>
                      Paiement enregistré. Pour les commandes web / en ligne, la commande passe en <strong>payé</strong>{' '}
                      dès que le total est couvert. Historique et soldes mis à jour.
                    </span>
                  </div>
                ) : null}
                {submitError ? (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm"
                    role="alert"
                  >
                    <span>{submitError}</span>
                  </div>
                ) : null}

                {/* Totaux — trois chiffres au-dessus du formulaire */}
                <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
                  <div className="p-5 sm:p-6">
                    {orphanCashierSession && activeOrderForForm ? (
                      <>
                        <div className="flex items-center gap-4">
                          <CustomerAvatar
                            name={activeOrderForForm.customer_name || 'Client'}
                            photoUrl={null}
                            size={56}
                          />
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                              {activeOrderForForm.order_number || `#${activeOrderForForm.id.slice(0, 8)}`}
                            </p>
                            <h2 className="font-serif text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                              {activeOrderForForm.customer_name || 'Client'}
                            </h2>
                            <p className="mt-0.5 text-sm text-neutral-500">
                              {activeOrderForForm.phone}
                              {activeOrderForForm.city ? ` · ${activeOrderForForm.city}` : ''}
                            </p>
                            <p className="mt-2 text-xs text-amber-900/90">
                              Pas de fiche client : un profil CLT sera créé à la validation du paiement.
                            </p>
                          </div>
                        </div>
                        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                              Total dû (commande)
                            </p>
                            <p className="mt-2 text-xl font-bold tabular-nums text-neutral-950 sm:text-2xl">
                              {fmt(Number(activeOrderForForm.total))}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                              Total payé
                            </p>
                            <p className="mt-2 text-xl font-bold tabular-nums text-emerald-800 sm:text-2xl">
                              {fmt(
                                orderPaidSums[activeOrderForForm.id] ?? Number(activeOrderForForm.paid_sum ?? 0),
                              )}
                            </p>
                          </div>
                          <div
                            className={[
                              'rounded-2xl border p-4 sm:p-5',
                              remainingForActiveOrder > 0.01
                                ? 'border-amber-200/90 bg-amber-50/80'
                                : 'border-neutral-200/80 bg-neutral-50/50',
                            ].join(' ')}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                              Reste à payer
                            </p>
                            <p className="mt-2 text-xl font-bold tabular-nums text-neutral-950 sm:text-2xl">
                              {fmt(
                                activeOrderForForm && !isFullySettled(activeOrderForForm)
                                  ? remainingForActiveOrder
                                  : 0,
                              )}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : selectedCustomer ? (
                      <>
                        <div className="flex items-center gap-4">
                          <CustomerAvatar
                            name={selectedCustomer.full_name}
                            photoUrl={selectedCustomer.photo_url}
                            size={56}
                          />
                          <div>
                            <h2 className="font-serif text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                              {selectedCustomer.full_name}
                            </h2>
                            <p className="mt-0.5 text-sm text-neutral-500">{selectedCustomer.phone}</p>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${CATEGORY_THEME[selectedCustomer.category].pill}`}
                            >
                              {CATEGORY_THEME[selectedCustomer.category].label}
                            </span>
                          </div>
                        </div>
                        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                              {ACCOUNT_LABEL.amountDueShort}
                            </p>
                            <p className="mt-2 text-xl font-bold tabular-nums text-neutral-950 sm:text-2xl">
                              {fmt(Number(selectedAccount?.total_du || 0))}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                              {ACCOUNT_LABEL.amountPaidShort}
                            </p>
                            <p className="mt-2 text-xl font-bold tabular-nums text-emerald-800 sm:text-2xl">
                              {fmt(Number(selectedAccount?.total_paye || 0))}
                            </p>
                          </div>
                          <div
                            className={[
                              'rounded-2xl border p-4 sm:p-5',
                              solde > 0.01
                                ? 'border-amber-200/90 bg-amber-50/80'
                                : 'border-neutral-200/80 bg-neutral-50/50',
                            ].join(' ')}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                              Solde / reste dû
                            </p>
                            <p className="mt-2 text-xl font-bold tabular-nums text-neutral-950 sm:text-2xl">{fmt(solde)}</p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {solde > 0.01 ? 'Encaissement recommandé' : `${ACCOUNT_LABEL.settled} ou créditeur`}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </section>

                {dataTension ? (
                  <div
                    className="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-4 text-sm text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    role="status"
                  >
                    <p className="min-w-0 leading-snug">
                      Solde compte ou file d’attente non alignée avec les commandes affichées. Rafraîchissez les données pour
                      continuer.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          await refreshAccounts();
                          await refreshOrdersAndCustomers();
                        })();
                      }}
                      className="shrink-0 rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"
                    >
                      Rafraîchir
                    </button>
                  </div>
                ) : showCalmEmpty ? (
                  <div className="rounded-2xl border border-neutral-200/90 bg-white px-6 py-12 text-center shadow-sm">
                    <BadgeCheck className="mx-auto mb-3 h-10 w-10 text-emerald-500/90" strokeWidth={1.25} aria-hidden />
                    <p className="text-base font-medium text-neutral-900">Aucune commande en attente — client à jour.</p>
                    <p className="mt-2 text-sm text-neutral-500">Consultez l’historique ci-dessous si besoin.</p>
                  </div>
                ) : orderId && orderPaidComplete && activeOrderForForm ? (
                  <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-md shadow-emerald-900/5 ring-1 ring-emerald-100/80">
                    <div className="relative overflow-hidden border-b border-emerald-200/50 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-900 px-5 py-6 text-white sm:px-7 sm:py-7">
                      <div
                        className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl"
                        aria-hidden
                      />
                      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/25 backdrop-blur-sm">
                            <BadgeCheck className="h-7 w-7 text-white" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100/95">
                              <Sparkles className="h-3.5 w-3.5 opacity-90" strokeWidth={2} />
                              Encaissement
                            </p>
                            <h3 className="mt-1.5 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
                              Commande terminée
                            </h3>
                            <p className="mt-2 max-w-md text-sm leading-relaxed text-emerald-50/95">
                              Cette commande est entièrement encaissée. Aucun nouvel encaissement n&apos;est possible — résumé
                              ci-dessous.
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex w-fit items-center gap-2 self-start rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-200 shadow-[0_0_8px_rgba(167,243,208,0.9)]" />
                          Encaissée · soldée
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6 p-5 sm:p-6">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-neutral-100 bg-gradient-to-b from-neutral-50/90 to-white p-4 shadow-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">N° commande</p>
                          <p className="mt-2 font-semibold text-neutral-950">
                            {activeOrderForForm.order_number || `CMD ${activeOrderForForm.id.slice(0, 8)}…`}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-neutral-400">ID {activeOrderForForm.id}</p>
                        </div>
                        <div className="rounded-2xl border border-neutral-100 bg-gradient-to-b from-neutral-50/90 to-white p-4 shadow-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Client</p>
                          <p className="mt-2 font-semibold text-neutral-950">
                            {orphanCashierSession
                              ? activeOrderForForm.customer_name || '—'
                              : selectedCustomer?.full_name || activeOrderForForm.customer_name || '—'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm sm:col-span-2">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800/80">
                                Montant payé
                              </p>
                              <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-emerald-950">
                                {fmt(settledOrderPaidAmount)}
                              </p>
                            </div>
                            <div className="min-w-0 flex-1 sm:max-w-md sm:text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                                Mode de paiement
                              </p>
                              {paymentsForSettledOrder.length === 0 ? (
                                <p className="mt-2 text-sm text-neutral-600">
                                  Détails dans l&apos;onglet <span className="font-medium text-neutral-800">Paiements</span>.
                                </p>
                              ) : paymentsForSettledOrder.length === 1 ? (
                                <p className="mt-2 text-base font-semibold text-neutral-900">
                                  {paymentMethodLabel(paymentsForSettledOrder[0].method)}
                                </p>
                              ) : (
                                <ul className="mt-2 space-y-1.5 text-left text-sm sm:text-right">
                                  {paymentsForSettledOrder.map((p) => (
                                    <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 sm:justify-end">
                                      <span className="font-medium text-neutral-800">{paymentMethodLabel(p.method)}</span>
                                      <span className="tabular-nums text-neutral-600">{fmt(Number(p.amount))}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3.5">
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" strokeWidth={2} />
                            <div>
                              <p className="text-sm font-semibold text-emerald-950">Statut</p>
                              <p className="text-sm text-emerald-900/85">Commande terminée / encaissée</p>
                            </div>
                            <span
                              className={`ml-auto inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SEMANTIC_TOKEN.success.pill}`}
                            >
                              {PAYMENT_STATUS_LABEL.paye}
                            </span>
                          </div>
                        </div>
                      </div>

                      {hideOrderPickerForOnlineSingle && onlineOutstandingOrders[0] ? (
                        <div className="border-t border-neutral-100 pt-5">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                            Commande liée (web)
                          </p>
                          <div
                            className="flex h-11 w-full items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm text-neutral-900"
                            aria-live="polite"
                          >
                            <span className="min-w-0 truncate font-medium">
                              {selectedCustomer?.full_name ?? onlineOutstandingOrders[0].customer_name}
                              {' · '}
                              <span className="text-neutral-600">
                                {onlineOutstandingOrders[0].order_number ||
                                  `#${onlineOutstandingOrders[0].id.slice(0, 8)}`}
                              </span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-neutral-100 pt-5">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                            Changer de commande
                          </p>
                          {selectedCustomerId && !hideOrderPickerForOnlineSingle ? (
                            <div className="mb-3 flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="enc-picker-settled-settled-panel"
                                checked={showSettledOrdersInPicker}
                                onChange={(e) => setShowSettledOrdersInPicker(e.target.checked)}
                                className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/20"
                              />
                              <label
                                htmlFor="enc-picker-settled-settled-panel"
                                className="cursor-pointer text-sm font-medium text-neutral-700"
                              >
                                Voir commandes soldées
                              </label>
                            </div>
                          ) : null}
                          {orderRefMissing ? (
                            <div
                              className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950"
                              role="status"
                            >
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
                              <p className="min-w-0 flex-1 leading-snug">
                                <span className="font-semibold">Commande introuvable dans les encaissements en attente.</span>{' '}
                                <code className="rounded bg-amber-100/80 px-1 font-mono text-[11px]">{orderRefMissing}</code>{' '}
                                — sélectionnez-la manuellement ou vérifiez son statut.
                              </p>
                              <button
                                type="button"
                                onClick={() => setOrderRefMissing(null)}
                                className="shrink-0 rounded-md p-1 text-amber-800 hover:bg-amber-100/80"
                                aria-label="Fermer l’avertissement"
                              >
                                <X className="h-3.5 w-3.5" strokeWidth={2} />
                              </button>
                            </div>
                          ) : null}
                          <OrderPickerCombobox
                            value={orderId}
                            onChange={onOrderPickerChange}
                            groups={orderPickerGroupsResolved}
                            paidByOrderId={orderPaidSums}
                            disabled={pageLoading}
                            compact={selectedCustomer?.category === 'online'}
                            valueNotInListLabel={settledPickerButtonLabel}
                            prefilled={prefillFlags.orderId}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                    className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm"
                  >
                    <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
                          1
                        </span>
                        <h3 className="font-serif text-lg font-semibold text-neutral-950">Enregistrer un encaissement</h3>
                      </div>
                      <p className="mt-2 text-sm text-neutral-600">
                        {hideOrderPickerForOnlineSingle
                          ? 'Cette commande web est liée à cette fiche. Saisissez le montant et le mode de règlement.'
                          : 'Choisissez la commande concernée, puis le montant et le mode de règlement.'}
                      </p>
                    </div>

                    <div className="space-y-5 p-5 sm:p-6">
                      <div>
                        {selectedCustomerId && !hideOrderPickerForOnlineSingle ? (
                          <div className="mb-3 flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="enc-picker-settled"
                              checked={showSettledOrdersInPicker}
                              onChange={(e) => setShowSettledOrdersInPicker(e.target.checked)}
                              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/20"
                            />
                            <label htmlFor="enc-picker-settled" className="cursor-pointer text-sm font-medium text-neutral-700">
                              Voir commandes soldées
                            </label>
                          </div>
                        ) : null}
                        <label htmlFor="enc-order" className="mb-2 block text-sm font-semibold text-neutral-800">
                          Commande
                        </label>
                        {orderRefMissing ? (
                          <div
                            className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950"
                            role="status"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
                            <p className="min-w-0 flex-1 leading-snug">
                              <span className="font-semibold">Commande introuvable dans les encaissements en attente.</span>{' '}
                              <code className="rounded bg-amber-100/80 px-1 font-mono text-[11px]">{orderRefMissing}</code>{' '}
                              — sélectionnez-la manuellement ou vérifiez son statut.
                            </p>
                            <button
                              type="button"
                              onClick={() => setOrderRefMissing(null)}
                              className="shrink-0 rounded-md p-1 text-amber-800 hover:bg-amber-100/80"
                              aria-label="Fermer l’avertissement"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        ) : null}
                        {hideOrderPickerForOnlineSingle && onlineOutstandingOrders[0] ? (
                          <div
                            id="enc-order"
                            className="flex h-11 w-full items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm text-neutral-900"
                            aria-live="polite"
                          >
                            <span className="min-w-0 truncate font-medium">
                              {selectedCustomer?.full_name ?? onlineOutstandingOrders[0].customer_name}
                              {' · '}
                              <span className="text-neutral-600">
                                {onlineOutstandingOrders[0].order_number ||
                                  `#${onlineOutstandingOrders[0].id.slice(0, 8)}`}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <OrderPickerCombobox
                            value={orderId}
                            onChange={onOrderPickerChange}
                            groups={orderPickerGroupsResolved}
                            paidByOrderId={orderPaidSums}
                            disabled={pageLoading}
                            compact={selectedCustomer?.category === 'online'}
                            valueNotInListLabel={settledPickerButtonLabel}
                            prefilled={prefillFlags.orderId}
                          />
                        )}
                        {selectedCustomerId && customerOrders.length === 0 ? (
                          <p className="mt-2 text-sm text-amber-800">Aucune commande liée à ce client dans la liste chargée.</p>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-neutral-800">{`Montant (${CURRENCY.code})`}</label>
                          <input
                            type="number"
                            min={0}
                            max={
                              activeOrderForForm && !isFullySettled(activeOrderForForm) && remainingForActiveOrder > 0
                                ? remainingForActiveOrder
                                : undefined
                            }
                            step="0.01"
                            value={amount || ''}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className={inputClass}
                          />
                          {activeOrderForForm && !isFullySettled(activeOrderForForm) && paidSelected > 0.01 ? (
                            <p className="mt-1.5 text-xs text-neutral-600">
                              {ACCOUNT_LABEL.remainder} maximum : <strong>{fmt(remainingForActiveOrder)}</strong>
                            </p>
                          ) : null}
                          {amountDiffersFromOrder && activeOrderForForm ? (
                            <p className="mt-1.5 text-xs text-neutral-500">
                              Montant différent du total commande ({fmt(Number(activeOrderForForm.total))}). Utile pour un paiement
                              partiel.
                            </p>
                          ) : null}
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-neutral-800">Mode de paiement</label>
                          <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                            className={inputClass}
                          >
                            {PAYMENT_METHOD_OPTIONS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-neutral-800">Statut comptable</label>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                            className={inputClass}
                            disabled={showInstrumentFields}
                          >
                            {(['non_paye', 'partiellement_paye', 'paye', 'en_retard'] as const).map((v) => (
                              <option key={v} value={v}>
                                {PAYMENT_STATUS_LABEL[v]}
                              </option>
                            ))}
                          </select>
                          {showInstrumentFields ? (
                            <p className="mt-1.5 text-xs text-neutral-500">
                              Chèque, virement ou effet : statut « {PAYMENT_STATUS_LABEL.en_attente_encaissement} » appliqué
                              automatiquement.
                            </p>
                          ) : null}
                        </div>
                        {method !== 'cash' ? (
                          <div>
                            <label className="mb-2 block text-sm font-semibold text-neutral-800">Référence</label>
                            <input
                              value={reference}
                              onChange={(e) => setReference(e.target.value)}
                              placeholder="N° chèque, libellé virement…"
                              className={inputClass}
                            />
                          </div>
                        ) : null}
                      </div>

                      {showInstrumentFields ? (
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                            Détails instrument
                          </p>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                              <label className="mb-2 block text-xs font-medium text-neutral-600">Banque</label>
                              <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-medium text-neutral-600">Date dépôt</label>
                              <input
                                type="date"
                                value={depositDate}
                                onChange={(e) => setDepositDate(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-medium text-neutral-600">Échéance</label>
                              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-neutral-600">
                          <span className="font-medium text-neutral-900">{fmt(Number(amount || 0))}</span>
                          <span> · {methodLabel}</span>
                          {activeOrderForForm ? (
                            <span className="block text-xs text-neutral-500">
                              {activeOrderForForm.order_number || `Commande #${activeOrderForForm.id.slice(0, 8)}`}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void openConfirmModal()}
                          disabled={
                            confirmOpen ||
                            isSubmitting ||
                            !orderId ||
                            orderAlreadyPaid ||
                            amountOverRemaining ||
                            !Number.isFinite(Number(amount)) ||
                            Number(amount) <= 0
                          }
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-45 sm:w-auto sm:min-w-[200px]"
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {isSubmitting ? 'Enregistrement…' : 'Valider l’encaissement'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {confirmOpen && activeOrderForForm ? (
                  <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-enc-title"
                  >
                    <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
                      <h3 id="confirm-enc-title" className="font-serif text-lg font-semibold text-neutral-950">
                        Confirmer l&apos;encaissement
                      </h3>
                      <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                        <li>
                          <span className="font-semibold text-neutral-900">Client :</span>{' '}
                          {orphanCashierSession
                            ? activeOrderForForm.customer_name || '—'
                            : selectedCustomer?.full_name || '—'}
                        </li>
                        <li>
                          <span className="font-semibold text-neutral-900">Commande :</span>{' '}
                          {activeOrderForForm.order_number || `#${activeOrderForForm.id.slice(0, 8)}`}
                        </li>
                        <li>
                          <span className="font-semibold text-neutral-900">Montant :</span> {fmt(Number(amount || 0))}
                        </li>
                        <li>
                          <span className="font-semibold text-neutral-900">Mode :</span> {methodLabel}
                        </li>
                        <li>
                          <span className="font-semibold text-neutral-900">Statut :</span> {confirmStatusLabel}
                        </li>
                      </ul>
                      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                          onClick={() => setConfirmOpen(false)}
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                          onClick={() => void executePayment()}
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Confirmer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Historique : onglets = moins de scroll, contenu focalisé */}
                <section
                  className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm"
                  aria-label="Historique"
                >
                  <div className="border-b border-neutral-100 px-4 pt-4 sm:px-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Historique</p>
                    <div className="flex gap-1 overflow-x-auto pb-px" role="tablist">
                      {historyTabs.map(({ id, label, count, icon: Icon }) => {
                        const active = historyTab === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setHistoryTab(id)}
                            className={[
                              'inline-flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-3.5 py-2.5 text-sm font-semibold transition',
                              active
                                ? 'border-neutral-200 bg-white text-neutral-900 shadow-[0_-1px_0_0_white]'
                                : 'border-transparent bg-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800',
                            ].join(' ')}
                          >
                            <Icon className="h-4 w-4 opacity-70" strokeWidth={2} />
                            {label}
                            <span
                              className={[
                                'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                                active ? 'bg-neutral-900 text-white' : 'bg-neutral-200/80 text-neutral-600',
                              ].join(' ')}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    {historyLoading ? (
                      <p className="mb-3 text-xs font-medium text-neutral-500">Mise à jour de l’historique…</p>
                    ) : null}
                    {historyTab === 'orders' ? (
                      <div className="overflow-x-auto rounded-xl border border-neutral-200/80">
                        <table className="w-full min-w-[520px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50/95">
                              {['Réf.', 'Date', 'Montant', 'Statut', 'Paiement'].map((h) => (
                                <th
                                  key={h}
                                  className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {dashboard.orders.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">
                                  Aucune commande pour ce client.
                                </td>
                              </tr>
                            ) : (
                              dashboard.orders.map((row) => {
                                const st = logisticsThemeFor(String(row.status));
                                const ps = asPaymentStatus(row.payment_status);
                                const payPill = SEMANTIC_TOKEN[PAYMENT_STATUS_TOKEN[ps]].pill;
                                const payLabel = PAYMENT_STATUS_LABEL[ps];
                                return (
                                  <tr key={row.id} className={['hover:bg-neutral-50/80', st.bar, 'border-l-4'].join(' ')}>
                                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-neutral-950">
                                      {row.order_number || `#${row.id.slice(0, 8)}`}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{fmtDateTime(row.created_at)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-neutral-950">
                                      {fmt(Number(row.total || 0))}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${st.pill}`}>
                                        {st.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${payPill}`}>
                                        {payLabel}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {historyTab === 'payments' ? (
                      <div className="overflow-x-auto rounded-xl border border-neutral-200/80">
                        <table className="w-full min-w-[520px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50/95">
                              {['Date', 'Montant', 'Mode', 'Statut', ''].map((h, i) => (
                                <th
                                  key={i}
                                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500"
                                >
                                  {h === '' ? <span className="sr-only">Verrou</span> : h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {dashboard.payments.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">
                                  Aucun paiement enregistré.
                                </td>
                              </tr>
                            ) : (
                              dashboard.payments.map((p) => {
                                const ps = asPaymentStatus(p.status);
                                const payPill = SEMANTIC_TOKEN[PAYMENT_STATUS_TOKEN[ps]].pill;
                                const payLabel = PAYMENT_STATUS_LABEL[ps];
                                const oid = p.order_id;
                                const showLock = Boolean(oid && orderFullyPaidById[oid]);
                                return (
                                  <tr key={p.id} className="hover:bg-neutral-50/80">
                                    <td className="px-4 py-3 text-neutral-500">{fmtDateTime(p.paid_at)}</td>
                                    <td className="px-4 py-3 font-semibold tabular-nums text-emerald-700">
                                      {fmt(Number(p.amount || 0))}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-800">{paymentMethodLabel(p.method as PaymentMethod)}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${payPill}`}>
                                        {payLabel}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-neutral-400">
                                      {showLock ? (
                                        <Lock className="mx-auto h-4 w-4" strokeWidth={2} aria-label="Encaissement verrouillé" />
                                      ) : (
                                        <span className="text-neutral-300">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {historyTab === 'instruments' ? (
                      <div className="overflow-x-auto rounded-xl border border-neutral-200/80">
                        <table className="w-full min-w-[520px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50/95">
                              {['Statut', 'Banque', 'Échéance', 'Réf.'].map((h) => (
                                <th
                                  key={h}
                                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {dashboard.instruments.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-10 text-center text-sm text-neutral-500">
                                  Aucun chèque ou effet enregistré.
                                </td>
                              </tr>
                            ) : (
                              dashboard.instruments.map((ins) => {
                                const st = ins.status;
                                const ip =
                                  st === 'pending' || st === 'cleared' || st === 'rejected'
                                    ? INSTRUMENT_PILL[st]
                                    : INSTRUMENT_PILL.pending;
                                return (
                                  <tr key={ins.id} className="hover:bg-neutral-50/80">
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${ip}`}>
                                        {String(ins.status)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-neutral-800">{ins.bank_name || '—'}</td>
                                    <td className="px-4 py-3 text-neutral-500">
                                      {ins.due_date ? fmtDateTime(ins.due_date) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-600">{ins.cheque_number || '—'}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
