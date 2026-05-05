export interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  colors: string[];
  /** Couleurs ayant au moins une variante en stock (> 0) — filtres catalogue / disponibilité. */
  colorsAvailable?: string[];
  sizes: number[];
  category: string;
  material: string;
  badge?: string;
  /** Discount in percentage calculated globally from variants or original_price */
  salePercent?: number;
  minPrice?: number;
  maxSalePercent?: number;

  // Nouveaux champs ajoutés
  description?: string;
  original_price?: number;
  gender?: string;
  is_active?: boolean;
  is_featured?: boolean;
  created_at?: string;
  updated_at?: string;

  /** URLs par libellé de couleur (aligné sur variants.color), depuis Supabase JSONB */
  color_media?: Record<string, string[]>;
  /** Copie normalisée (clés trim) pour la vitrine ; dérivée du store */
  imagesByColor?: Record<string, string[]>;
  /** color_hex représentatif par libellé de couleur (depuis variantes) */
  hexByColor?: Record<string, string>;
}
