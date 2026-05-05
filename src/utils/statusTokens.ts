/**
 * Tokens sémantiques partagés (paiement / solde / états terminaux logistiques).
 * Même couleur = même réalité métier sur Commandes, Clients, Encaissements.
 */
export type SemanticStatus = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export type SemanticTokenSet = {
  pill: string;
  bar: string;
  dot: string;
  ringIndicator: string;
  text: string;
};

export const SEMANTIC_TOKEN: Record<SemanticStatus, SemanticTokenSet> = {
  success: {
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    bar: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
    ringIndicator:
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/90 bg-emerald-50 text-emerald-700 shadow-sm',
    text: 'text-emerald-700',
  },
  warning: {
    pill: 'border-amber-200 bg-amber-50 text-amber-950',
    bar: 'border-l-amber-500',
    dot: 'bg-amber-500',
    ringIndicator:
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-300/90 bg-amber-50 text-amber-700 shadow-sm',
    text: 'text-amber-700',
  },
  danger: {
    pill: 'border-red-200 bg-red-50 text-red-900',
    bar: 'border-l-red-500',
    dot: 'bg-red-500',
    ringIndicator:
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-300/90 bg-red-50 text-red-700 shadow-sm',
    text: 'text-red-700',
  },
  info: {
    pill: 'border-blue-200 bg-blue-50 text-blue-900',
    bar: 'border-l-blue-500',
    dot: 'bg-blue-500',
    ringIndicator:
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-300/90 bg-blue-50 text-blue-700 shadow-sm',
    text: 'text-blue-700',
  },
  neutral: {
    pill: 'border-neutral-200 bg-neutral-100 text-neutral-800',
    bar: 'border-l-neutral-400',
    dot: 'bg-neutral-400',
    ringIndicator:
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300/90 bg-neutral-50 text-neutral-700 shadow-sm',
    text: 'text-neutral-700',
  },
};
