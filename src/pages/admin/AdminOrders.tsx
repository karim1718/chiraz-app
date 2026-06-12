import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrencyAmount } from '../../lib/vocab';
import { Search, Loader2, Eye, Calendar, X } from 'lucide-react';
const OrderDetailModal = lazy(() => import('../../components/admin/OrderDetailModal'));
import type { Order } from '../../types/order';
import useDebounce from '../../components/admin/ui/useDebounce';
import { logisticsThemeFor } from '../../utils/logisticsTheme';

/** Clés statut logistique (alignées `OrderStatus` + filtres). */
const LOGISTICS_STATUS_KEYS = [
  'nouveau',
  'confirmé',
  'en_preparation',
  'expédié',
  'livré',
  'annulé',
  'refusé',
  'retourné',
] as const;

const ORDER_SELECT = `
  *,
  order_items (
    quantity, price,
    variants (
      size, color,
      products ( id, name, images, color_media )
    )
  )
`;

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [sourceFilter, setSourceFilter] = useState('toutes');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as Order;
          setNewOrderIds((prev) => new Set(prev).add(newOrder.id));
          void fetchOrderById(newOrder.id).then((order) => {
            if (order) {
              setOrders((prev) => {
                if (prev.some((o) => o.id === order.id)) return prev;
                return [order, ...prev];
              });
            }
          });
          setTimeout(() => {
            setNewOrderIds((prev) => {
              const next = new Set(prev);
              next.delete(newOrder.id);
              return next;
            });
          }, 5000);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrderById = async (orderId: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .maybeSingle();
    if (error || !data) return null;
    return data as Order;
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data as Order[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erreur chargement commandes:', msg);
    } finally {
      setLoading(false);
    }
  };

  const countsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    LOGISTICS_STATUS_KEYS.forEach((s) => {
      counts[s] = 0;
    });
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) {
        counts[o.status]++;
      }
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'tous' && o.status !== statusFilter) return false;

      if (
        sourceFilter !== 'toutes' &&
        (o.source || 'web').toLowerCase() !== sourceFilter
      ) {
        return false;
      }

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchName = o.customer_name?.toLowerCase().includes(q);
        const matchPhone = o.phone?.toLowerCase().includes(q);
        if (!matchName && !matchPhone) return false;
      }

      if (dateStart) {
        if (new Date(o.created_at) < new Date(dateStart)) return false;
      }
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setDate(end.getDate() + 1);
        if (new Date(o.created_at) >= end) return false;
      }

      return true;
    });
  }, [orders, statusFilter, sourceFilter, debouncedSearch, dateStart, dateEnd]);

  const hasDateFilter = Boolean(dateStart || dateEnd);
  const hasActiveFilters =
    statusFilter !== 'tous' ||
    searchTerm ||
    sourceFilter !== 'toutes' ||
    dateStart ||
    dateEnd;

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-10 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-8 sm:px-6 lg:px-8">
        {/* En-tête : typo modale (serif titre + sans corps) */}
        <header className="border-b border-neutral-200/80 pb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-neutral-950">
            Commandes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            Gérez le cycle de vie de toutes les commandes : filtrez, ouvrez le détail et mettez à jour les statuts.
          </p>
        </header>

        {/* Cartes statut */}
        <section aria-label="Filtrer par statut">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Statuts
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 lg:gap-4">
            {LOGISTICS_STATUS_KEYS.map((status) => {
              const theme = logisticsThemeFor(status);
              const count = countsByStatus[status];
              const isActive = statusFilter === status;
              const isHighlight = status === 'nouveau' && count > 0;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(isActive ? 'tous' : status)}
                  className={[
                    'group flex h-[5.5rem] flex-col justify-center rounded-2xl border border-neutral-200/90 border-l-4 bg-white px-3.5 text-left shadow-sm transition-all duration-200',
                    theme.bar,
                    isActive
                      ? 'ring-2 ring-neutral-900 ring-offset-2 ring-offset-[#F9FAFB]'
                      : isHighlight
                        ? 'bg-blue-50/60 ring-1 ring-blue-200/80'
                        : 'hover:border-neutral-300 hover:bg-neutral-50/80 hover:shadow-md',
                  ].join(' ')}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${theme.dot}`}
                      aria-hidden
                    />
                    <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">
                      {count}
                    </span>
                  </div>
                  <span
                    className={[
                      'mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-neutral-600',
                      isActive ? 'text-neutral-950' : '',
                      isHighlight && !isActive ? 'text-blue-900' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filtres : mobile = colonne ordonnée ; lg = grille 2 lignes alignées */}
        <section
          className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6"
          aria-label="Recherche et filtres"
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,1fr)_minmax(140px,0.4fr)_auto] lg:gap-x-6 lg:gap-y-2">
            <label
              htmlFor="orders-search"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-1"
            >
              Recherche
            </label>
            <div className="relative min-w-0 lg:row-start-2 lg:col-start-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                strokeWidth={1.75}
              />
              <input
                id="orders-search"
                type="text"
                placeholder="Client ou téléphone…"
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

            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-2">
              Période
            </span>
            <div className="flex h-10 min-w-0 flex-nowrap items-center gap-2 overflow-x-auto lg:row-start-2 lg:col-start-2">
              <Calendar
                size={18}
                className="shrink-0 text-neutral-400"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="h-10 w-[10.5rem] shrink-0 rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 sm:w-[11rem] sm:px-3"
              />
              <span className="shrink-0 text-xs font-medium text-neutral-400">au</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="h-10 w-[10.5rem] shrink-0 rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 sm:w-[11rem] sm:px-3"
              />
              {hasDateFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setDateStart('');
                    setDateEnd('');
                  }}
                  className="ml-1 shrink-0 whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
                >
                  Effacer dates
                </button>
              ) : null}
            </div>

            <label
              htmlFor="orders-source"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-3"
            >
              Source
            </label>
            <select
              id="orders-source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 lg:row-start-2 lg:col-start-3"
            >
              <option value="toutes">Toutes</option>
              <option value="web">Site Web</option>
              <option value="direct">Vente directe</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Téléphone</option>
            </select>

            {hasActiveFilters ? (
              <>
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-4 lg:block">
                  Actions
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('tous');
                    setSearchTerm('');
                    setSourceFilter('toutes');
                    setDateStart('');
                    setDateEnd('');
                  }}
                  className="h-10 w-full rounded-lg border border-neutral-200 px-4 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 lg:row-start-2 lg:col-start-4 lg:w-auto lg:min-w-[9.5rem]"
                >
                  Tout réinitialiser
                </button>
              </>
            ) : null}
          </div>
        </section>

        {/* Tableau */}
        <section
          className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm"
          aria-label="Liste des commandes"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/90">
                  {[
                    'Commande',
                    'Client',
                    'Lieu',
                    'Articles',
                    'Total',
                    'Source',
                    'Statut',
                    '',
                  ].map((label, i) => (
                    <th
                      key={label || `a-${i}`}
                      className={
                        i === 7
                          ? 'px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500'
                          : 'px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500'
                      }
                    >
                      {label === '' ? 'Actions' : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <Loader2
                        size={28}
                        className="mx-auto animate-spin text-neutral-300"
                        strokeWidth={1.5}
                      />
                      <p className="mt-3 text-sm text-neutral-500">Chargement…</p>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-16 text-center text-sm text-neutral-500"
                    >
                      Aucune commande ne correspond à ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const date = new Date(order.created_at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const orderRef = order.order_number || order.id.slice(0, 8);
                    const isNewHighlight = newOrderIds.has(order.id);
                    const rowTheme = logisticsThemeFor(order.status);

                    return (
                      <tr
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedOrder(order)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedOrder(order);
                          }
                        }}
                        className={[
                          'cursor-pointer border-l-4 transition-colors duration-150',
                          rowTheme.bar,
                          isNewHighlight
                            ? 'bg-blue-50/70 hover:bg-blue-50'
                            : 'hover:bg-neutral-50/90',
                        ].join(' ')}
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="font-semibold text-neutral-950">
                            #{orderRef}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500">{date}</div>
                          {isNewHighlight ? (
                            <span className="mt-2 inline-flex items-center rounded-md bg-neutral-900 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-white">
                              Nouveau
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="font-medium text-neutral-900">
                            {order.customer_name}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500">
                            {order.phone}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-neutral-900">
                            {order.wilaya || order.city || '—'}
                          </div>
                          {order.commune ? (
                            <div className="mt-0.5 text-xs text-neutral-500">
                              {order.commune}
                            </div>
                          ) : null}
                        </td>
                        <td className="max-w-[220px] px-5 py-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            {order.order_items?.map((item: any, idx: number) => {
                              const pName =
                                item.variants?.products?.name || 'Produit';
                              const pSize = item.variants?.size;
                              return (
                                <div
                                  key={idx}
                                  className="truncate rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800"
                                  title={`${pName} T${pSize} ×${item.quantity}`}
                                >
                                  <span className="font-semibold tabular-nums">
                                    {item.quantity}×
                                  </span>{' '}
                                  <span className="text-neutral-700">{pName}</span>{' '}
                                  <span className="text-neutral-500">T{pSize}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top text-sm font-semibold tabular-nums text-neutral-950">
                          {formatCurrencyAmount(Number(order.total), { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                            {order.source || 'web'}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${rowTheme.pill}`}
                          >
                            {rowTheme.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right align-top">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                          >
                            <Eye size={14} strokeWidth={2} /> Voir
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Suspense fallback={null}>
        <OrderDetailModal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
          onStatusChange={fetchOrders}
        />
      </Suspense>
    </div>
  );
}
