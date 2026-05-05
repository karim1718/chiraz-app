import { AlertTriangle, Check } from 'lucide-react';
import type { CustomerEncaissementListStatus } from '../../utils/customerEncaissementList';
import { ACCOUNT_LABEL } from '../../utils/paymentVocab';

type Props = {
  status: CustomerEncaissementListStatus;
  className?: string;
  /** Montant restant déjà formaté (nombre + code devise) — pending. // [updated:DA→TND] */
  pendingAmountLabel?: string | null;
};

/**
 * Pastille encaissement : pending = montant lisible + icône ; settled = libellé « À jour » + icône (pas seulement la couleur).
 */
export function CustomerEncaissementIndicator({
  status,
  className = '',
  pendingAmountLabel,
}: Props) {
  if (status === 'none') return null;

  if (status === 'pending') {
    const label = pendingAmountLabel?.trim();
    return (
      <span
        className={[
          'inline-flex max-w-[10rem] items-center gap-1 rounded-full border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-950',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        title={label ? `${ACCOUNT_LABEL.pending} · ${label}` : ACCOUNT_LABEL.pending}
        aria-label={label ? `${ACCOUNT_LABEL.pending}. ${label}` : ACCOUNT_LABEL.pending}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
        {label ? <span className="min-w-0 truncate">{label}</span> : null}
      </span>
    );
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={ACCOUNT_LABEL.settled}
      aria-label={`${ACCOUNT_LABEL.settled}. À jour`}
    >
      <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      <span>À jour</span>
    </span>
  );
}
