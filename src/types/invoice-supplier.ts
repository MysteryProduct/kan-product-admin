import { VatType } from '@/lib/vat';
import { PurchaseReceipt } from '@/types/purchase-receipt';
import { PaginationMeta } from '@/types/pagination';

export type InvoiceSupplierStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type InvoicePaymentMethod = 'cash' | 'bank';

export interface InvoiceSupplierPayment {
  payment_id: string;
  account_name: string;
  account_number: string;
  account_branch: string;
  bank_name: string;
}

export interface InvoicePaymentItem {
  invoice_payment_id: string;
  payment_method: InvoicePaymentMethod;
  payment_id?: string;
  invoice_payment_price: number;
}

export interface InvoiceSupplierRow {
  invoice_supplier_id: string;
  purchase_receipt_id: string;
  purchase_receipt_code: string;
  supplier_id: string;
  supplier_name: string;
  invoice_supplier_code: string;
  invoice_supplier_name: string;
  invoice_supplier_date: string;
  invoice_supplier_due_date: string;
  invoice_supplier_total: number;
  invoice_supplier_status: InvoiceSupplierStatus;
  invoice_supplier_detail?: string;
  vat_type: VatType;
  created_at: string;
  sourceReceipt: PurchaseReceipt;
  availablePayments: InvoiceSupplierPayment[];
  invoicePayments: InvoicePaymentItem[];
  purchaseReceipt?: {
    purchase_receipt_id: string;
    purchase_receipt_code?: string;
  };
  supplier?: {
    supplier_id: string;
    supplier_name: string;
  };
}

export interface InvoiceSupplierListResponse {
  data: InvoiceSupplierRow[];
  meta: PaginationMeta;
}

export interface InvoiceSupplierFormPayload {
  invoice_supplier_code?: string;
  invoice_supplier_name: string;
  invoice_supplier_date: string;
  invoice_supplier_due_date: string;
  invoice_supplier_status: InvoiceSupplierStatus;
  invoice_supplier_detail?: string;
  invoicePayments: InvoicePaymentItem[];
  supplier_id: string;
  invoice_supplier_total: number;
}

export const INVOICE_STATUS_OPTIONS: Array<{ label: string; value: InvoiceSupplierStatus }> = [
  { label: 'รอดำเนินการ', value: 'pending' },
  { label: 'ชำระบางส่วน', value: 'partial' },
  { label: 'ชำระแล้ว', value: 'paid' },
  { label: 'ยกเลิก', value: 'cancelled' },
];

export const INVOICE_STATUS_LABELS: Record<InvoiceSupplierStatus, string> = {
  pending: 'รอดำเนินการ',
  partial: 'ชำระบางส่วน',
  paid: 'ชำระแล้ว',
  cancelled: 'ยกเลิก',
};

export const INVOICE_STATUS_BADGE: Record<InvoiceSupplierStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  partial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

export const INVOICE_PAYMENT_METHOD_OPTIONS: Array<{ label: string; value: InvoicePaymentMethod }> = [
  { label: 'เงินสด', value: 'cash' },
  { label: 'ธนาคาร', value: 'bank' },
];

export const INVOICE_PAYMENT_METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: 'เงินสด',
  bank: 'ธนาคาร',
};
