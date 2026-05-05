export type OrderStatus = 
  | 'nouveau'
  | 'confirmé'
  | 'en_preparation'
  | 'expédié'
  | 'livré'
  | 'annulé'
  | 'refusé'
  | 'retourné';

export type PaymentMethod =
  | 'cash'
  | 'cheque'
  | 'bank_transfer'
  | 'bill_of_exchange'
  | 'mixed'
  | 'deferred';

export type PaymentStatus =
  | 'non_paye'
  | 'partiellement_paye'
  | 'paye'
  | 'en_attente_encaissement'
  | 'en_retard';

export interface OrderItem {
  quantity: number;
  price: number;
  variants: {
    size: number | string;
    color: string | null;
    products: {
      name: string;
    } | null;
  } | null;
}

export interface Order {
  id: string;
  customer_name: string;
  phone: string;
  city: string;
  total: number;
  status: OrderStatus | string;
  created_at: string;
  order_items: OrderItem[];
  
  // Nouveaux champs ajoutés via migration
  order_number?: string;
  customer_email?: string;
  wilaya?: string;
  commune?: string;
  address?: string;
  delivery_type?: string;
  delivery_cost?: number;
  subtotal?: number;
  cancel_reason?: string;
  refusal_reason?: string;
  notes?: string;
  tracking_number?: string;
  source?: string;
  updated_at?: string;
  customer_id?: string;
  payment_status?: PaymentStatus;
  due_date?: string | null;
  /** CRM : préparation encaissement sans paiement ({ completed_at, method, reference? }) */
  cashier_prep?: { completed_at: string; method?: string; reference?: string | null } | null;
}
