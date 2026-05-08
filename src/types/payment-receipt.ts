import { PaginationMeta } from './pagination';
import { SaleOrder } from './sale-order';
import { BankAccount } from './bank-account';

export type PaymentReceiptType = 'full' | 'partial' | 'deposit';
export type PaymentMethod = 'cash' | 'bank';
export type PaymentReceiptStatus = 'pending' | 'paid' | 'cancelled';

export interface PaymentReceipt {
  payment_receipt_id: string;
  sale_order_id: string;
  payment_receipt_code: string;
  payment_receipt_type: PaymentReceiptType;
  payment_method: PaymentMethod;
  amount_paid: number;
  payment_date: Date | string;
  payment_status: PaymentReceiptStatus;
  payment_receipt_remark?: string;
  account_id?: string;
  create_date?: Date;
  update_date?: Date;
  create_by?: string;
  update_by?: string;
  saleOrder?: SaleOrder;
  bankAccount?: BankAccount;
}

export interface PaymentReceiptResponse {
  data: PaymentReceipt[];
  meta: PaginationMeta;
}

export interface CreatePaymentReceiptDto {
  sale_order_id: string;
  payment_receipt_code: string;
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
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'เงินสด',
  bank: 'โอนผ่านธนาคาร',
};
