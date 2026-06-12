import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

interface ProductStockEntry {
  variants: Variant[];
  isLoading: boolean;
  refCount: number;
}

const entries = new Map<string, ProductStockEntry>();
const listeners = new Set<() => void>();
const channels = new Map<string, ReturnType<typeof supabase.channel>>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getEntry(productId: string): ProductStockEntry {
  if (!entries.has(productId)) {
    entries.set(productId, { variants: [], isLoading: true, refCount: 0 });
  }
  return entries.get(productId)!;
}

async function loadVariants(productId: string) {
  const entry = getEntry(productId);
  if (!entry.isLoading && entry.variants.length > 0) return;

  entry.isLoading = true;
  emit();

  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .eq('product_id', productId);

  if (!error && data) {
    entry.variants = data as Variant[];
  } else if (error) {
    console.error('Erreur récupération stock Supabase:', error);
  }

  entry.isLoading = false;
  emit();
}

function ensureRealtime(productId: string) {
  if (channels.has(productId)) return;

  const channel = supabase
    .channel(`stock:${productId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'variants',
        filter: `product_id=eq.${productId}`,
      },
      (payload) => {
        const entry = getEntry(productId);
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const newVariant = payload.new as Variant;
          const exists = entry.variants.find((v) => v.id === newVariant.id);
          entry.variants = exists
            ? entry.variants.map((v) => (v.id === newVariant.id ? newVariant : v))
            : [...entry.variants, newVariant];
        } else if (payload.eventType === 'DELETE') {
          const oldVariant = payload.old as { id: string };
          entry.variants = entry.variants.filter((v) => v.id !== oldVariant.id);
        }
        emit();
      },
    )
    .subscribe();

  channels.set(productId, channel);
}

function releaseRealtime(productId: string) {
  const channel = channels.get(productId);
  if (channel) {
    void supabase.removeChannel(channel);
    channels.delete(productId);
  }
}

function acquire(productId: string) {
  const entry = getEntry(productId);
  entry.refCount += 1;
  void loadVariants(productId);
  ensureRealtime(productId);
}

function release(productId: string) {
  const entry = entries.get(productId);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entries.delete(productId);
    releaseRealtime(productId);
  }
}

function useStockSnapshot(productId: string) {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!productId) return { variants: [] as Variant[], isLoading: false };
      const entry = entries.get(productId);
      return {
        variants: entry?.variants ?? [],
        isLoading: entry?.isLoading ?? true,
      };
    },
    () => ({ variants: [] as Variant[], isLoading: false }),
  );
}

export function useProductStock(productId: string) {
  useEffect(() => {
    if (!productId) return;
    acquire(productId);
    return () => release(productId);
  }, [productId]);

  const { variants, isLoading } = useStockSnapshot(productId);

  const isOutOfStock = useCallback(
    (size: number, color?: string) => {
      if (variants.length === 0) return false;
      const variant = variants.find(
        (v) => v.size === size && (!color || v.color === color),
      );
      return !variant || variant.stock <= 0;
    },
    [variants],
  );

  return { variants, isLoading, isOutOfStock };
}

export type IsOutOfStockFn = (size: number, color?: string) => boolean;
