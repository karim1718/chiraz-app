import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Loader2, ArrowDownCircle, ArrowUpCircle, ShoppingBag, Info } from 'lucide-react';

function parseReason(reason: string | null | undefined): { main: string; detail: string | null } {
  const raw = (reason ?? '').trim();
  if (!raw) return { main: 'Mouvement enregistré', detail: null };
  const sep = ' : ';
  const i = raw.indexOf(sep);
  if (i === -1) return { main: raw, detail: null };
  const main = raw.slice(0, i).trim();
  const detail = raw.slice(i + sep.length).trim();
  if (!detail) return { main: main || raw, detail: null };
  return { main: main || 'Motif', detail };
}

function movementLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: any;
}

export default function StockHistoryModal({ isOpen, onClose, variant }: StockHistoryModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && variant) {
      fetchHistory();
    }
  }, [isOpen, variant]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          id, type, quantity, reason, created_at, order_id,
          orders ( order_number, status )
        `)
        .eq('variant_id', variant.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setHistory(data || []);
    } catch (err: any) {
      console.error("Erreur chargement historique:", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !variant) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-h-[85vh]">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-neutral-900 p-5 text-white">
          <div>
            <h2 className="font-serif text-xl">Historique des mouvements</h2>
            <p className="text-sm text-neutral-400 mt-0.5">
              {variant.products?.name} - {variant.size} ({variant.color})
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body - Timeline */}
        <div className="flex-1 overflow-y-auto bg-neutral-50 p-6">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 size={24} className="animate-spin text-neutral-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10">
              <Info size={40} className="mx-auto text-neutral-300 mb-3" />
              <p className="text-neutral-500">Aucun mouvement enregistré pour ce variant.</p>
            </div>
          ) : (
            <ul className="m-0 list-none space-y-0 p-0">
              {history.map((mov, index) => {
                const dateObj = new Date(mov.created_at);
                const dateStr = dateObj.toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });
                const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const { main: reasonMain, detail: reasonDetail } = parseReason(mov.reason);

                let isPositive = false;
                let Icon = Info;
                let iconColor = 'text-neutral-600 bg-neutral-100 ring-4 ring-neutral-50';

                if (
                  mov.type === 'entrée' ||
                  mov.type === 'annulation' ||
                  mov.type === 'retour' ||
                  mov.type === 'ajustement_positif'
                ) {
                  isPositive = true;
                  Icon = ArrowDownCircle;
                  iconColor = 'text-emerald-700 bg-emerald-50 ring-4 ring-neutral-50';
                } else if (mov.type === 'sortie' || mov.type === 'ajustement_négatif') {
                  isPositive = false;
                  Icon = ArrowUpCircle;
                  iconColor = 'text-orange-700 bg-orange-50 ring-4 ring-neutral-50';
                  if (mov.order_id) Icon = ShoppingBag;
                }

                const isLast = index === history.length - 1;

                return (
                  <li key={mov.id} className="flex gap-4">
                    {/* Rail : pastille + ligne (remplit l’espace gauche de façon équilibrée) */}
                    <div className="relative flex w-11 shrink-0 flex-col items-center">
                      <div
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm ${iconColor}`}
                        aria-hidden
                      >
                        <Icon size={18} strokeWidth={2} />
                      </div>
                      {!isLast ? (
                        <div
                          className="mt-2 w-px flex-1 min-h-[1.25rem] bg-neutral-200"
                          aria-hidden
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1 pb-8 last:pb-0">
                      <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                                  isPositive
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {movementLabel(mov.type)}
                              </span>
                              <time
                                dateTime={mov.created_at}
                                className="text-xs font-medium text-neutral-500 tabular-nums"
                              >
                                {dateStr} · {timeStr}
                              </time>
                            </div>

                            <div className="text-sm leading-snug text-neutral-800">
                              <p className="font-medium text-neutral-900">{reasonMain}</p>
                              {reasonDetail ? (
                                <p className="mt-1 border-l-2 border-neutral-200 pl-3 text-neutral-600">
                                  {reasonDetail}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div
                            className={`shrink-0 text-right sm:pt-0.5 ${isPositive ? 'text-emerald-700' : 'text-orange-700'}`}
                          >
                            <span className="text-2xl font-bold tabular-nums leading-none">
                              {isPositive ? '+' : '−'}
                              {mov.quantity}
                            </span>
                            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                              unités
                            </span>
                          </div>
                        </div>

                        {mov.order_id && mov.orders && (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                            <span className="text-xs text-neutral-500">
                              Commande{' '}
                              <span className="font-semibold text-neutral-800">
                                #{mov.orders.order_number || mov.order_id.slice(0, 8)}
                              </span>
                            </span>
                            <span className="text-xs font-medium text-neutral-800">
                              Liée à une commande
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-neutral-200 bg-white p-4 sm:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button 
            onClick={onClose}
            className="rounded-lg border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
