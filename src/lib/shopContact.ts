/**
 * Numéro WhatsApp boutique Chiraz (Tunisie, 20 780 741).
 * Surcharge possible via VITE_SHOP_WHATSAPP (format 216XXXXXXXX, sans +).
 */
export const SHOP_WHATSAPP_E164 = '21620780741';

/**
 * Formate un numéro pour l'API wa.me (chiffres uniquement, sans +).
 * Ex. "05 55 12 34 56" → "213555123456" ; "20780741" / "21620780741" conservés.
 */
export function formatWhatsAppDigits(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-.()]/g, '');
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

/** Numéro boutique effectif (env ou défaut). */
export function getShopWhatsAppDigits(): string {
  const fromEnv = import.meta.env.VITE_SHOP_WHATSAPP?.trim();
  if (fromEnv) {
    const digits = formatWhatsAppDigits(fromEnv);
    return digits || SHOP_WHATSAPP_E164;
  }
  return SHOP_WHATSAPP_E164;
}

/** Lien wa.me vers la boutique, avec message optionnel. */
export function shopWhatsAppUrl(text?: string): string {
  const base = `https://wa.me/${getShopWhatsAppDigits()}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
