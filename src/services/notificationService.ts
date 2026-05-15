import type { Order } from '../types/order';
import { formatCurrencyAmount } from '../lib/vocab';
import {
  formatWhatsAppDigits,
  getShopWhatsAppDigits,
  shopWhatsAppUrl,
} from '../lib/shopContact';

/** @deprecated Utiliser formatWhatsAppDigits depuis shopContact */
export function formatWhatsAppNumber(phone: string): string {
  return formatWhatsAppDigits(phone);
}

function buildItemsSummary(order: Order): string {
  if (!order.order_items || order.order_items.length === 0) {
    return '';
  }

  return order.order_items
    .map((item) => {
      const productName = item.variants?.products?.name || 'Produit';
      const size = item.variants?.size ?? '—';
      const color = item.variants?.color ?? '—';
      const qty = item.quantity;
      return `• ${productName} — Pointure ${size} — ${color} — Qté ${qty}`;
    })
    .join('\n');
}

function buildOrderConfirmedMessage(order: Order): string {
  const name = order.customer_name || 'Client';
  const items = buildItemsSummary(order);
  const deliveryLabel = order.delivery_type || 'Domicile';
  const total = formatCurrencyAmount(Number(order.total), { maximumFractionDigits: 0 });

  const lines = [
    `Bonjour ${name},`,
    '',
    'Votre commande Chiraz est confirmée.',
    '',
    'Détail :',
    items || '• (détail non disponible)',
    '',
    `Total : ${total}`,
    `Livraison : ${deliveryLabel}`,
    'Délai estimé : 3 à 5 jours ouvrés.',
    '',
    'Merci pour votre confiance.',
    'Chiraz Chaussures',
  ];

  return lines.join('\n');
}

function buildShippedMessage(
  order: Order,
  extra?: { tracking?: string },
): string {
  const name = order.customer_name || 'Client';
  const trackingNum = extra?.tracking || order.tracking_number;
  const trackingLine = trackingNum
    ? `Numéro de suivi : ${trackingNum}`
    : 'Livraison prévue sous 1 à 2 jours.';

  return [
    `Bonjour ${name},`,
    '',
    'Votre commande Chiraz a été expédiée.',
    '',
    trackingLine,
    '',
    'Chiraz Chaussures',
  ].join('\n');
}

function buildCancelledMessage(order: Order): string {
  const name = order.customer_name || 'Client';
  const cancelReason = order.cancel_reason || 'Non précisé';

  return [
    `Bonjour ${name},`,
    '',
    'Votre commande Chiraz a été annulée.',
    `Motif : ${cancelReason}`,
    '',
    'N\'hésitez pas à repasser commande sur notre site.',
    '',
    'Chiraz Chaussures',
  ].join('\n');
}

function buildRefusedMessage(order: Order): string {
  const name = order.customer_name || 'Client';
  const refusalReason = order.refusal_reason || 'Non précisé';

  return [
    `Bonjour ${name},`,
    '',
    'Nous n\'avons pas pu traiter votre commande.',
    `Motif : ${refusalReason}`,
    '',
    'Contactez-nous pour plus d\'informations.',
    '',
    'Chiraz Chaussures',
  ].join('\n');
}

function buildNewOrderBoutiqueMessage(order: Order): string {
  const name = order.customer_name || 'Client';
  const items = buildItemsSummary(order);
  const total = formatCurrencyAmount(Number(order.total), { maximumFractionDigits: 0 });

  return [
    'Nouvelle commande sur le site Chiraz',
    '',
    `Client : ${name}`,
    `Téléphone : ${order.phone}`,
    `Ville : ${order.wilaya || order.city || '—'}`,
    '',
    'Articles :',
    items || '• (détail non disponible)',
    '',
    `Total : ${total}`,
    '',
    'Connectez-vous au panel admin pour traiter cette commande.',
  ].join('\n');
}

/**
 * Ouvre WhatsApp avec un message pré-rempli selon le statut de la commande.
 */
export function openWhatsApp(
  order: Order,
  status: string,
  extra?: { tracking?: string },
): void {
  const phone = formatWhatsAppDigits(order.phone);
  if (!phone) {
    console.warn("Impossible d'ouvrir WhatsApp : numéro de téléphone invalide.");
    return;
  }

  let message = '';

  switch (status) {
    case 'confirmé':
      message = buildOrderConfirmedMessage(order);
      break;
    case 'expédié':
      message = buildShippedMessage(order, extra);
      break;
    case 'annulé':
      message = buildCancelledMessage(order);
      break;
    case 'refusé':
      message = buildRefusedMessage(order);
      break;
    default:
      console.warn(`Aucun template WhatsApp pour le statut "${status}".`);
      return;
  }

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

/** Ouvre WhatsApp client avec un message libre (action rapide admin). */
export function openWhatsAppQuickChat(phone: string, message: string): void {
  const n = formatWhatsAppDigits(phone);
  if (!n) {
    console.warn("Impossible d'ouvrir WhatsApp : numéro invalide.");
    return;
  }
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`, '_blank');
}

/**
 * Notifie le numéro de la boutique (admin) d'une nouvelle commande passée depuis le site.
 */
export function openWhatsAppBoutique(order: Order): void {
  const shopPhone = getShopWhatsAppDigits();
  if (!shopPhone) {
    console.warn(
      "Impossible de notifier la boutique : numéro WhatsApp non configuré.",
    );
    return;
  }

  const message = buildNewOrderBoutiqueMessage(order);
  window.open(shopWhatsAppUrl(message), '_blank');
}
