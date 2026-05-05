export interface StockMovement {
  id: string;
  variant_id: string;
  type: string;
  quantity: number;
  reason?: string;
  order_id?: string;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  old_status: string;
  new_status: string;
  reason?: string;
  changed_at: string;
}
