/** Shared display vocabulary — currency and helpers. */

import i18n from '../i18n';

export const CURRENCY = {
  code: 'TND',
  symbol: 'TND',
  short: 'TND',
  long: 'Dinar tunisien',
} as const;

function localeForAmounts(): string {
  const lng = i18n.language?.split('-')[0] || 'fr';
  if (lng === 'ar') return 'ar-TN';
  if (lng === 'en') return 'en-US';
  return 'fr-TN';
}

/**
 * Formatted amount with space before currency code (e.g. "1 200,50 TND").
 * Use {@link CURRENCY.code} when you need the unit alone (labels, templates).
 */
export function formatCurrencyAmount(
  value: number,
  options?: { maximumFractionDigits?: number },
): string {
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const locale = localeForAmounts();
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits }).format(Number(value || 0))} ${CURRENCY.code}`;
}
