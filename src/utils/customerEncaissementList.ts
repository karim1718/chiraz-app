/**
 * Indique si une ligne `orders_outstanding` correspond encore à un encaissement à traiter.
 * Aligné sur la logique Encaissements (reliquat + statuts paiement ouverts).
 */
export function ordersOutstandingRowIsPending(row: {
  outstanding: unknown;
  payment_status: string;
}): boolean {
  const rem = Number(row.outstanding ?? 0);
  if (rem > 0.01) return true;
  return (
    row.payment_status === 'non_paye' ||
    row.payment_status === 'partiellement_paye' ||
    row.payment_status === 'en_retard' ||
    row.payment_status === 'en_attente_encaissement'
  );
}

export type CustomerEncaissementListStatus = 'pending' | 'settled' | 'none';
