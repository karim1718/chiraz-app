import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Loader2, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useDebounce from '../../components/admin/ui/useDebounce';
import { formatCurrencyAmount } from '../../lib/vocab';
import {
  archiveOrderLead,
  fetchOrderLeads,
  type OrderLead,
  type OrderLeadStatus,
} from '../../services/orderLeadService';
import { openWhatsAppQuickChat } from '../../services/notificationService';

const STATUS_LABELS: Record<OrderLeadStatus, string> = {
  draft: 'Brouillon',
  converted: 'Converti',
  archived: 'Archivé',
};

const STATUS_STYLES: Record<OrderLeadStatus, string> = {
  draft: 'bg-amber-50 text-amber-900 border-amber-200',
  converted: 'bg-green-50 text-green-900 border-green-200',
  archived: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

function formatLeadDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-DZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminOrderLeads() {
  const [leads, setLeads] = useState<OrderLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderLeadStatus | 'all'>('draft');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrderLeads({ status: 'all' });
      setLeads(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-order-leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_leads' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const lead = payload.new as OrderLead;
            setLeads((prev) => {
              if (prev.some((l) => l.id === lead.id)) return prev;
              return [lead, ...prev];
            });
            return;
          }
          if (payload.eventType === 'UPDATE') {
            const lead = payload.new as OrderLead;
            setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
            return;
          }
          if (payload.eventType === 'DELETE') {
            const lead = payload.old as { id: string };
            setLeads((prev) => prev.filter((l) => l.id !== lead.id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filteredLeads = useMemo(() => {
    let base = leads;
    if (statusFilter !== 'all') {
      base = base.filter((l) => l.status === statusFilter);
    }
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((l) => {
      const hay = [
        l.full_name,
        l.phone,
        l.city,
        l.product_name,
        l.selected_color,
        l.selected_size != null ? String(l.selected_size) : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, debouncedSearch, statusFilter]);

  const countsByStatus = useMemo(() => {
    const counts: Record<string, number> = { draft: 0, converted: 0, archived: 0 };
    leads.forEach((l) => {
      if (counts[l.status] !== undefined) counts[l.status]++;
    });
    return counts;
  }, [leads]);

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      await archiveOrderLead(id);
      await loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-10 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-neutral-200/80 pb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-neutral-950">
            Prospects / brouillons
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            Formulaires commencés sur le site sans clic sur « Confirmer ma commande ». Les données sont
            enregistrées automatiquement après 2 secondes sans modification.
          </p>
        </header>

        <section aria-label="Filtrer par statut">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Statuts
          </p>
          <div className="flex flex-wrap gap-2">
            {(['all', 'draft', 'converted', 'archived'] as const).map((s) => {
              const isActive = statusFilter === s;
              const label =
                s === 'all'
                  ? 'Tous'
                  : STATUS_LABELS[s];
              const count =
                s === 'all'
                  ? leads.length
                  : countsByStatus[s] ?? 0;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={[
                    'rounded-xl border px-4 py-2 text-sm font-medium transition',
                    isActive
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
                  ].join(' ')}
                >
                  {label}
                  <span className="ml-2 tabular-nums opacity-80">({count})</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6">
          <label
            htmlFor="leads-search"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
          >
            Recherche
          </label>
          <div className="relative mt-2 max-w-md">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              id="leads-search"
              type="text"
              placeholder="Nom, téléphone, ville, produit…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-10 text-sm"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700"
                aria-label="Effacer"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
            <p className="mt-2 text-xs text-red-800">
              Vérifiez que la migration{' '}
              <code className="rounded bg-red-100 px-1">20260520100000_order_leads_autosave.sql</code>{' '}
              est appliquée sur Supabase.
            </p>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-neutral-500">
              <Loader2 className="animate-spin" size={22} />
              Chargement…
            </div>
          ) : filteredLeads.length === 0 ? (
            <p className="py-16 text-center text-sm text-neutral-500">
              Aucun prospect pour ces filtres.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Produit</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Dernière sauvegarde</th>
                    <th className="px-4 py-3 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">
                          {lead.full_name || '—'}
                        </p>
                        <p className="text-neutral-600">{lead.phone || '—'}</p>
                        <p className="text-neutral-500">{lead.city || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{lead.product_name || '—'}</p>
                        <p className="text-neutral-500">
                          {lead.selected_size != null ? `Pointure ${lead.selected_size}` : '—'}
                          {lead.selected_color ? ` · ${lead.selected_color}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {lead.total != null
                          ? formatCurrencyAmount(Number(lead.total), {
                              maximumFractionDigits: 0,
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            STATUS_STYLES[lead.status],
                          ].join(' ')}
                        >
                          {STATUS_LABELS[lead.status]}
                        </span>
                        {lead.converted_order_id ? (
                          <p className="mt-1 text-xs text-neutral-500">
                            <Link
                              to="/admin/orders"
                              className="underline hover:text-neutral-800"
                            >
                              Voir commandes
                            </Link>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                        {formatLeadDate(lead.last_saved_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {lead.phone ? (
                            <button
                              type="button"
                              onClick={() =>
                                openWhatsAppQuickChat(
                                  lead.phone!,
                                  `Bonjour ${lead.full_name || ''}, vous avez commencé une commande sur Chiraz. Souhaitez-vous finaliser ?`,
                                )
                              }
                              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                            >
                              WhatsApp
                            </button>
                          ) : null}
                          {lead.status === 'draft' ? (
                            <button
                              type="button"
                              disabled={archivingId === lead.id}
                              onClick={() => void handleArchive(lead.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
                            >
                              {archivingId === lead.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Archive size={14} />
                              )}
                              Archiver
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
