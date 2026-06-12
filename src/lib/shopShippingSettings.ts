import { supabase } from './supabase';

export type ShopShippingSettings = {
  shipping_enabled: boolean;
  default_shipping_fee: number;
};

const DEFAULTS: ShopShippingSettings = {
  shipping_enabled: true,
  default_shipping_fee: 0,
};

let cached: ShopShippingSettings | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
let inflight: Promise<ShopShippingSettings> | null = null;

export async function fetchShopShippingSettings(
  force = false,
): Promise<ShopShippingSettings> {
  const now = Date.now();
  if (!force && cached && now < cacheExpiry) {
    return cached;
  }

  if (!force && inflight) {
    return inflight;
  }

  inflight = (async () => {
    const { data, error } = await supabase
      .from('shop_shipping_settings')
      .select('shipping_enabled, default_shipping_fee')
      .eq('id', 1)
      .maybeSingle();

    const result: ShopShippingSettings =
      error || !data
        ? { ...DEFAULTS }
        : {
            shipping_enabled: data.shipping_enabled !== false,
            default_shipping_fee: Math.max(0, Number(data.default_shipping_fee ?? 0)),
          };

    cached = result;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    inflight = null;
    return result;
  })();

  return inflight;
}

export function invalidateShopShippingCache() {
  cached = null;
  cacheExpiry = 0;
}
