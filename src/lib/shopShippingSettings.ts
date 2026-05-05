import { supabase } from './supabase';

export type ShopShippingSettings = {
  shipping_enabled: boolean;
  default_shipping_fee: number;
};

const DEFAULTS: ShopShippingSettings = {
  shipping_enabled: true,
  default_shipping_fee: 0,
};

export async function fetchShopShippingSettings(): Promise<ShopShippingSettings> {
  const { data, error } = await supabase
    .from('shop_shipping_settings')
    .select('shipping_enabled, default_shipping_fee')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULTS };
  }

  return {
    shipping_enabled: data.shipping_enabled !== false,
    default_shipping_fee: Math.max(0, Number(data.default_shipping_fee ?? 0)),
  };
}
