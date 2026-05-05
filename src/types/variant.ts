export interface Variant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  color_hex?: string;
  stock: number;
  low_stock_alert?: number;
  price?: number;
  original_price?: number;
  created_at?: string;
}
