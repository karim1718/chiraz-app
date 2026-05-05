import type { PaymentMethod, PaymentStatus } from '../types/order';
import type { SemanticStatus } from './statusTokens';

/**
 * Libellés longs : selects, modales, StatCards, tableaux détaillés.
 * Un concept = un libellé canonique.
 */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paye: 'Encaissée',
  partiellement_paye: 'Partiellement payé',
  non_paye: 'Non payé',
  en_attente_encaissement: "En attente d'encaissement",
  en_retard: 'En retard',
};

/**
 * Libellés courts : pills denses, ligne picker, résumés.
 * Variante du même concept que PAYMENT_STATUS_LABEL (documenté).
 */
export const PAYMENT_STATUS_LABEL_SHORT: Record<PaymentStatus, string> = {
  ...PAYMENT_STATUS_LABEL,
  partiellement_paye: 'Partiel',
  en_attente_encaissement: 'En attente',
};

/** Couleur sémantique par statut de paiement (aligné règle produit). */
export const PAYMENT_STATUS_TOKEN: Record<PaymentStatus, SemanticStatus> = {
  paye: 'success',
  partiellement_paye: 'warning',
  en_attente_encaissement: 'warning',
  non_paye: 'danger',
  en_retard: 'danger',
};

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Espèces' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'bank_transfer', label: 'Virement' },
  { value: 'bill_of_exchange', label: 'Effet / traite' },
  { value: 'mixed', label: 'Combinaison' },
  { value: 'deferred', label: 'Différé' },
];

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_OPTIONS.find((m) => m.value === method)?.label ?? String(method);
}

export function asPaymentStatus(raw: unknown): PaymentStatus {
  const k = String(raw || '') as PaymentStatus;
  return k in PAYMENT_STATUS_LABEL ? k : 'non_paye';
}

/** Vocabulaire compte / solde (cohérent avec listes clients + encaissements). */
export const ACCOUNT_LABEL = {
  /** Compte sans reliquat (synonyme affichage « tout encaissé » côté solde). */
  settled: 'Soldé',
  pending: "En attente d'encaissement",
  remainder: 'Reliquat',
  totalBilled: 'Total commandé',
  totalCollected: 'Total encaissé',
  balanceLeft: 'Solde restant',
  /** Résumé encaissements (grille synthèse). */
  amountDueShort: 'Total dû',
  amountPaidShort: 'Encaissé',
} as const;

export function accountSettlementToken(solde: number): SemanticStatus {
  return solde > 0.01 ? 'warning' : 'success';
}
