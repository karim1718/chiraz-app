import type { PaymentMethod, PaymentStatus } from './order';

export type CustomerCategory = 'b2b' | 'boutique' | 'online';
export type PaymentInstrumentStatus = 'pending' | 'cleared' | 'rejected';

export interface Customer {
  id: string;
  full_name: string;
  category: CustomerCategory;
  phone: string;
  address?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface CustomerAccount {
  customer_id: string;
  total_du: number;
  total_paye: number;
  solde: number;
  updated_at: string;
}

export interface Payment {
  id: string;
  customer_id: string;
  order_id?: string | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string | null;
  notes?: string | null;
  paid_at: string;
  created_at: string;
}

export interface PaymentInstrument {
  id?: string;
  payment_id: string;
  status?: PaymentInstrumentStatus;
  cheque_number?: string | null;
  bank_name?: string | null;
  deposit_date?: string | null;
  due_date?: string | null;
  cleared_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
}

export interface CategoryTurnover {
  category: CustomerCategory;
  orders_count: number;
  turnover: number;
}

export interface GlobalTurnover {
  orders_count: number;
  turnover: number;
}

export interface TopClient {
  customer_id: string;
  full_name: string;
  category: CustomerCategory;
  turnover: number;
  last_order_at: string;
  outstanding_balance: number;
}

export interface RecentPaymentRow {
  id: string;
  customer_id: string;
  customer_name: string;
  category: CustomerCategory;
  order_id: string | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  paid_at: string;
}

export interface OutstandingBalance {
  customer_id: string;
  full_name: string;
  category: CustomerCategory;
  total_due: number;
  total_paid: number;
  outstanding_balance: number;
}
