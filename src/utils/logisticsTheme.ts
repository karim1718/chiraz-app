import { SEMANTIC_TOKEN } from './statusTokens';

export type LogisticsResolved = { label: string; pill: string; bar: string; dot: string };

export const LOGISTICS_FALLBACK_LABEL = 'Autre';

const PIPELINE = {
  nouveau: {
    label: 'Nouveau',
    pill: 'border-blue-200 bg-blue-50 text-blue-900',
    bar: 'border-l-blue-500',
    dot: 'bg-blue-500',
  },
  confirmé: {
    label: 'Confirmé',
    pill: 'border-green-200 bg-green-50 text-green-900',
    bar: 'border-l-green-500',
    dot: 'bg-green-500',
  },
  en_preparation: {
    label: 'En préparation',
    pill: 'border-purple-200 bg-purple-50 text-purple-900',
    bar: 'border-l-purple-500',
    dot: 'bg-purple-500',
  },
  retourné: {
    label: 'Retourné',
    pill: 'border-sky-200 bg-sky-50 text-sky-900',
    bar: 'border-l-sky-500',
    dot: 'bg-sky-500',
  },
} as const;

const NEUTRAL_FALLBACK: LogisticsResolved = {
  label: LOGISTICS_FALLBACK_LABEL,
  pill: SEMANTIC_TOKEN.neutral.pill,
  bar: SEMANTIC_TOKEN.neutral.bar,
  dot: SEMANTIC_TOKEN.neutral.dot,
};

/**
 * États terminaux ancrés sur les tokens sémantiques ; étapes pipeline = accents dédiés.
 */
export function logisticsThemeFor(rawStatus: string): LogisticsResolved {
  const s = String(rawStatus || '')
    .trim()
    .toLowerCase();

  const map: Record<string, LogisticsResolved> = {
    nouveau: PIPELINE.nouveau,
    confirmé: PIPELINE.confirmé,
    confirme: PIPELINE.confirmé,
    en_preparation: PIPELINE.en_preparation,
    'en préparation': PIPELINE.en_preparation,
    retourné: PIPELINE.retourné,
    retourne: PIPELINE.retourné,
    expédié: {
      label: 'Expédié',
      pill: SEMANTIC_TOKEN.warning.pill,
      bar: SEMANTIC_TOKEN.warning.bar,
      dot: SEMANTIC_TOKEN.warning.dot,
    },
    expédie: {
      label: 'Expédié',
      pill: SEMANTIC_TOKEN.warning.pill,
      bar: SEMANTIC_TOKEN.warning.bar,
      dot: SEMANTIC_TOKEN.warning.dot,
    },
    livré: {
      label: 'Livré',
      pill: SEMANTIC_TOKEN.success.pill,
      bar: SEMANTIC_TOKEN.success.bar,
      dot: SEMANTIC_TOKEN.success.dot,
    },
    livre: {
      label: 'Livré',
      pill: SEMANTIC_TOKEN.success.pill,
      bar: SEMANTIC_TOKEN.success.bar,
      dot: SEMANTIC_TOKEN.success.dot,
    },
    annulé: {
      label: 'Annulé',
      pill: SEMANTIC_TOKEN.danger.pill,
      bar: SEMANTIC_TOKEN.danger.bar,
      dot: SEMANTIC_TOKEN.danger.dot,
    },
    annule: {
      label: 'Annulé',
      pill: SEMANTIC_TOKEN.danger.pill,
      bar: SEMANTIC_TOKEN.danger.bar,
      dot: SEMANTIC_TOKEN.danger.dot,
    },
    refusé: {
      label: 'Refusé',
      pill: SEMANTIC_TOKEN.neutral.pill,
      bar: 'border-l-neutral-600',
      dot: SEMANTIC_TOKEN.neutral.dot,
    },
    refuse: {
      label: 'Refusé',
      pill: SEMANTIC_TOKEN.neutral.pill,
      bar: 'border-l-neutral-600',
      dot: SEMANTIC_TOKEN.neutral.dot,
    },
  };

  return map[s] ?? NEUTRAL_FALLBACK;
}
