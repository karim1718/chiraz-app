import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { getReportingSnapshot } from '../../services/reportingService';
import { formatCurrencyAmount } from '../../lib/vocab';
import type {
  CategoryTurnover,
  GlobalTurnover,
  OutstandingBalance,
  RecentPaymentRow,
  TopClient,
} from '../../types/finance';
import type { PaymentMethod } from '../../types/order';
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TOKEN,
  asPaymentStatus,
  paymentMethodLabel,
} from '../../utils/paymentVocab';
import { SEMANTIC_TOKEN } from '../../utils/statusTokens';

type Snapshot = {
  global: GlobalTurnover;
  byCategory: CategoryTurnover[];
  topClients: TopClient[];
  recentPayments: RecentPaymentRow[];
  outstanding: OutstandingBalance[];
};

const CATEGORY_LABEL: Record<string, string> = {
  b2b: 'B2B',
  boutique: 'Boutique',
  online: 'Online',
};

function fmtMoney(n: number) {
  return formatCurrencyAmount(Number(n), { maximumFractionDigits: 0 });
}

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    global: { orders_count: 0, turnover: 0 },
    byCategory: [],
    topClients: [],
    recentPayments: [],
    outstanding: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportingSnapshot();
      setSnapshot(data);
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const derived = useMemo(() => {
    const { global, byCategory, recentPayments, outstanding } = snapshot;
    const orders = Math.max(0, Number(global.orders_count) || 0);
    const turnover = Number(global.turnover) || 0;
    const panierMoyen = orders > 0 ? turnover / orders : 0;

    const sumRecent = recentPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalReliquat = outstanding.reduce((s, o) => s + (Number(o.outstanding_balance) || 0), 0);
    const totalDu = outstanding.reduce((s, o) => s + (Number(o.total_due) || 0), 0);
    const totalPayeOutstanding = outstanding.reduce((s, o) => s + (Number(o.total_paid) || 0), 0);

    const categoriesSorted = [...byCategory].sort(
      (a, b) => (Number(b.turnover) || 0) - (Number(a.turnover) || 0),
    );
    const caCategoriesSum = categoriesSorted.reduce((s, r) => s + (Number(r.turnover) || 0), 0);
    const denomPct = turnover > 0 ? turnover : caCategoriesSum > 0 ? caCategoriesSum : 1;

    const categoriesWithPct = categoriesSorted.map((row) => ({
      ...row,
      pctOfCa: Math.round(((Number(row.turnover) || 0) / denomPct) * 1000) / 10,
    }));

    const outstandingSorted = [...outstanding].sort(
      (a, b) => (Number(b.outstanding_balance) || 0) - (Number(a.outstanding_balance) || 0),
    );

    const topShare =
      categoriesWithPct[0] && turnover > 0
        ? categoriesWithPct[0].pctOfCa
        : categoriesWithPct[0]?.pctOfCa ?? 0;

    return {
      panierMoyen,
      sumRecent,
      totalReliquat,
      totalDu,
      totalPayeOutstanding,
      categoriesWithPct,
      outstandingSorted,
      topShare,
      topCategoryKey: categoriesWithPct[0]?.category,
    };
  }, [snapshot]);

  const kpiCards = useMemo(() => {
    const { global, recentPayments, outstanding } = snapshot;
    const { panierMoyen, sumRecent, totalReliquat } = derived;
    return [
      {
        key: 'ca',
        label: 'CA consolidé',
        value: fmtMoney(global.turnover),
        hint: 'Toutes commandes enregistrées',
      },
      {
        key: 'orders',
        label: 'Commandes',
        value: String(global.orders_count),
        hint: 'Volume total',
      },
      {
        key: 'basket',
        label: 'Panier moyen',
        value: global.orders_count > 0 ? fmtMoney(panierMoyen) : '—',
        hint: global.orders_count > 0 ? 'CA ÷ commandes' : 'Pas encore de commande',
      },
      {
        key: 'recent-sum',
        label: 'Aperçu trésorerie',
        value: recentPayments.length > 0 ? fmtMoney(sumRecent) : '—',
        hint:
          recentPayments.length > 0
            ? `Somme des ${recentPayments.length} derniers encaissements`
            : 'Aucun encaissement récent',
      },
      {
        key: 'due',
        label: 'Reliquat à recouvrer',
        value: outstanding.length > 0 ? fmtMoney(totalReliquat) : fmtMoney(0),
        hint:
          outstanding.length > 0
            ? `${outstanding.length} compte(s) avec solde débiteur`
            : 'Aucun impayé listé',
      },
    ] as const;
  }, [snapshot, derived]);

  const insightLine = useMemo(() => {
    if (loading && snapshot.global.orders_count === 0 && snapshot.byCategory.length === 0) {
      return null;
    }
    const parts: string[] = [];
    if (derived.topCategoryKey && derived.topShare > 0) {
      parts.push(
        `${CATEGORY_LABEL[derived.topCategoryKey] || derived.topCategoryKey} représente environ ${derived.topShare.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % du CA affiché.`,
      );
    }
    if (derived.totalReliquat > 0.01) {
      parts.push(
        `Reliquat cumulé : ${fmtMoney(derived.totalReliquat)} — prioriser le suivi encaissements.`,
      );
    }
    if (parts.length === 0 && snapshot.global.orders_count > 0) {
      parts.push('Répartition équilibrée ou données en cours de consolidation.');
    }
    return parts.length > 0 ? parts : null;
  }, [loading, snapshot, derived]);

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-12 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[1600px] space-y-10 px-5 py-8 sm:px-6 lg:px-8">
        {/* En-tête : objectif de page + action primaire */}
        <header className="flex flex-col gap-4 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              Finance &amp; performance
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-neutral-950">
              Rapports
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
              Lisez la santé commerciale en un coup d&apos;œil : CA, segments, meilleurs comptes,
              mouvements de trésorerie et reliquats à traiter dans Encaissements.
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
              onClick={() => void load()}
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
                to="/admin/payments"
                className="inline-flex items-center gap-1 text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
              >
                Encaissements <ArrowRight size={12} className="shrink-0 opacity-70" aria-hidden />
              </Link>
              <Link
                to="/admin/customers"
                className="inline-flex items-center gap-1 text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
              >
                Clients <ArrowRight size={12} className="shrink-0 opacity-70" aria-hidden />
              </Link>
              <Link
                to="/admin/orders"
                className="inline-flex items-center gap-1 text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
              >
                Commandes <ArrowRight size={12} className="shrink-0 opacity-70" aria-hidden />
              </Link>
            </div>
          </div>
        </header>

        {/* Synthèse narrative (scannable) */}
        {insightLine ? (
          <div
            className="rounded-2xl border border-neutral-200/90 bg-white px-5 py-4 shadow-sm sm:px-6"
            role="region"
            aria-label="Synthèse"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              En bref
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-neutral-700 marker:text-neutral-400">
              {insightLine.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {derived.totalReliquat > 0.01 ? (
          <div
            className="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/80 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={2} aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-950">Reliquats à suivre</p>
                <p className="mt-0.5 text-sm text-amber-900/90">
                  {snapshot.outstanding.length} compte(s) — total{' '}
                  <span className="font-semibold tabular-nums">{fmtMoney(derived.totalReliquat)}</span>
                  . Enregistrez les encaissements dans Encaissements pour faire baisser ce montant.
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

        {/* KPI — hiérarchie : métriques d’abord, micro-légende */}
        <section aria-labelledby="reports-kpi-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 id="reports-kpi-heading" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              Indicateurs clés
            </h2>
          </div>
          {loading && snapshot.global.orders_count === 0 && !updatedAt ? (
            <div className="flex min-h-[5.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200/90 bg-white px-4 py-10 shadow-sm">
              <Loader2
                size={28}
                className="animate-spin text-neutral-300"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="text-sm text-neutral-500">Chargement des indicateurs…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:gap-4">
              {kpiCards.map(({ key, label, value, hint }) => (
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

        {/* Performance : répartition — pleine largeur pour lecture rapide */}
        <section aria-labelledby="reports-split-heading">
          <h2 id="reports-split-heading" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Répartition du chiffre d&apos;affaires
          </h2>
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200/80 px-5 py-4 sm:px-6">
              <h3 className="font-serif text-lg font-semibold tracking-tight text-neutral-950">
                CA par catégorie client
              </h3>
              <p className="mt-1 max-w-3xl text-xs text-neutral-500">
                Part du CA et volume de commandes par segment (B2B, boutique, online). Les pourcentages
                sont calculés par rapport au CA global affiché ci-dessus.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/90">
                    {['Catégorie', 'Commandes', 'CA', 'Part du CA', ''].map((label) => (
                      <th
                        key={label || 'viz'}
                        className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 sm:px-6"
                      >
                        {label || ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading && derived.categoriesWithPct.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center sm:px-6">
                        <Loader2
                          size={28}
                          className="mx-auto animate-spin text-neutral-300"
                          strokeWidth={1.5}
                        />
                        <p className="mt-3 text-sm text-neutral-500">Chargement…</p>
                      </td>
                    </tr>
                  ) : derived.categoriesWithPct.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-14 text-center text-sm text-neutral-500 sm:px-6"
                      >
                        Aucune donnée par catégorie. Les commandes liées à des clients catégorisés
                        apparaîtront ici.
                      </td>
                    </tr>
                  ) : (
                    derived.categoriesWithPct.map((row) => (
                      <tr
                        key={row.category}
                        className="transition-colors duration-150 hover:bg-neutral-50/90"
                      >
                        <td className="px-5 py-4 align-top sm:px-6">
                          <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                            {CATEGORY_LABEL[row.category] || row.category}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top tabular-nums font-medium text-neutral-900 sm:px-6">
                          {row.orders_count}
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-semibold tabular-nums text-neutral-950 sm:px-6">
                          {fmtMoney(row.turnover)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top tabular-nums text-neutral-700 sm:px-6">
                          {row.pctOfCa.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
                        </td>
                        <td className="min-w-[140px] px-5 py-4 align-top sm:px-6">
                          <div
                            className="h-2 w-full max-w-[140px] overflow-hidden rounded-full bg-neutral-100"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full bg-neutral-800 transition-[width] duration-500"
                              style={{ width: `${Math.min(100, row.pctOfCa)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Clients & classement */}
        <section aria-labelledby="reports-clients-heading">
          <h2 id="reports-clients-heading" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Comptes &amp; relation client
          </h2>
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-neutral-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="font-serif text-lg font-semibold tracking-tight text-neutral-950">
                  Top 10 clients
                </h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Classés par CA cumulé. Ouvrez la fiche client pour le détail des commandes et du solde.
                </p>
              </div>
              <Link
                to="/admin/customers"
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950"
              >
                Tous les clients <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/90">
                    {['#', 'Client', 'Cat.', 'CA cumulé', 'Dernière cmd.'].map((label) => (
                      <th
                        key={label}
                        className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 sm:px-6"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading && snapshot.topClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center sm:px-6">
                        <Loader2
                          size={28}
                          className="mx-auto animate-spin text-neutral-300"
                          strokeWidth={1.5}
                        />
                        <p className="mt-3 text-sm text-neutral-500">Chargement…</p>
                      </td>
                    </tr>
                  ) : snapshot.topClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center sm:px-6">
                        <p className="text-sm text-neutral-500">Aucun client classé pour l&apos;instant.</p>
                        <Link
                          to="/admin/customers"
                          className="mt-3 inline-flex text-xs font-semibold text-neutral-800 underline-offset-4 hover:underline"
                        >
                          Gérer les clients
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    snapshot.topClients.map((row, index) => {
                      const last = new Date(row.last_order_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });
                      return (
                        <tr
                          key={row.customer_id}
                          className="transition-colors duration-150 hover:bg-neutral-50/90"
                        >
                          <td className="px-5 py-4 align-top tabular-nums text-xs font-semibold text-neutral-400 sm:px-6">
                            {index + 1}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="font-medium text-neutral-900">{row.full_name}</div>
                            {row.outstanding_balance > 0 ? (
                              <div className="mt-0.5 text-xs text-amber-800">
                                Impayé : {fmtMoney(row.outstanding_balance)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                              {CATEGORY_LABEL[row.category] || row.category}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 align-top text-sm font-semibold tabular-nums text-neutral-950 sm:px-6">
                            {fmtMoney(row.turnover)}
                          </td>
                          <td className="px-5 py-4 align-top text-xs text-neutral-500 sm:px-6">
                            {last}
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

        {/* Opérations : trésorerie + recouvrement côte à côte */}
        <section aria-labelledby="reports-ops-heading">
          <h2 id="reports-ops-heading" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Mouvements &amp; recouvrement
          </h2>
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-neutral-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h3 className="font-serif text-lg font-semibold tracking-tight text-neutral-950">
                    Derniers encaissements
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Les 10 derniers paiements enregistrés — contrôlez les statuts avant validation
                    comptable.
                  </p>
                </div>
                <Link
                  to="/admin/payments"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950"
                >
                  Encaissements <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <div className="max-h-[22rem] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 backdrop-blur-sm">
                    <tr>
                      {['Date', 'Client', 'Montant', 'Méthode', 'Statut'].map((label) => (
                        <th
                          key={label}
                          className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 sm:px-6"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loading && snapshot.recentPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center sm:px-6">
                          <Loader2
                            size={28}
                            className="mx-auto animate-spin text-neutral-300"
                            strokeWidth={1.5}
                          />
                          <p className="mt-3 text-sm text-neutral-500">Chargement…</p>
                        </td>
                      </tr>
                    ) : snapshot.recentPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center sm:px-6">
                          <p className="text-sm text-neutral-500">Aucun paiement récent.</p>
                          <Link
                            to="/admin/payments"
                            className="mt-3 inline-flex text-xs font-semibold text-neutral-800 underline-offset-4 hover:underline"
                          >
                            Enregistrer un encaissement
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      snapshot.recentPayments.map((row) => {
                        const when = new Date(row.paid_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const ps = asPaymentStatus(row.status);
                        const payPill = SEMANTIC_TOKEN[PAYMENT_STATUS_TOKEN[ps]].pill;
                        return (
                          <tr
                            key={row.id}
                            className="transition-colors duration-150 hover:bg-neutral-50/90"
                          >
                            <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-neutral-600 sm:px-6">
                              {when}
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="font-medium text-neutral-900">{row.customer_name}</div>
                              <div className="mt-0.5 text-xs text-neutral-500">
                                {CATEGORY_LABEL[row.category] || row.category}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 align-top text-sm font-semibold tabular-nums text-neutral-950 sm:px-6">
                              {fmtMoney(row.amount)}
                            </td>
                            <td className="px-5 py-4 align-top">
                              <span className="inline-flex rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-800">
                                {paymentMethodLabel(row.method as PaymentMethod)}
                              </span>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${payPill}`}
                              >
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

            <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-neutral-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h3 className="font-serif text-lg font-semibold tracking-tight text-neutral-950">
                    Soldes impayés
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Top 10 des reliquats — le total en pied de tableau regroupe uniquement ces lignes.
                  </p>
                </div>
                <Link
                  to="/admin/payments"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950"
                >
                  Solder un compte <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <div className="max-h-[22rem] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 backdrop-blur-sm">
                    <tr>
                      {['Client', 'Cat.', 'Total dû', 'Payé', 'Solde'].map((label) => (
                        <th
                          key={label}
                          className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 sm:px-6"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loading && derived.outstandingSorted.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center sm:px-6">
                          <Loader2
                            size={28}
                            className="mx-auto animate-spin text-neutral-300"
                            strokeWidth={1.5}
                          />
                          <p className="mt-3 text-sm text-neutral-500">Chargement…</p>
                        </td>
                      </tr>
                    ) : derived.outstandingSorted.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center sm:px-6">
                          <p className="text-sm font-medium text-emerald-800">Aucun impayé dans ce top 10.</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            Continuez à enregistrer les encaissements pour garder les comptes à jour.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      derived.outstandingSorted.map((row) => (
                        <tr
                          key={row.customer_id}
                          className="transition-colors duration-150 hover:bg-neutral-50/90"
                        >
                          <td className="px-5 py-4 align-top font-medium text-neutral-900 sm:px-6">
                            {row.full_name}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                              {CATEGORY_LABEL[row.category] || row.category}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 align-top tabular-nums text-neutral-800 sm:px-6">
                            {fmtMoney(row.total_due)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 align-top tabular-nums text-neutral-600 sm:px-6">
                            {fmtMoney(row.total_paid)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 align-top text-sm font-semibold tabular-nums text-neutral-950 sm:px-6">
                            {fmtMoney(row.outstanding_balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {derived.outstandingSorted.length > 0 ? (
                    <tfoot>
                      <tr className="border-t-2 border-neutral-200 bg-neutral-50/95">
                        <td
                          colSpan={2}
                          className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 sm:px-6"
                        >
                          Sous-total (lignes affichées)
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-sm font-semibold tabular-nums text-neutral-900 sm:px-6">
                          {fmtMoney(derived.totalDu)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-sm font-semibold tabular-nums text-neutral-700 sm:px-6">
                          {fmtMoney(derived.totalPayeOutstanding)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-sm font-bold tabular-nums text-neutral-950 sm:px-6">
                          {fmtMoney(derived.totalReliquat)}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
