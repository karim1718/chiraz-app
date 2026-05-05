import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Variant {
  id: string;
  product_id: string;
  size: number;
  color: string;
  color_hex?: string;
  stock: number;
  price?: number;
  original_price?: number;
}

export function useProductStock(productId: string) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
       setIsLoading(false);
       return;
    }

    const fetchStock = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('variants')
        .select('*')
        .eq('product_id', productId);
      
      if (!error && data) {
        setVariants(data as Variant[]);
      } else {
        console.error('Erreur récupération stock Supabase:', error);
      }
      setIsLoading(false);
    };

    fetchStock();

    // Abonnement Temps Réel (Supabase Realtime)
    const channelId = `public:variants:${productId}:${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'variants',
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newVariant = payload.new as Variant;
            setVariants((prev) => {
              const exists = prev.find(v => v.id === newVariant.id);
              if (exists) {
                return prev.map(v => v.id === newVariant.id ? newVariant : v);
              }
              return [...prev, newVariant];
            });
          } else if (payload.eventType === 'DELETE') {
             const oldVariant = payload.old as { id: string };
             setVariants((prev) => prev.filter(v => v.id !== oldVariant.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  const isOutOfStock = useCallback((size: number, color?: string) => {
    // Sécurité: Si la BDD est encore vide/non migrée, tout est en stock par défaut pour la démo
    if (variants.length === 0) return false;
    
    // Recherche de la variante spécifique
    const variant = variants.find(
      (v) => v.size === size && (!color || v.color === color)
    );
    
    // Épuisé si la variante n'existe pas ou que le stock est <= 0
    return !variant || variant.stock <= 0;
  }, [variants]);

  return { variants, isLoading, isOutOfStock };
}
