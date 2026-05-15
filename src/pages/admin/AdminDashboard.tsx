import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrencyAmount } from '../../lib/vocab';
import OrderDetailModal from '../../components/admin/OrderDetailModal';
import StockUpdateModal from '../../components/admin/StockUpdateModal';
import type { Order } from '../../types/order';
import { logisticsThemeFor } from '../../utils/logisticsTheme';

function fmtMoney(n: number) {
  return formatCurrencyAmount(Number(n), { maximumFractionDigits: 0 });
}

function getLocalDayBoundsISO(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

type AlertVariantRow = {
  id: string;
  size: string | number | null;
  color: string | null;
  stock: number;
  low_stock_alert: number | null;
  product_id: string;
  products: {
    id: string;
    name: string;
    images?: string[];
    color_media?: Record<string, unknown> | null;
  } | null;
};

const HIGH_DEBT_THRESHOLD = 1000;

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [ordersTodayCount, setOrdersTodayCount] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [stockAlertCount, setStockAlertCount] = useState(0);
  const [paymentsToday, setPaymentsToday] = useState(0);
  const [pendingPaymentsAmount, setPendingPaymentsAmount] = useState(0);
  const [overduePaymentsCount, setOverduePaymentsCount] = useState(0);
  const [highDebtCustomersCount, setHighDebtCustomersCount] = useState(0);
  const [financialAlerts, setFinancialAlerts] = useState<string[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [alertVariants, setAlertVariants] = useState<AlertVariantRow[]>([]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [stockModalVariant, setStockModalVariant] = useState<AlertVariantRow | null>(null);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const { start, end } = getLocalDayBoundsISO();

    try {
      const { count: todayCount, error: errToday } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', end);

      if (!errToday && todayCount !== null) {
        setOrdersTodayCount(todayCount);
      }

      const { data: todayRows, error: errRev } = await supabase
        .from('orders')
        .select('total, status')
        .gte('created_at', start)
        .lte('created_at', end)
        .neq('status', 'annulé')
        .neq('status', 'refusé');

      if (!errRev && todayRows) {
        const sum = todayRows.reduce(
          (acc, row) => acc + Number(row.total ?? 0),
          0,
        );
        setRevenueToday(sum);
      } else {
        setRevenueToday(0);
      }

      const { count: pend, error: errPend } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['nouveau', 'confirmé']);

      if (!errPend && pend !== null) {
        setPendingCount(pend);
      }

      const { data: paymentsRows } = await supabase
        .from('payments')
        .select('amount, status, paid_at')
        .gte('paid_at', start)
        .lte('paid_at', end);
      const todayPaid = (paymentsRows || []).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
      );
      setPaymentsToday(todayPaid);

      const { data: pendingRows } = await supabase
        .from('payments')
        .select('amount')
        .in('status', ['en_attente_encaissement', 'en_retard']);
      setPendingPaymentsAmount(
        (pendingRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0),
      );

      const { count: overdueCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'en_retard');
      setOverduePaymentsCount(overdueCount || 0);

      const { data: accountRows } = await supabase
        .from('customer_accounts')
        .select('solde');
      const highDebt = (accountRows || []).filter(
        (row) => Number(row.solde || 0) >= HIGH_DEBT_THRESHOLD,
      ).length;
      setHighDebtCustomersCount(highDebt);

      const { data: upcomingCheques } = await supabase
        .from('payment_instruments')
        .select('due_date')
        .not('due_date', 'is', null);
      const now = new Date();
      const alerts: string[] = [];
      (upcomingCheques || []).forEach((row) => {
        if (!row.due_date) return;
        const due = new Date(row.due_date);
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 3) {
          alerts.push(`Chèque à encaisser sous ${diffDays} jour(s).`);
        }
      });
      if ((overdueCount || 0) > 0) {
        alerts.push(`${overdueCount} paiement(s) en retard.`);
      }
      if (highDebt > 0) {
        alerts.push(
          `${highDebt} client(s) avec solde ≥ ${fmtMoney(HIGH_DEBT_THRESHOLD)}.`,
        );
      }
      setFinancialAlerts(alerts.slice(0, 5));

      const { data: vars, error: varsError } = await supabase
        .from('variants')
        .select(
          `
          id, size, color, stock, low_stock_alert, product_id,
          products ( id, name, images, color_media )
        `,
        )
        .order('stock', { ascending: true });

      if (!varsError && vars) {
        const list: AlertVariantRow[] = vars.map((v: Record<string, unknown>) => {
          const p = v.products;
          const product =
            Array.isArray(p) && p[0] && typeof p[0] === 'object'
              ? (p[0] as AlertVariantRow['products'])
              : p && typeof p === 'object'
                ? (p as AlertVariantRow['products'])
                : null;
          return {
            id: String(v.id),
            size: (v.size as string | number | null) ?? null,
            color: (v.color as string | null) ?? null,
            stock: Number(v.stock ?? 0),
            low_stock_alert:
              v.low_stock_alert === null || v.low_stock_alert === undefined
                ? null
                : Number(v.low_stock_alert),
            product_id: String(v.product_id),
            products: product,
          };
        });
        const threshold = (v: AlertVariantRow) => v.low_stock_alert ?? 3;
        const lowStock = list.filter((v) => v.stock <= threshold(v));
        setStockAlertCount(lowStock.length);
        setAlertVariants(lowStock.slice(0, 5));
      } else {
        setStockAlertCount(0);
        setAlertVariants([]);
      }

      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select(
          `
          *,
          order_items (
            quantity, price,
            variants (
              size, color,
              products ( id, name, images, color_media )
            )
          )
        `,
        )
        .order('created_at', { ascending: false })
        .limit(10);

      if (!ordersErr && ordersData) {
        setRecentOrders(ordersData as Order[]);
      } else {
        setRecentOrders([]);
      }

      setUpdatedAt(new Date());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const panierMoyenJour =
    ordersTodayCount > 0 ? revenueToday / ordersTodayCount : 0;

  const insightLines = useMemo(() => {
    if (loading && !updatedAt) return null;
    const lines: string[] = [];
    if (pendingCount > 0) {
      lines.push(
        `${pendingCount} commande(s) au statut nouveau ou confirmé — à traiter depuis Commandes.`,
      );
    }
    if (stockAlertCount > 0) {
      lines.push(
        `${stockAlertCount} variante(s) sous le seuil de stock — prioriser la réapprovisionnement.`,
      );
    }
    if (overduePaymentsCount > 0) {
      lines.push(
        `${overduePaymentsCount} paiement(s) en retard — vérifier dans Encaissements.`,
      );
    }
    if (lines.length === 0 && ordersTodayCount === 0 && !loading) {
      lines.push('Journée calme côté commandes : surveillez tout de même les reliquats et le stock.');
    }
    return lines.length > 0 ? lines : null;
  }, [
    loading,
    updatedAt,
    pendingCount,
    stockAlertCount,
    overduePaymentsCount,
    ordersTodayCount,
  ]);

  const kpiToday = useMemo(
    () => [
      {
        key: 'orders-day',
        label: 'Commandes (jour)',
        value: String(ordersTodayCount),
        hint: 'Créées entre minuit et maintenant (heure locale).',
      },
      {
        key: 'ca-day',
        label: 'CA du jour',
        value: fmtMoney(revenueToday),
        hint: 'Total TTC des commandes du jour (hors annulé / refusé).',
      },
      {
        key: 'pay-day',
        label: 'Encaissements (jour)',
        value: fmtMoney(paymentsToday),
        hint: "Somme des paiements enregistrés aujourd'hui.",
      },
      {
        key: 'basket',
        label: 'Panier moyen (jour)',
        value: ordersTodayCount > 0 ? fmtMoney(panierMoyenJour) : '—',
        hint:
          ordersTodayCount > 0
            ? 'CA du jour ÷ commandes du jour.'
            : "Pas de commande aujourd'hui.",
      },
    ],
    [ordersTodayCount, revenueToday, paymentsToday, panierMoyenJour],
  );

  const kpiFollow = useMemo(
    () => [
      {
        key: 'pending-orders',
        label: 'À traiter',
        value: String(pendingCount),
        hint: 'Nouveau + confirmé — file logistique.',
      },
      {
        key: 'stock',
        label: 'Alertes stock',
        value: String(stockAlertCount),
        hint: 'Variantes au ou sous le seuil (défaut 3 si non défini).',
      },
      {
        key: 'pending-pay',
        label: 'Montants en attente',
        value: fmtMoney(pendingPaymentsAmount),
        hint: "Paiements en attente d'encaissement ou en retard (montant total).",
      },
      {
        key: 'overdue',
        label: 'Paiements en retard',
        value: String(overduePaymentsCount),
        hint: 'Nombre de lignes paiement au statut « en retard ».',
      },
      {
        key: 'debt',
        label: 'Clients à solde élevé',
        value: String(highDebtCustomersCount),
        hint: `Solde compte ≥ ${fmtMoney(HIGH_DEBT_THRESHOLD)}.`,
      },
    ],
    [
      pendingCount,
      stockAlertCount,
      pendingPaymentsAmount,
      overduePaymentsCount,
      highDebtCustomersCount,
    ],
  );

  const topStockRows = alertVariants;

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-12 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[1600px] space-y-10 px-5 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              Pilotage quotidien
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-neutral-950">
              Tableau de bord
            </h1>
            <p className="mt-2 max-w-2xl text-sm capitalize leading-relaxed text-neutral-500">
              {todayLabel}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
              Synthèse de la journée, files à traiter et signaux financiers. Actualisez après une
              série d&apos;actions (commandes, stock, encaissements).
            </p>
            {updatedAt ? (
              <p className="mt-3 text-xs text-neutral-400">
                Dernière actualisation :{' '}
                <time dateTime={updatedAt.toISOString()}>
                  {updatedAt.toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => void fetchDashboard()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                strokeWidth={2}
                className={loading ? 'animate-spin text-neutral-500' : 'text-neutral-600'}
                aria-hidden
              />
              Actualiser
            </button>
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs font-medium text-neutral-500">
              <Link
                to="/admin/orders"
                className="inline-flex items-center gap-1 text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
              >
                Commandes <ArrowRight size={12} className="shrink-0 opacity-70" aria-hidden />
              </Link>
              <Link
                to="/admin/stock"
                className="inline-flex items-center gap-1 text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
              >
                Stock <ArrowRight size={12} className="shrink-0 opacity-70" aria-hidden />
              </Link>
              <Link
                to="/admin/payments"
                className="inline-flex items-center gap-1 text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
              >
                Encaissements <ArrowRight size={12} className="shrink-0 opacity-70" aria-hidden />
              </Link>
              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-1 text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
              >
                Rapports <ArrowRight size={12} className="shrink-0 opacity-70" aria-hidden />
              </Link>
            </div>
          </div>
        </header>

        {insightLines ? (
          <div
            className="rounded-2xl border border-neutral-200/90 bg-white px-5 py-4 shadow-sm sm:px-6"
            role="region"
            aria-label="Synthèse"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              En bref
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-neutral-700 marker:text-neutral-400">
              {insightLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {(overduePaymentsCount > 0 || pendingPaymentsAmount > 0.01) && !loading ? (
          <div
            className="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/80 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={2} aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-950">Trésorerie à surveiller</p>
                <p className="mt-0.5 text-sm text-amber-900/90">
                  {overduePaymentsCount > 0
                    ? `${overduePaymentsCount} retard(s). `
                    : ''}
                  {pendingPaymentsAmount > 0.01
                    ? `${fmtMoney(pendingPaymentsAmount)} encore en attente d'encaissement.`
                    : null}
                </p>
              </div>
            </div>
            <Link
              to="/admin/payments"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              Ouvrir Encaissements
            </Link>
          </div>
        ) : null}

        <section aria-labelledby="dash-kpi-today">
          <h2
            id="dash-kpi-today"
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
          >
            Journée en cours
          </h2>
          {loading && !updatedAt ? (
            <div className="flex min-h-[5.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200/90 bg-white px-4 py-10 shadow-sm">
              <Loader2
                size={28}
                className="animate-spin text-neutral-300"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="text-sm text-neutral-500">Chargement du tableau de bord…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
              {kpiToday.map(({ key, label, value, hint }) => (
                <div
                  key={key}
                  className="flex min-h-[6.25rem] flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white px-4 py-4 shadow-sm transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/80 hover:shadow-md"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                      {label}
                    </p>
                    <p className="mt-2 tabular-nums text-2xl font-bold tracking-tight text-neutral-950">
                      {value}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-neutral-500">{hint}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="dash-kpi-follow">
          <h2
            id="dash-kpi-follow"
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
          >
            Files &amp; risques
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
            {kpiFollow.map(({ key, label, value, hint }) => (
              <div
                key={key}
                className="flex min-h-[6.25rem] flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white px-4 py-4 shadow-sm transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/80 hover:shadow-md"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    {label}
                  </p>
                  <p className="mt-2 tabular-nums text-2xl font-bold tracking-tight text-neutral-950">
                    {loading && !updatedAt ? '—' : value}
                  </p>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-neutral-500">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2 xl:gap-8">
          <section
            aria-labelledby="dash-recent-orders"
            className="flex min-h-0 flex-col xl:min-h-[28rem]"
          >
            <h2
              id="dash-recent-orders"
              className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
            >
              Logistique
            </h2>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
              <div className="flex shrink-0 flex-col gap-2 border-b border-neutral-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg font-semibold tracking-tight text-neutral-950">
                    Dernières commandes
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Les 10 plus récentes — cliquez une ligne pour ouvrir le détail.
                  </p>
                </div>
                <Link
                  to="/admin/orders"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950"
                >
                  Toutes les commandes <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[30%]" />
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-neutral-200 bg-neutral-50/95 backdrop-blur-sm">
                      {['Commande', 'Client', 'Statut', 'Total', ''].map((label, i) => (
                        <th
                          key={label || `a-${i}`}
                          className={
                            i === 4
                              ? 'px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 sm:px-5'
                              : 'px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 sm:px-5'
                          }
                        >
                          {label === '' ? 'Actions' : label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loading && recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-14 text-center sm:px-5">
                          <Loader2
                            size={28}
                            className="mx-auto animate-spin text-neutral-300"
                            strokeWidth={1.5}
                          />
                          <p className="mt-3 text-sm text-neutral-500">Chargement…</p>
                        </td>
                      </tr>
                    ) : recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-14 text-center sm:px-5">
                          <p className="text-sm text-neutral-500">Aucune commande pour l&apos;instant.</p>
                          <Link
                            to="/admin/orders"
                            className="mt-3 inline-flex text-xs font-semibold text-neutral-800 underline-offset-4 hover:underline"
                          >
                            Voir les commandes
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((order) => {
                        const ref = order.order_number || order.id.slice(0, 8);
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
                              'hover:bg-neutral-50/90',
                            ].join(' ')}
                          >
                            <td className="px-3 py-3 align-top font-semibold text-neutral-950 sm:px-4">
                              <span className="block truncate" title={`#${ref}`}>
                                #{ref.length > 12 ? `${ref.slice(0, 12)}…` : ref}
                              </span>
                            </td>
                            <td className="min-w-0 px-3 py-3 align-top font-medium text-neutral-900 sm:px-4">
                              <span className="block truncate" title={order.customer_name}>
                                {order.customer_name}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-top sm:px-4">
                              <span
                                className={`inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${rowTheme.pill}`}
                                title={rowTheme.label}
                              >
                                {rowTheme.label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 align-top text-sm font-semibold tabular-nums text-neutral-950 sm:px-4">
                              {fmtMoney(Number(order.total ?? 0))}
                            </td>
                            <td className="px-3 py-3 text-right align-top sm:px-4">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(order);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
                              >
                                <Eye size={14} strokeWidth={2} aria-hidden />
                                Voir
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="dash-stock"
            className="flex min-h-0 flex-col xl:min-h-[28rem]"
          >
            <h2
              id="dash-stock"
              className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
            >
              Inventaire
            </h2>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
              <div className="flex shrink-0 flex-col gap-2 border-b border-neutral-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg font-semibold tracking-tight text-neutral-950">
                    Alertes stock
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Cinq références les plus critiques (stock le plus bas). Seuil = alerte produit ou 3 par défaut.
                  </p>
                </div>
                <Link
                  to="/admin/stock"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950"
                >
                  Gérer le stock <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[36%]" />
                    <col className="w-[12%]" />
                    <col className="w-[20%]" />
                    <col className="w-[12%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-neutral-200 bg-neutral-50/95 backdrop-blur-sm">
                      {['Produit', 'Taille', 'Couleur', 'Stock', ''].map((label, i) => (
                        <th
                          key={label || `s-${i}`}
                          className={
                            i === 4
                              ? 'px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 sm:px-5'
                              : 'px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 sm:px-5'
                          }
                        >
                          {label === '' ? 'Action' : label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loading && topStockRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-14 text-center sm:px-5">
                          <Loader2
                            size={28}
                            className="mx-auto animate-spin text-neutral-300"
                            strokeWidth={1.5}
                          />
                          <p className="mt-3 text-sm text-neutral-500">Chargement…</p>
                        </td>
                      </tr>
                    ) : topStockRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-14 text-center sm:px-5">
                          <p className="text-sm font-medium text-emerald-800">Aucune alerte sous le seuil.</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            Les variantes apparaissent ici lorsque le stock atteint le seuil défini.
                          </p>
                          <Link
                            to="/admin/stock"
                            className="mt-3 inline-flex text-xs font-semibold text-neutral-800 underline-offset-4 hover:underline"
                          >
                            Ouvrir la page Stock
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      topStockRows.map((v) => (
                        <tr
                          key={v.id}
                          className="transition-colors duration-150 hover:bg-neutral-50/90"
                        >
                          <td className="min-w-0 px-3 py-3 align-top font-medium text-neutral-900 sm:px-4">
                            <span className="block truncate" title={v.products?.name ?? undefined}>
                              {v.products?.name ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top tabular-nums text-neutral-800 sm:px-4">
                            <span className="block truncate">{v.size ?? '—'}</span>
                          </td>
                          <td className="min-w-0 px-3 py-3 align-top text-neutral-700 sm:px-4">
                            <span className="block truncate" title={v.color ?? undefined}>
                              {v.color ?? '—'}
                            </span>
                          </td>
                          <td
                            className={`px-3 py-3 align-top text-sm font-semibold tabular-nums sm:px-4 ${
                              v.stock === 0 ? 'text-red-700' : 'text-amber-800'
                            }`}
                          >
                            {v.stock}
                          </td>
                          <td className="px-3 py-3 text-right align-top sm:px-4">
                            <button
                              type="button"
                              onClick={() => setStockModalVariant(v)}
                              title="Réapprovisionner — ouvrir le formulaire d’entrée de stock"
                              className="inline-flex w-full min-w-0 max-w-[9.5rem] items-center justify-center rounded-lg border border-amber-600 bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:border-amber-700 hover:bg-amber-700 sm:ml-auto sm:w-auto"
                            >
                              Réappro.
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <section aria-labelledby="dash-finance-alerts">
          <h2
            id="dash-finance-alerts"
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
          >
            Signaux financiers
          </h2>
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-neutral-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="font-serif text-lg font-semibold tracking-tight text-neutral-950">
                  Alertes financières
                </h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Échéances de chèques (≤ 3 jours), retards de paiement et soldes clients élevés.
                </p>
              </div>
              <Link
                to="/admin/payments"
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950"
              >
                Encaissements <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
            <ul className="divide-y divide-neutral-100 px-5 py-2 sm:px-6">
              {financialAlerts.length === 0 ? (
                <li className="py-6 text-center text-sm text-neutral-500">
                  Aucune alerte financière active.
                </li>
              ) : (
                financialAlerts.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    className="flex gap-3 py-4 text-sm text-neutral-800"
                  >
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>

      <OrderDetailModal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        onStatusChange={() => void fetchDashboard()}
      />

      <StockUpdateModal
        isOpen={Boolean(stockModalVariant)}
        onClose={() => setStockModalVariant(null)}
        onSuccess={() => {
          setStockModalVariant(null);
          void fetchDashboard();
        }}
        variant={stockModalVariant}
        type={stockModalVariant ? 'entrée' : null}
      />
    </div>
  );
}
