import type { Product } from '../types/product';
import { getHexForColor } from './colorMap';

/** Normalise une couleur hex pour CSS (#RRGGBB). */
export function normalizeHex(hex: string | undefined | null): string {
  if (!hex || typeof hex !== 'string') return '#888888';
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) return h.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
    const r = h[1];
    const g = h[2];
    const b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return '#888888';
}

/** Normalise les clés couleur (trim) pour lecture DB / JSONB. */
export function normalizeProductColorMedia(
  raw: Record<string, unknown> | undefined | null
): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim();
    if (!key) continue;
    out[key] = Array.isArray(v) ? v.filter(Boolean).map(String) : [];
  }
  return out;
}

/** Libellé couleur pour comparaison (trim + espaces internes). */
export function normalizeColorLabelKey(label: string | undefined | null): string {
  if (!label || typeof label !== 'string') return '';
  return label.trim().replace(/\s+/g, ' ');
}

/** True si au moins une entrée color_media / imagesByColor contient des URLs. */
export function productHasPerColorGalleries(product: Product): boolean {
  const merged = mergeColorMediaMaps(product);
  return Object.values(merged).some((urls) => urls.length > 0);
}

function mergeColorMediaMaps(product: Product): Record<string, string[]> {
  return normalizeProductColorMedia({
    ...(product.imagesByColor as Record<string, unknown> | undefined),
    ...(product.color_media as Record<string, unknown> | undefined),
  });
}

/**
 * Résout les URLs pour un libellé : clé exacte puis équivalence (casse / accents / espaces).
 */
export function findUrlsForColorInMediaMap(
  media: Record<string, string[]>,
  colorLabel: string
): string[] {
  const target = normalizeColorLabelKey(colorLabel);
  if (!target) return [];

  if (media[target]?.length) return [...media[target]];

  for (const [storedKey, urls] of Object.entries(media)) {
    if (!urls?.length) continue;
    const sk = normalizeColorLabelKey(storedKey);
    if (sk === target) return [...urls];
  }

  for (const [storedKey, urls] of Object.entries(media)) {
    if (!urls?.length) continue;
    const sk = normalizeColorLabelKey(storedKey);
    if (sk.localeCompare(target, 'fr', { sensitivity: 'base' }) === 0) return [...urls];
  }

  return [];
}

/**
 * URLs pour une couleur : uniquement la galerie liée à ce libellé.
 * Fallback sur products.images seulement si aucune galerie par couleur n’existe (produits legacy).
 */
export function getImagesForColor(
  product: Product,
  colorLabel: string | undefined | null
): string[] {
  const key = normalizeColorLabelKey(colorLabel);
  const legacy = product.images?.length ? product.images : [];

  if (!key) return [...legacy];

  const media = mergeColorMediaMaps(product);
  const urls = findUrlsForColorInMediaMap(media, key);
  if (urls.length > 0) return urls;

  if (!productHasPerColorGalleries(product)) return [...legacy];

  return [];
}

/** Première image affichable pour une couleur (carte catalogue, stock admin). */
export function getPrimaryImageForColor(
  product: Product,
  colorLabel: string | undefined | null
): string | undefined {
  const imgs = getImagesForColor(product, colorLabel);
  return imgs[0];
}

/** Hex depuis variantes (hexByColor) puis colorMap statique. */
export function getHexForProductColor(
  product: Product,
  colorLabel: string | undefined | null
): string {
  const key = colorLabel?.trim();
  if (!key) return '#888888';

  const fromDb = product.hexByColor?.[key];
  if (fromDb) return normalizeHex(fromDb);

  return getHexForColor(key);
}

/** Hex pour les filtres catalogue : premier produit qui définit cette couleur. */
export function getCatalogHexForColorLabel(
  products: Product[],
  label: string
): string {
  const key = label.trim().replace(/\s+/g, ' ');
  for (const p of products) {
    const map = p.hexByColor;
    if (!map) continue;
    const h = map[key] ?? map[label.trim()];
    if (h) return normalizeHex(h);
    const found = Object.keys(map).find(
      (k) => k.trim().replace(/\s+/g, ' ').toLowerCase() === key.toLowerCase(),
    );
    if (found && map[found]) return normalizeHex(map[found]);
  }
  return getHexForColor(key);
}

/** Pastilles très claires : anneau visible sur fond sombre. */
export function isVeryLightHex(hex: string): boolean {
  const n = normalizeHex(hex).slice(1);
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.82;
}

/**
 * Tableau `products.images` pour rétrocompatibilité : première couleur avec photos,
 * sinon fusion des URLs, sinon fallback.
 */
export function deriveLegacyProductImages(
  cm: Record<string, string[]>,
  orderedColorLabels: string[],
  fallback: string[]
): string[] {
  for (const c of orderedColorLabels) {
    const urls = cm[c];
    if (urls && urls.length > 0) return [...urls];
  }
  const merged = Object.values(cm)
    .flat()
    .filter((u): u is string => Boolean(u));
  if (merged.length > 0) return [...new Set(merged)];
  return fallback.slice();
}

/**
 * Objet Product minimal depuis une jointure admin (variants → products)
 * pour `getPrimaryImageForColor` / `getImagesForColor`.
 */
export function adminJoinProductStub(productsRow: {
  id: string;
  name?: string | null;
  price?: number | null;
  images?: string[] | null;
  color_media?: Record<string, unknown> | null;
}): Product {
  const cm = normalizeProductColorMedia(productsRow.color_media ?? undefined);
  return {
    id: productsRow.id,
    name: productsRow.name || '',
    price: Number(productsRow.price ?? 0),
    category: '',
    images: productsRow.images || [],
    colors: [],
    sizes: [],
    material: '',
    color_media: cm,
    imagesByColor: { ...cm },
  };
}
