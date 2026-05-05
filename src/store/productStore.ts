import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Product } from '../types/product';
import { normalizeHex, normalizeProductColorMedia } from '../utils/productColorAssets';

interface ProductState {
  products: Product[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  fetchProducts: (force?: boolean) => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getProductsByCategory: (category: string) => Product[];
  getSimilarProducts: (excludeId: string, category: string, limit?: number) => Product[];
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  isLoading: false,
  isLoaded: false,
  error: null,

  fetchProducts: async (force = false) => {
    if (!force && (get().isLoaded || get().isLoading)) return;

    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          variants (
            size,
            color,
            color_hex,
            stock,
            price,
            original_price
          )
        `)
        // Keep backward compatibility: products with NULL is_active are treated as active.
        .or('is_active.is.null,is_active.eq.true');

      if (error) throw error;

      // Formatage intelligent pour correspondre à notre Front-end Typescript 
      // (Agrégation des tailles et couleurs)
      const formattedProducts: Product[] = (data || []).map((p: any) => {
        const variants = p.variants || [];
        const colorsSet = new Set<string>();
        const colorsAvailableSet = new Set<string>();
        const sizesSet = new Set<number>();
        
        let minPrice = p.price;
        let maxSalePercent = 0;

        const hexByColor: Record<string, string> = {};

        variants.forEach((v: any) => {
          if (v.color) {
            const label = v.color.trim();
            colorsSet.add(label);
            if (Number(v.stock) > 0) {
              colorsAvailableSet.add(label);
            }
          }
          if (v.size != null) sizesSet.add(v.size);

          const col = typeof v.color === 'string' ? v.color.trim() : '';
          if (col && v.color_hex && !hexByColor[col]) {
            hexByColor[col] = normalizeHex(v.color_hex);
          }
          
          // Calcul du prix minimum (À partir de)
          const variantPrice = v.price != null ? v.price : p.price;
          if (variantPrice < minPrice) {
            minPrice = variantPrice;
          }

          // Calcul du plus grand pourcentage de réduction
          if (v.original_price && v.original_price > variantPrice) {
            const percent = Math.round(((v.original_price - variantPrice) / v.original_price) * 100);
            if (percent > maxSalePercent) {
              maxSalePercent = percent;
            }
          }
        });

        // Calcul du pourcentage de réduction global si le produit lui-même a un original_price (compatibilité)
        if (p.original_price && p.original_price > p.price) {
           const percent = Math.round(((p.original_price - p.price) / p.original_price) * 100);
           if (percent > maxSalePercent) {
             maxSalePercent = percent;
           }
        }

        const colorMediaNorm = normalizeProductColorMedia(p.color_media as Record<string, unknown> | null);

        return {
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category,
          images: p.images || [],
          color_media: colorMediaNorm,
          imagesByColor: { ...colorMediaNorm },
          hexByColor,
          material: p.material || '',
          badge: p.badge || undefined,
          salePercent: maxSalePercent > 0 ? maxSalePercent : undefined,
          maxSalePercent: maxSalePercent > 0 ? maxSalePercent : undefined,
          minPrice: minPrice,
          colors: Array.from(colorsSet).sort((a, b) => a.localeCompare(b, 'fr')),
          colorsAvailable: Array.from(colorsAvailableSet).sort((a, b) =>
            a.localeCompare(b, 'fr'),
          ),
          sizes: Array.from(sizesSet).sort((a, b) => a - b),
        };
      });

      set({ products: formattedProducts, isLoaded: true, isLoading: false });
    } catch (err: any) {
      console.error("Erreur lors de la récupération des produits:", err);
      // Fallback gracieux en cas de vide absolu (pas grave pour le flow React)
      set({ error: err.message, isLoading: false, products: [] });
    }
  },

  getProductById: (id: string) => {
    return get().products.find(p => p.id === id);
  },

  getProductsByCategory: (category: string) => {
    return get().products.filter(p => p.category === category);
  },

  getSimilarProducts: (excludeId: string, category: string, limit = 4) => {
    return get().products.filter(p => p.id !== excludeId && p.category === category).slice(0, limit);
  }
}));
