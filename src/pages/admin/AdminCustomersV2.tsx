import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getCustomerOrders,
  getCustomerPayments,
  getCustomerSummary,
  listCustomers,
  promoteOrphanLivreOrders,
  updateCustomerProfile,
  uploadCustomerAvatar,
  upsertCustomer,
} from '../../services/financeService';
import { supabase } from '../../lib/supabase';
import { formatCurrencyAmount as fmt } from '../../lib/vocab';
import type { CustomerCategory } from '../../types/finance';
import type { PaymentMethod } from '../../types/order';
import { Search, Loader2, X, User, ImagePlus, CheckCircle2, Wallet } from 'lucide-react';
import useDebounce from '../../components/admin/ui/useDebounce';
import { CustomerAvatar } from '../../components/admin/CustomerAvatar';
import { CustomerEncaissementIndicator } from '../../components/admin/CustomerEncaissementIndicator';
import {
  ordersOutstandingRowIsPending,
  type CustomerEncaissementListStatus,
} from '../../utils/customerEncaissementList';
import {
  ACCOUNT_LABEL,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TOKEN,
  accountSettlementToken,
  asPaymentStatus,
  paymentMethodLabel,
} from '../../utils/paymentVocab';
import { logisticsThemeFor } from '../../utils/logisticsTheme';
import { SEMANTIC_TOKEN } from '../../utils/statusTokens';

type TabKey = 'overview' | 'orders' | 'payments' | 'encaissement' | 'info';

function prepPayloadDone(p: unknown): p is { completed_at: string; method?: string; reference?: string | null } {
  return Boolean(p && typeof p === 'object' && 'completed_at' in p && (p as { completed_at?: string }).completed_at);
}

/** Aligné sur AdminOrders : barre gauche, pastille, carte filtre. */
const CATEGORY_THEME: Record<
  CustomerCategory | 'all',
  { label: string; pill: string; bar: string; dot: string }
> = {
  all: {
    label: 'Tous',
    pill: 'border-neutral-200 bg-neutral-100 text-neutral-800',
    bar: 'border-l-neutral-400',
    dot: 'bg-neutral-400',
  },
  boutique: {
    label: 'Boutique',
    pill: 'border-purple-200 bg-purple-50 text-purple-900',
    bar: 'border-l-purple-500',
    dot: 'bg-purple-500',
  },
  b2b: {
    label: 'B2B',
    pill: 'border-amber-200 bg-amber-50 text-amber-950',
    bar: 'border-l-amber-500',
    dot: 'bg-amber-500',
  },
  online: {
    label: 'Online',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    bar: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
  },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function StatCard({ label, value, sub, accentClass }: { label: string; value: string; sub?: string; accentClass?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums tracking-tight text-neutral-950 ${accentClass || ''}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-neutral-500">{sub}</div> : null}
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 transition placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10';
const textareaClass =
  'min-h-[5.5rem] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 transition placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10';

export default function AdminCustomersV2() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [summary, setSummary] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [category, setCategory] = useState<'all' | CustomerCategory>('all');
  const [tab, setTab] = useState<TabKey>('overview');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newClient, setNewClient] = useState({
    full_name: '',
    phone: '',
    category: 'boutique' as CustomerCategory,
    address: '',
    notes: '',
  });
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const newPhotoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const [prepOrderRef, setPrepOrderRef] = useState('');
  const [prepMethod, setPrepMethod] = useState<PaymentMethod>('cash');
  const [prepReference, setPrepReference] = useState('');
  const [prepSaving, setPrepSaving] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [prepSuccess, setPrepSuccess] = useState(false);

  /** Une requête agrégée `orders_outstanding` + `customer_accounts` (pas de N+1). */
  const [encaissementListCtx, setEncaissementListCtx] = useState<{
    soldeByCustomer: Record<string, number>;
    pendingCustomerIds: Record<string, true>;
  }>({ soldeByCustomer: {}, pendingCustomerIds: {} });

  useEffect(() => {
    if (prepMethod === 'cash') setPrepReference('');
  }, [prepMethod]);

  useEffect(() => {
    if (!prepSuccess) return;
    const t = window.setTimeout(() => setPrepSuccess(false), 4000);
    return () => window.clearTimeout(t);
  }, [prepSuccess]);

  useEffect(() => {
    if (newPhotoFile) {
      const url = URL.createObjectURL(newPhotoFile);
      setNewPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setNewPhotoPreview(null);
    return undefined;
  }, [newPhotoFile]);

  useEffect(() => {
    if (editPhotoFile) {
      const url = URL.createObjectURL(editPhotoFile);
      setEditPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setEditPhotoPreview(null);
    return undefined;
  }, [editPhotoFile]);

  const loadCustomers = async () => {
    setListLoading(true);
    try {
      await promoteOrphanLivreOrders().catch(() => undefined);
      const [res, accRes, ooRes] = await Promise.all([
        listCustomers({ search: debouncedSearch, category, pageSize: 200 }),
        supabase.from('customer_accounts').select('customer_id, solde'),
        supabase
          .from('orders_outstanding')
          .select('customer_id, outstanding, payment_status')
          .not('customer_id', 'is', null)
          .limit(10_000),
      ]);
      setCustomers(res.customers);
      const soldeByCustomer = Object.fromEntries(
        (accRes.data || []).map((r) => [r.customer_id as string, Number(r.solde ?? 0)]),
      );
      const pendingCustomerIds: Record<string, true> = {};
      for (const row of ooRes.data || []) {
        const cid = row.customer_id as string | null;
        if (!cid) continue;
        if (ordersOutstandingRowIsPending(row)) pendingCustomerIds[cid] = true;
      }
      setEncaissementListCtx({ soldeByCustomer, pendingCustomerIds });
      if (res.customers.length && !res.customers.some((c) => c.id === selectedCustomerId)) {
        setSelectedCustomerId(res.customers[0].id);
      }
      if (!res.customers.length) {
        setSelectedCustomerId('');
        setSummary(null);
      }
    } finally {
      setListLoading(false);
    }
  };

  const loadDetails = async (customerId: string) => {
    if (!customerId) return;
    const [s, o, p] = await Promise.all([
      getCustomerSummary(customerId),
      getCustomerOrders(customerId, 1, 100),
      getCustomerPayments(customerId, 1, 100),
    ]);
    setSummary(s);
    setOrders(o.rows);
    setPayments(p.rows);
  };

  useEffect(() => {
    void loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category]);

  useEffect(() => {
    if (selectedCustomerId) void loadDetails(selectedCustomerId);
  }, [selectedCustomerId]);

  const selected = summary?.customer;
  const account = summary?.account || { total_du: 0, total_paye: 0, solde: 0 };

  useEffect(() => {
    if (tab === 'encaissement' && selected?.category !== 'online') {
      setTab('overview');
    }
  }, [selected?.category, tab]);

  const detailTabs = useMemo(() => {
    const rows: [TabKey, string][] = [
      ['overview', "Vue d'ensemble"],
      ['orders', 'Commandes'],
      ['payments', 'Paiements'],
    ];
    if (selected?.category === 'online') {
      rows.push(['encaissement', 'Prép. encaissement']);
    }
    rows.push(['info', 'Informations']);
    return rows;
  }, [selected?.category]);

  const submitCashierPrep = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrepError(null);
    const ref = prepOrderRef.trim();
    if (!selectedCustomerId) return;
    if (!ref) {
      setPrepError('Indiquez la référence exacte de la commande (ex. CMD-20260429-00042).');
      return;
    }
    if (prepMethod !== 'cash' && !prepReference.trim()) {
      setPrepError('Indiquez une référence (chèque, virement, etc.) pour ce mode de paiement.');
      return;
    }
    setPrepSaving(true);
    try {
      const { data: row, error: qErr } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('order_number', ref)
        .eq('customer_id', selectedCustomerId)
        .maybeSingle();
      if (qErr) throw new Error(qErr.message);
      if (!row) {
        setPrepError('Aucune commande avec cette référence pour ce client. Vérifiez le numéro CMD.');
        return;
      }
      const cashier_prep = {
        completed_at: new Date().toISOString(),
        method: prepMethod,
        ...(prepMethod !== 'cash' && prepReference.trim() ? { reference: prepReference.trim() } : {}),
      };
      const { error: uErr } = await supabase
        .from('orders')
        .update({ cashier_prep, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (uErr) throw new Error(uErr.message);
      setPrepOrderRef('');
      setPrepReference('');
      setPrepMethod('cash');
      await loadDetails(selectedCustomerId);
      setPrepSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la validation.';
      setPrepError(msg);
    } finally {
      setPrepSaving(false);
    }
  };
  const filtered = useMemo(() => customers, [customers]);

  const encaissementStatusFor = useCallback(
    (customerId: string): CustomerEncaissementListStatus => {
      const hasPendingOrder = Boolean(encaissementListCtx.pendingCustomerIds[customerId]);
      const solde = encaissementListCtx.soldeByCustomer[customerId];
      if (hasPendingOrder || (solde !== undefined && solde > 0.01)) return 'pending';
      if (solde !== undefined) return 'settled';
      return 'none';
    },
    [encaissementListCtx],
  );

  const countsByCategory = useMemo(() => {
    const base: Record<string, number> = { all: customers.length, boutique: 0, b2b: 0, online: 0 };
    customers.forEach((c) => {
      const cat = c.category as CustomerCategory;
      if (base[cat] !== undefined) base[cat]++;
    });
    return base;
  }, [customers]);

  const CATEGORY_KEYS = ['all', 'boutique', 'b2b', 'online'] as const;

  const resetNewPhoto = () => {
    setNewPhotoFile(null);
    setNewPhotoPreview(null);
    if (newPhotoInputRef.current) newPhotoInputRef.current.value = '';
  };

  const resetEditPhoto = () => {
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
  };

  const startEdit = () => {
    if (!selected) return;
    resetEditPhoto();
    setDraft({
      full_name: selected.full_name || '',
      phone: selected.phone || '',
      address: selected.address || '',
      notes: selected.notes || '',
      category: selected.category || 'boutique',
    });
    setIsEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      let photoUrl: string | undefined;
      if (editPhotoFile) {
        photoUrl = await uploadCustomerAvatar(editPhotoFile, selected.id);
      }
      await updateCustomerProfile(selected.id, {
        fullName: draft.full_name,
        phone: draft.phone,
        address: draft.address,
        notes: draft.notes,
        category: draft.category as CustomerCategory,
        ...(photoUrl !== undefined ? { photoUrl } : {}),
      });
      setIsEditOpen(false);
      resetEditPhoto();
      await Promise.all([loadCustomers(), loadDetails(selected.id)]);
    } finally {
      setSaving(false);
    }
  };

  const addClient = async () => {
    if (!newClient.full_name || !newClient.phone) return;
    setSaving(true);
    try {
      const id = await upsertCustomer({
        fullName: newClient.full_name,
        phone: newClient.phone,
        category: newClient.category,
        address: newClient.address,
        notes: newClient.notes,
      });
      if (newPhotoFile) {
        const url = await uploadCustomerAvatar(newPhotoFile, id);
        await updateCustomerProfile(id, { photoUrl: url });
      }
      setIsAddOpen(false);
      setNewClient({ full_name: '', phone: '', category: 'boutique', address: '', notes: '' });
      resetNewPhoto();
      await loadCustomers();
      setSelectedCustomerId(id);
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setIsAddOpen(true);
    setSelectedCustomerId('');
    setSummary(null);
    resetNewPhoto();
    setNewClient({ full_name: '', phone: '', category: 'boutique', address: '', notes: '' });
  };

  const displayPhoto = useCallback(
    (c: { photo_url?: string | null; full_name: string }, preview?: string | null) =>
      preview || c.photo_url || null,
    [],
  );

  const removeCustomerPhoto = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      resetEditPhoto();
      await updateCustomerProfile(selected.id, { photoUrl: '' });
      await Promise.all([loadCustomers(), loadDetails(selected.id)]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-10 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-neutral-200/80 pb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-neutral-950">Clients</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            Fiches CRM : segmentation, photo, historique commandes et paiements, solde comptable.
          </p>
        </header>

        <section aria-label="Filtrer par catégorie">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Catégories</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
            {CATEGORY_KEYS.map((key) => {
              const theme = CATEGORY_THEME[key];
              const count = countsByCategory[key];
              const isActive = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={[
                    'group flex h-[5.5rem] flex-col justify-center rounded-2xl border border-neutral-200/90 border-l-4 bg-white px-3.5 text-left shadow-sm transition-all duration-200',
                    theme.bar,
                    isActive
                      ? 'ring-2 ring-neutral-900 ring-offset-2 ring-offset-[#F9FAFB]'
                      : 'hover:border-neutral-300 hover:bg-neutral-50/80 hover:shadow-md',
                  ].join(' ')}
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${theme.dot}`} aria-hidden />
                    <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">{count}</span>
                  </div>
                  <span className={`mt-1.5 text-xs font-semibold leading-snug text-neutral-600 ${isActive ? 'text-neutral-950' : ''}`}>
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6"
          aria-label="Recherche et actions"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="customers-search" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                Recherche
              </label>
              <div className="relative mt-2">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  strokeWidth={1.75}
                />
                <input
                  id="customers-search"
                  type="text"
                  placeholder="Nom ou téléphone…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
                {searchTerm.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="Effacer la recherche"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="h-10 shrink-0 rounded-lg border border-neutral-900 bg-neutral-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
            >
              + Nouveau client
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:items-start">
          <section
            className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm"
            aria-label="Liste des clients"
          >
            <div className="border-b border-neutral-200 bg-neutral-50/90 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Annuaire</p>
              <p className="text-xs text-neutral-500">{filtered.length} client(s)</p>
            </div>
            <div className="max-h-[min(70vh,640px)] overflow-y-auto">
              {listLoading && filtered.length === 0 ? (
                <div className="flex flex-col items-center py-16">
                  <Loader2 size={28} className="animate-spin text-neutral-300" strokeWidth={1.5} />
                  <p className="mt-3 text-sm text-neutral-500">Chargement…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-neutral-500">Aucun client ne correspond à ces critères.</div>
              ) : (
                filtered.map((c) => {
                  const cat = c.category as CustomerCategory;
                  const rowTheme = CATEGORY_THEME[cat];
                  const active = selectedCustomerId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setTab('overview');
                        setIsAddOpen(false);
                        setIsEditOpen(false);
                        resetEditPhoto();
                      }}
                      className={[
                        'flex w-full items-center gap-3 border-l-4 px-4 py-3.5 text-left transition-colors duration-150',
                        rowTheme.bar,
                        active ? 'bg-neutral-50' : 'hover:bg-neutral-50/90',
                      ].join(' ')}
                    >
                      <CustomerAvatar name={c.full_name} photoUrl={c.photo_url} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate font-semibold text-neutral-950">{c.full_name}</span>
                            <CustomerEncaissementIndicator
                              status={encaissementStatusFor(c.id)}
                              className="shrink-0"
                            />
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rowTheme.pill}`}>
                            {rowTheme.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-500">{c.phone}</div>
                        {c.customer_ref ? (
                          <div className="mt-0.5 font-mono text-[10px] text-neutral-400">{c.customer_ref}</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="min-w-0">
            {isAddOpen ? (
              <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
                <div className="border-b border-neutral-200 px-6 py-5">
                  <h2 className="font-serif text-xl font-semibold text-neutral-950">Nouveau client</h2>
                  <p className="mt-1 text-sm text-neutral-500">Renseignez les informations et ajoutez une photo optionnelle.</p>
                </div>
                <div className="space-y-4 p-6">
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="relative">
                      <CustomerAvatar
                        name={newClient.full_name || 'Client'}
                        photoUrl={displayPhoto({ full_name: newClient.full_name, photo_url: null }, newPhotoPreview)}
                        size={72}
                      />
                      <input
                        ref={newPhotoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        id="new-customer-photo"
                        onChange={(e) => setNewPhotoFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label
                        htmlFor="new-customer-photo"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                      >
                        <ImagePlus size={16} strokeWidth={2} />
                        Photo
                      </label>
                      {newPhotoFile ? (
                        <button
                          type="button"
                          onClick={resetNewPhoto}
                          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                        >
                          Retirer
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <input
                    className={inputClass}
                    placeholder="Nom complet *"
                    value={newClient.full_name}
                    onChange={(e) => setNewClient((p) => ({ ...p, full_name: e.target.value }))}
                  />
                  <input
                    className={inputClass}
                    placeholder="Téléphone *"
                    value={newClient.phone}
                    onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                  />
                  <select
                    className={inputClass}
                    value={newClient.category}
                    onChange={(e) => setNewClient((p) => ({ ...p, category: e.target.value as CustomerCategory }))}
                  >
                    <option value="boutique">Boutique</option>
                    <option value="b2b">B2B</option>
                    <option value="online">Online</option>
                  </select>
                  <input
                    className={inputClass}
                    placeholder="Adresse"
                    value={newClient.address}
                    onChange={(e) => setNewClient((p) => ({ ...p, address: e.target.value }))}
                  />
                  <textarea
                    className={textareaClass}
                    rows={3}
                    placeholder="Notes"
                    value={newClient.notes}
                    onChange={(e) => setNewClient((p) => ({ ...p, notes: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void addClient()}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-60"
                    >
                      {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                      Créer le client
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => { setIsAddOpen(false); resetNewPhoto(); }}
                      className="rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            ) : !selected ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white/80 px-6 py-16 text-center shadow-sm">
                <User size={40} className="text-neutral-300" strokeWidth={1.25} />
                <p className="mt-4 font-medium text-neutral-800">Sélectionnez un client</p>
                <p className="mt-1 max-w-sm text-sm text-neutral-500">Choisissez une ligne dans l’annuaire ou créez un nouveau client.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
                  <div className="border-b border-neutral-200 px-6 py-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-4">
                        <CustomerAvatar
                          name={selected.full_name}
                          photoUrl={displayPhoto(selected, isEditOpen ? editPhotoPreview : null)}
                          size={56}
                        />
                        <div className="min-w-0">
                          {isEditOpen ? (
                            <input
                              className={`${inputClass} max-w-md font-semibold`}
                              value={draft.full_name || ''}
                              onChange={(e) => setDraft((p) => ({ ...p, full_name: e.target.value }))}
                            />
                          ) : (
                            <h2 className="font-serif text-2xl font-semibold tracking-tight text-neutral-950">{selected.full_name}</h2>
                          )}
                          {selected.customer_ref ? (
                            <p className="mt-1 font-mono text-sm text-neutral-600">{selected.customer_ref}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {isEditOpen ? (
                              <input
                                className={`${inputClass} max-w-xs`}
                                value={draft.phone || ''}
                                onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                              />
                            ) : (
                              <span className="text-sm text-neutral-500">{selected.phone}</span>
                            )}
                            {isEditOpen ? (
                              <select
                                className={`${inputClass} max-w-[10rem]`}
                                value={draft.category || 'boutique'}
                                onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                              >
                                <option value="boutique">Boutique</option>
                                <option value="b2b">B2B</option>
                                <option value="online">Online</option>
                              </select>
                            ) : (
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${CATEGORY_THEME[selected.category as CustomerCategory].pill}`}
                              >
                                {CATEGORY_THEME[selected.category as CustomerCategory].label}
                              </span>
                            )}
                            <span className="text-xs text-neutral-400">Client depuis {fmtDate(selected.created_at)}</span>
                          </div>

                          {isEditOpen ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <input
                                ref={editPhotoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="sr-only"
                                id="edit-customer-photo"
                                onChange={(e) => setEditPhotoFile(e.target.files?.[0] ?? null)}
                              />
                              <label
                                htmlFor="edit-customer-photo"
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                              >
                                <ImagePlus size={14} strokeWidth={2} />
                                Changer la photo
                              </label>
                              {selected.photo_url || editPhotoFile ? (
                                <button
                                  type="button"
                                  disabled={saving && !editPhotoFile}
                                  onClick={() => {
                                    if (editPhotoFile) resetEditPhoto();
                                    else void removeCustomerPhoto();
                                  }}
                                  className="text-xs font-semibold text-neutral-500 underline hover:text-neutral-800 disabled:opacity-50"
                                >
                                  {editPhotoFile ? 'Annuler la nouvelle photo' : 'Supprimer la photo'}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {isEditOpen ? (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void saveEdit()}
                              className="inline-flex items-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
                            >
                              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => { setIsEditOpen(false); resetEditPhoto(); }}
                              className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={startEdit}
                            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                          >
                            Modifier
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <StatCard label={ACCOUNT_LABEL.totalBilled} value={fmt(account.total_du)} sub={`${orders.length} commande(s)`} />
                      <StatCard
                        label={ACCOUNT_LABEL.totalCollected}
                        value={fmt(account.total_paye)}
                        accentClass={SEMANTIC_TOKEN.success.text}
                      />
                      <StatCard
                        label={ACCOUNT_LABEL.balanceLeft}
                        value={fmt(account.solde)}
                        sub={account.solde > 0.01 ? ACCOUNT_LABEL.pending : ACCOUNT_LABEL.settled}
                        accentClass={SEMANTIC_TOKEN[accountSettlementToken(account.solde)].text}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {account.solde <= 0.01 && account.total_du > 0 ? (
                        <span
                          className={[
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ring-1',
                            SEMANTIC_TOKEN.success.pill,
                            'ring-emerald-100',
                          ].join(' ')}
                        >
                          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
                          {ACCOUNT_LABEL.settled}
                        </span>
                      ) : null}
                      {selected ? (
                        account.solde > 0.01 ? (
                          <Link
                            to={`/admin/payments?customerId=${encodeURIComponent(selected.id)}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800"
                          >
                            <Wallet size={14} strokeWidth={2} aria-hidden />
                            Enregistrer un encaissement
                          </Link>
                        ) : (
                          <span
                            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-400"
                            title="Aucun solde à encaisser pour ce client."
                          >
                            <Wallet size={14} strokeWidth={2} aria-hidden />
                            Enregistrer un encaissement
                          </span>
                        )
                      ) : null}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-1 border-t border-neutral-100 pt-5">
                      {detailTabs.map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTab(k)}
                          className={[
                            'rounded-lg px-3 py-2 text-xs font-semibold transition',
                            tab === k
                              ? 'bg-neutral-900 text-white'
                              : 'text-neutral-600 hover:bg-neutral-100',
                          ].join(' ')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-6">
                    {tab === 'overview' && (
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div className="rounded-2xl border border-neutral-200/90 bg-neutral-50/50 p-5">
                          <h3 className="text-sm font-semibold text-neutral-950">Dernières commandes</h3>
                          <div className="mt-3 space-y-2">
                            {orders.slice(0, 4).length === 0 ? (
                              <p className="text-sm text-neutral-500">Aucune commande.</p>
                            ) : (
                              orders.slice(0, 4).map((o) => {
                                const ot = logisticsThemeFor(String(o.status));
                                return (
                                  <div
                                    key={o.id}
                                    className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm"
                                  >
                                    <div>
                                      <p className="text-xs font-semibold text-neutral-950">#{o.order_number || o.id.slice(0, 8)}</p>
                                      <p className="text-[11px] text-neutral-500">{fmtDateTime(o.created_at)}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs font-semibold tabular-nums text-neutral-950">{fmt(Number(o.total || 0))}</p>
                                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ot.pill}`}>
                                        {ot.label}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-neutral-200/90 bg-neutral-50/50 p-5">
                          <h3 className="text-sm font-semibold text-neutral-950">Derniers paiements</h3>
                          <div className="mt-3 space-y-2">
                            {payments.slice(0, 4).length === 0 ? (
                              <p className="text-sm text-neutral-500">Aucun paiement.</p>
                            ) : (
                              payments.slice(0, 4).map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm"
                                >
                                  <div>
                                    <p className="text-xs font-medium text-neutral-800">
                                      {paymentMethodLabel(p.method as PaymentMethod)}
                                    </p>
                                    <p className="text-[11px] text-neutral-500">{fmtDateTime(p.paid_at)}</p>
                                  </div>
                                  <span className="text-xs font-semibold tabular-nums text-emerald-700">{fmt(Number(p.amount || 0))}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === 'orders' && (
                      <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-neutral-200 bg-neutral-50/90">
                                {['Référence', 'Date', 'Montant', 'Statut', 'Paiement', 'Source', 'Prép. caisse'].map(
                                  (label) => (
                                    <th
                                      key={label}
                                      className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500"
                                    >
                                      {label}
                                    </th>
                                  ),
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {orders.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-neutral-500">
                                    Aucune commande.
                                  </td>
                                </tr>
                              ) : (
                                orders.map((o) => {
                                  const st = logisticsThemeFor(String(o.status));
                                  const ps = asPaymentStatus(o.payment_status);
                                  const payPill = SEMANTIC_TOKEN[PAYMENT_STATUS_TOKEN[ps]].pill;
                                  const prepDone = prepPayloadDone(o.cashier_prep);
                                  return (
                                    <tr key={o.id} className={['border-l-4 transition-colors hover:bg-neutral-50/90', st.bar].join(' ')}>
                                      <td className="px-5 py-4 align-top font-semibold text-neutral-950">#{o.order_number || o.id.slice(0, 8)}</td>
                                      <td className="px-5 py-4 align-top text-neutral-500">{fmtDateTime(o.created_at)}</td>
                                      <td className="px-5 py-4 align-top font-semibold tabular-nums text-neutral-950">{fmt(Number(o.total || 0))}</td>
                                      <td className="px-5 py-4 align-top">
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${st.pill}`}>{st.label}</span>
                                      </td>
                                      <td className="px-5 py-4 align-top">
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${payPill}`}>
                                          {PAYMENT_STATUS_LABEL[ps]}
                                        </span>
                                      </td>
                                      <td className="px-5 py-4 align-top">
                                        <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                                          {o.source || '—'}
                                        </span>
                                      </td>
                                      <td className="px-5 py-4 align-top text-center">
                                        {prepDone ? (
                                          <span className="inline-flex items-center justify-center text-emerald-600" title="Préparation encaissement validée (sans paiement)">
                                            <CheckCircle2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                                            <span className="sr-only">Terminé</span>
                                          </span>
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
                      </div>
                    )}

                    {tab === 'encaissement' && selected?.category === 'online' && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5">
                          <h3 className="text-sm font-semibold text-neutral-950">Préparation encaissement (client en ligne)</h3>
                          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                            Saisissez la <strong>référence exacte</strong> de la commande (CMD), choisissez le <strong>mode de paiement</strong> prévu.
                            La validation marque la commande comme prête côté caisse — <strong>aucun paiement n’est enregistré</strong> pour l’instant.
                          </p>
                        </div>
                        <form
                          onSubmit={(e) => void submitCashierPrep(e)}
                          className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm"
                        >
                          {prepSuccess ? (
                            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
                              Préparation enregistrée. La commande apparaît comme terminée dans le tableau Commandes.
                            </div>
                          ) : null}
                          {prepError ? (
                            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{prepError}</div>
                          ) : null}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <label htmlFor="prep-cmd-ref" className="mb-1.5 block text-xs font-semibold text-neutral-700">
                                Référence commande (exacte)
                              </label>
                              <input
                                id="prep-cmd-ref"
                                className={inputClass}
                                placeholder="ex. CMD-20260429-00042"
                                value={prepOrderRef}
                                onChange={(e) => setPrepOrderRef(e.target.value)}
                                autoComplete="off"
                              />
                            </div>
                            <div>
                              <label htmlFor="prep-method" className="mb-1.5 block text-xs font-semibold text-neutral-700">
                                Mode de paiement
                              </label>
                              <select
                                id="prep-method"
                                className={inputClass}
                                value={prepMethod}
                                onChange={(e) => setPrepMethod(e.target.value as PaymentMethod)}
                              >
                                {PAYMENT_METHOD_OPTIONS.map((m) => (
                                  <option key={m.value} value={m.value}>
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {prepMethod !== 'cash' ? (
                              <div>
                                <label htmlFor="prep-instrument-ref" className="mb-1.5 block text-xs font-semibold text-neutral-700">
                                  Référence (chèque, virement…)
                                </label>
                                <input
                                  id="prep-instrument-ref"
                                  className={inputClass}
                                  placeholder="N° chèque, libellé virement…"
                                  value={prepReference}
                                  onChange={(e) => setPrepReference(e.target.value)}
                                  autoComplete="off"
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={prepSaving}
                              className="inline-flex items-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
                            >
                              {prepSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                              Valider la préparation
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {tab === 'payments' && (
                      <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[560px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-neutral-200 bg-neutral-50/90">
                                {['Date', 'Montant', 'Mode', 'Référence', 'Statut'].map((label) => (
                                  <th key={label} className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {payments.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-neutral-500">
                                    Aucun paiement.
                                  </td>
                                </tr>
                              ) : (
                                payments.map((p) => {
                                  const ps = asPaymentStatus(p.status);
                                  const payPill = SEMANTIC_TOKEN[PAYMENT_STATUS_TOKEN[ps]].pill;
                                  return (
                                    <tr key={p.id} className="hover:bg-neutral-50/90">
                                      <td className="px-5 py-4 text-neutral-500">{fmtDateTime(p.paid_at)}</td>
                                      <td className="px-5 py-4 font-semibold tabular-nums text-emerald-700">{fmt(Number(p.amount || 0))}</td>
                                      <td className="px-5 py-4 text-neutral-800">
                                        {paymentMethodLabel(p.method as PaymentMethod)}
                                      </td>
                                      <td className="px-5 py-4 text-neutral-500">{p.reference || '—'}</td>
                                      <td className="px-5 py-4">
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${payPill}`}>
                                          {PAYMENT_STATUS_LABEL[ps]}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {tab === 'info' && (
                      <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-neutral-950">Coordonnées & notes</h3>
                        <div className="mt-4 space-y-4">
                          {isEditOpen ? (
                            <>
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Adresse</p>
                                <input className={inputClass} value={draft.address || ''} onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))} />
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Notes</p>
                                <textarea className={textareaClass} rows={4} value={draft.notes || ''} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} />
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-neutral-800">
                                <span className="font-medium text-neutral-500">Adresse : </span>
                                {selected.address || '—'}
                              </p>
                              <p className="text-sm leading-relaxed text-neutral-700">
                                <span className="font-medium text-neutral-500">Notes : </span>
                                {selected.notes || 'Aucune note.'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
