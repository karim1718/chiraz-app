import type { Order } from '../types/order';
import { formatCurrencyAmount } from '../lib/vocab';

/**
 * Numéro WhatsApp de la boutique Chiraz.
 * Configuré via la variable d'environnement VITE_SHOP_WHATSAPP.
 */
const SHOP_WHATSAPP = import.meta.env.VITE_SHOP_WHATSAPP || '';

/**
 * Formate un numéro de téléphone algérien pour l'API WhatsApp.
 * Convertit les formats locaux en format international sans le "+".
 * 
 * Exemples :
 *   "05 55 12 34 56" → "213555123456"
 *   "+213 555 123 456" → "213555123456"
 *   "0555123456" → "213555123456"
 */
export function formatWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  // Supprimer tous les espaces, tirets, points
  const cleaned = phone.replace(/[\s\-\.()]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned.substring(1);
  }
  if (cleaned.startsWith('00')) {
    return cleaned.substring(2);
  }
  if (cleaned.startsWith('0')) {
    return '213' + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Génère le résumé des articles d'une commande pour le message WhatsApp.
 */
function buildItemsSummary(order: Order): string {
  if (!order.order_items || order.order_items.length === 0) {
    return '';
  }

  const lines = order.order_items.map(item => {
    const productName = item.variants?.products?.name || 'Produit';
    const size = item.variants?.size || '—';
    const color = item.variants?.color || '—';
    const qty = item.quantity;
    return `👟 ${productName} | Pointure ${size} | ${color} | x${qty}`;
  });

  return lines.join('\n');
}

/**
 * Ouvre WhatsApp avec un message pré-rempli selon le statut de la commande.
 * 
 * @param order   - La commande complète (avec order_items)
 * @param status  - Le nouveau statut appliqué
 * @param extra   - Données supplémentaires (numéro de suivi, etc.)
 */
export function openWhatsApp(
  order: Order,
  status: string,
  extra?: { tracking?: string }
): void {
  const phone = formatWhatsAppNumber(order.phone);
  if (!phone) {
    console.warn("Impossible d'ouvrir WhatsApp : numéro de téléphone invalide.");
    return;
  }

  const name = order.customer_name || 'Client';
  const separator = '━━━━━━━━━━━━━━━';
  let message = '';

  switch (status) {
    case 'confirmé': {
      const items = buildItemsSummary(order);
      const deliveryLabel = order.delivery_type || 'Domicile';
      message = [
        `✅ Bonjour ${name} !`,
        `Votre commande Chiraz est bien confirmée 🎉`,
        separator,
        items,
        separator,
        `💰 Total : ${formatCurrencyAmount(Number(order.total), { maximumFractionDigits: 0 })}`,
        `🚚 Livraison : ${deliveryLabel}`,
        `Délai : 3 à 5 jours ouvrés.`,
        ``,
        `Merci pour votre confiance ! 🙏`,
      ].filter(Boolean).join('\n');
      break;
    }

    case 'expédié': {
      const trackingNum = extra?.tracking || order.tracking_number;
      const trackingLine = trackingNum
        ? `🔍 Suivi : ${trackingNum}`
        : `Livraison prévue dans 1 à 2 jours.`;

      message = [
        `📦 Bonjour ${name},`,
        `Votre commande Chiraz est en route !`,
        ``,
        trackingLine,
        ``,
        `Chiraz Chaussures 👟`,
      ].join('\n');
      break;
    }

    case 'annulé': {
      const cancelReason = order.cancel_reason || 'Non précisé';
      message = [
        `Bonjour ${name},`,
        `Votre commande Chiraz a été annulée.`,
        `Motif : ${cancelReason}`,
        ``,
        `N'hésitez pas à repasser commande sur notre site.`,
      ].join('\n');
      break;
    }

    case 'refusé': {
      const refusalReason = order.refusal_reason || 'Non précisé';
      message = [
        `Bonjour ${name},`,
        `Nous n'avons pas pu traiter votre commande.`,
        `Motif : ${refusalReason}`,
        ``,
        `Contactez-nous pour plus d'informations.`,
      ].join('\n');
      break;
    }

    default:
      console.warn(`Aucun template WhatsApp pour le statut "${status}".`);
      return;
  }

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

/** Ouvre WhatsApp client avec un message libre (action rapide admin). */
export function openWhatsAppQuickChat(phone: string, message: string): void {
  const n = formatWhatsAppNumber(phone);
  if (!n) {
    console.warn("Impossible d'ouvrir WhatsApp : numéro invalide.");
    return;
  }
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`, '_blank');
}

/**
 * Notifie le numéro de la boutique (admin) d'une nouvelle commande passée
 * depuis le site client. Utile pour déclencher un traitement immédiat.
 * 
 * @param order - La commande qui vient d'être créée
 */
export function openWhatsAppBoutique(order: Order): void {
  const shopPhone = formatWhatsAppNumber(SHOP_WHATSAPP);
  if (!shopPhone) {
    console.warn(
      "Impossible de notifier la boutique : VITE_SHOP_WHATSAPP non configuré."
    );
    return;
  }

  const name = order.customer_name || 'Client';
  const items = buildItemsSummary(order);
  const separator = '━━━━━━━━━━━━━━━';

  const message = [
    `🛒 Nouvelle commande sur le site !`,
    ``,
    `👤 Client : ${name}`,
    `📱 Tél : ${order.phone}`,
    `📍 Ville : ${order.wilaya || order.city || '—'}`,
    separator,
    items,
    separator,
    `💰 Total : ${formatCurrencyAmount(Number(order.total), { maximumFractionDigits: 0 })}`,
    ``,
    `→ Connectez-vous au panel admin pour traiter cette commande.`,
  ].filter(Boolean).join('\n');

  const url = `https://wa.me/${shopPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
