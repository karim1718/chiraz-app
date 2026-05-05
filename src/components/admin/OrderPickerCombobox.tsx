import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { formatCurrencyAmount as fmt } from '../../lib/vocab';
import type { PaymentStatus } from '../../types/order';
import { PAYMENT_STATUS_LABEL_SHORT, PAYMENT_STATUS_TOKEN } from '../../utils/paymentVocab';
import { SEMANTIC_TOKEN } from '../../utils/statusTokens';

export type OrderPickerOrder = {
  id: string;
  order_number: string | null;
  total: number;
  payment_status: PaymentStatus;
  /** Affiché pour les commandes « autre client » (ex. e‑commerce). */
  customer_name?: string | null;
  /** Statut logistique commande (ex. livré) — badge dans la liste. */
  status?: string | null;
  /** web / online → badge « Site web » pour les commandes e‑commerce. */
  source?: string | null;
};

export type OrderPickerGroup = { label: string; orders: OrderPickerOrder[] };

function paymentStatusDot(ps: PaymentStatus): string {
  const key = PAYMENT_STATUS_TOKEN[ps] ?? 'neutral';
  return SEMANTIC_TOKEN[key].dot;
}

function statusLine(o: OrderPickerOrder, paidSoFar: number): string {
  const total = Number(o.total || 0);
  const rem = Math.max(0, total - paidSoFar);
  if (rem > 0.01) {
    if (o.payment_status === 'partiellement_paye') {
      return `${PAYMENT_STATUS_LABEL_SHORT.partiellement_paye} — ${fmt(rem)} restants`;
    }
    return `${PAYMENT_STATUS_LABEL_SHORT[o.payment_status] ?? 'Reste'} — ${fmt(rem)} restants`;
  }
  return PAYMENT_STATUS_LABEL_SHORT[o.payment_status] ?? String(o.payment_status);
}

function LivreBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
      Livré
    </span>
  );
}

function isDeliveredBadgeStatus(s: string | null | undefined) {
  return s === 'livré' || s === 'livre';
}

function isWebOrderSource(source: string | null | undefined) {
  const s = (source || '').toLowerCase();
  return s === 'web' || s === 'online';
}

function WebSourceBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
      Site web
    </span>
  );
}

type Props = {
  value: string;
  onChange: (orderId: string) => void;
  groups: OrderPickerGroup[];
  paidByOrderId: Record<string, number>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Client web : libellé réduit (nom + n° commande seulement). */
  compact?: boolean;
  /**
   * Si `value` est défini mais absent des `groups` (ex. commande soldée retirée du picker),
   * afficher ce libellé au lieu du placeholder.
   */
  valueNotInListLabel?: string;
  /** Pré-sélection depuis un lien (anneau + pastille Auto). */
  prefilled?: boolean;
};

export function OrderPickerCombobox({
  value,
  onChange,
  groups,
  paidByOrderId,
  disabled,
  placeholder = '— Choisir une commande —',
  className = '',
  compact = false,
  valueNotInListLabel,
  prefilled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const flat = useMemo(() => {
    const out: { group: string; o: OrderPickerOrder }[] = [];
    for (const g of groups) {
      for (const o of g.orders) {
        out.push({ group: g.label, o });
      }
    }
    return out;
  }, [groups]);

  const selected = useMemo(() => flat.find((x) => x.o.id === value)?.o ?? null, [flat, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id="enc-order"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={[
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 text-left text-sm text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:cursor-not-allowed disabled:opacity-50',
          prefilled ? 'ring-2 ring-emerald-300/70 ring-offset-1' : '',
        ].join(' ')}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? (
            compact ? (
              <span className="truncate font-medium">
                {selected.customer_name ? `${selected.customer_name} · ` : ''}
                {selected.order_number || `#${selected.id.slice(0, 8)}`}
              </span>
            ) : (
              <span className="inline-flex min-w-0 items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${paymentStatusDot(selected.payment_status)}`}
                  aria-hidden
                />
                <span className="truncate">
                  {isWebOrderSource(selected.source) ? (
                    <span className="mr-1 inline-flex align-middle">
                      <WebSourceBadge />
                    </span>
                  ) : null}
                  {isDeliveredBadgeStatus(selected.status) ? (
                    <span className="mr-1 inline-flex align-middle">
                      <LivreBadge />
                    </span>
                  ) : null}
                  {selected.customer_name ? `${selected.customer_name} · ` : ''}
                  {selected.order_number || `#${selected.id.slice(0, 8)}`} · {fmt(Number(selected.total))} ·{' '}
                  {statusLine(selected, paidByOrderId[selected.id] ?? 0)}
                </span>
              </span>
            )
          ) : value && valueNotInListLabel ? (
            <span className="truncate font-medium text-neutral-900">{valueNotInListLabel}</span>
          ) : (
            <span className="text-neutral-400">{placeholder}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {prefilled ? (
            <span
              title="Pré-rempli depuis le lien"
              className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800"
            >
              <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
              Auto
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`}
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-500 hover:bg-neutral-50"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            {placeholder}
          </button>
          {groups.map((g) =>
            g.orders.length ? (
              <div key={g.label} role="group" aria-label={g.label} className="pt-1">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{g.label}</div>
                <div className="space-y-0.5">
                  {g.orders.map((o) => {
                    const paid = paidByOrderId[o.id] ?? 0;
                    const active = value === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={[
                          'flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition',
                          active ? 'bg-neutral-900/[0.06] font-medium text-neutral-950' : 'text-neutral-800 hover:bg-neutral-50',
                        ].join(' ')}
                        onClick={() => {
                          onChange(o.id);
                          setOpen(false);
                        }}
                      >
                        {compact ? (
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {o.customer_name ? `${o.customer_name} · ` : ''}
                            {o.order_number || `#${o.id.slice(0, 8)}`}
                          </span>
                        ) : (
                          <>
                            <span
                              className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${paymentStatusDot(o.payment_status)}`}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 leading-snug">
                              {o.customer_name ? (
                                <span className="mb-0.5 block text-xs font-medium text-neutral-600">{o.customer_name}</span>
                              ) : null}
                              <span className="flex flex-wrap items-center gap-1.5 font-semibold text-neutral-950">
                                {isWebOrderSource(o.source) ? <WebSourceBadge /> : null}
                                {isDeliveredBadgeStatus(o.status) ? <LivreBadge /> : null}
                                <span>{o.order_number || `#${o.id.slice(0, 8)}`}</span>
                              </span>
                              <span className="mt-0.5 block text-xs text-neutral-500">
                                {fmt(Number(o.total))} · {statusLine(o, paid)}
                              </span>
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}
