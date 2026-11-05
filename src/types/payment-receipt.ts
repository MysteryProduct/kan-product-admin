import { PaginationMeta } from './pagination';
import { BankAccount } from './bank-account';

// `online_gateway` is written by the Store alone, so a form never offers it.
export type PaymentReceiptType = 'full' | 'partial' | 'deposit' | 'refund';
export type StoredPaymentReceiptType = PaymentReceiptType | 'online_gateway';
export type PaymentMethod = 'cash' | 'bank';
// `card` and `promptpay` are the methods of a Store payment.
export type StoredPaymentMethod = PaymentMethod | 'refund' | 'card' | 'promptpay';
export type PaymentReceiptStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

// What a receipt shows of its sale order (TASK-0348). Money fields are decimal
// strings as the API sends them; `amount_paid` is a number, net of refunds.
export interface PaymentReceiptSaleOrder {
  sale_order_id: string;
  sale_order_code: string;
  legacy_code: string | null;
  sale_order_name: string;
  sale_order_status: string;
  sale_order_type: string;
  sale_order_subtotal: string;
  sale_order_total: string;
  amount_paid: number;
  shipping_address_name: string | null;
  customer_name: string | null;
}

// The shop's header on a printed receipt; a value not set is null.
export interface PaymentReceiptShop {
  name: string | null;
  address: string | null;
  tax_id: string | null;
  branch_code: string | null;
  phone: string | null;
}

export interface PaymentReceipt {
  payment_receipt_id: string;
  sale_order_id: string;
  payment_receipt_code: string;
  // The code before the TASK-0112 renumbering, if it had another ("เลขเดิม").
  legacy_code?: string | null;
  // The payment provider's own reference (Omise chrg_... / rfnd_...), shown
  // apart from the receipt number; none for a receipt recorded in the Admin.
  gateway_reference?: string | null;
  payment_receipt_type: StoredPaymentReceiptType;
  payment_method: StoredPaymentMethod;
  amount_paid: number;
  payment_date: Date | string;
  payment_status: PaymentReceiptStatus;
  payment_receipt_remark?: string;
  account_id?: string;
  create_date?: Date;
  update_date?: Date;
  create_by?: string;
  update_by?: string;
  // On rows of the list and on one receipt; null when the order is gone.
  saleOrder?: PaymentReceiptSaleOrder | null;
  custom_linked?: boolean;
  bankAccount?: BankAccount;
  // On one receipt only.
  create_by_name?: string | null;
  shop?: PaymentReceiptShop;
}

export interface PaymentReceiptResponse {
  data: PaymentReceipt[];
  meta: PaginationMeta;
}

export type PaymentReceiptTab = 'all' | 'paid' | 'refund';
export type PaymentReceiptMethodFilter = 'bank' | 'cash' | 'online';

export interface PaymentReceiptFilters {
  search?: string;
  tab?: PaymentReceiptTab;
  payment_method?: PaymentReceiptMethodFilter[];
  payment_receipt_type?: PaymentReceiptType[];
  // `YYYY-MM-DD` days in Asia/Bangkok, both included.
  date_start?: string;
  date_end?: string;
}

export interface PaymentReceiptListParams extends PaymentReceiptFilters {
  page?: number;
  limit?: number;
  sortField?: 'payment_date' | 'amount_paid' | null;
  sortOrder?: 'ASC' | 'DESC';
  sale_order_id?: string;
}

export interface PaymentReceiptSummary {
  month: {
    receipt_count: number;
    receipt_today_count: number;
    refund_total: number;
    refund_count: number;
  };
  tabs: Record<PaymentReceiptTab, number>;
  facets: { method: Record<PaymentReceiptMethodFilter, number> };
}

// No receipt code: the system issues it (ADR-0001).
export interface CreatePaymentReceiptDto {
  sale_order_id: string;
  payment_receipt_type: PaymentReceiptType;
  payment_method: PaymentMethod;
  amount_paid: number;
  payment_date: string;
  payment_status: PaymentReceiptStatus;
  payment_receipt_remark?: string;
  account_id?: string;
  create_by?: string;
}

export interface UpdatePaymentReceiptDto extends Omit<CreatePaymentReceiptDto, 'sale_order_id'> {
  payment_receipt_id: string;
  payment_receipt_code: string;
  update_by?: string;
}

export const PAYMENT_RECEIPT_TYPE_OPTIONS: Array<{ label: string; value: PaymentReceiptType }> = [
  { label: 'ชำระเต็มจำนวน', value: 'full' },
  { label: 'ชำระบางส่วน', value: 'partial' },
  { label: 'วางมัดจำ', value: 'deposit' },
];

export const PAYMENT_METHOD_OPTIONS: Array<{ label: string; value: PaymentMethod }> = [
  { label: 'เงินสด', value: 'cash' },
  { label: 'โอนผ่านธนาคาร', value: 'bank' },
];

export const PAYMENT_RECEIPT_STATUS_OPTIONS: Array<{ label: string; value: PaymentReceiptStatus }> = [
  { label: 'รอดำเนินการ', value: 'pending' },
  { label: 'ชำระแล้ว', value: 'paid' },
  { label: 'ยกเลิก', value: 'cancelled' },
];

export const PAYMENT_RECEIPT_STATUS_LABELS: Record<PaymentReceiptStatus, string> = {
  pending: 'รอดำเนินการ',
  paid: 'ชำระแล้ว',
  cancelled: 'ยกเลิก',
  refunded: 'คืนเงินแล้ว',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'เงินสด',
  bank: 'โอนผ่านธนาคาร',
  refund: 'คืนเงิน',
  card: 'บัตร',
  promptpay: 'PromptPay',
};
