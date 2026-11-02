import type { BadgeTone } from '@/components/StatusBadge';
import { toDateValue, toLocalIsoDate } from '@/lib/date-format';
import { DEFAULT_VAT_RATE_PERCENT, type VatType } from '@/lib/vat';
import type { InvoicePaymentItem, InvoiceSupplierPayment, InvoiceSupplierRow } from '@/types/invoice-supplier';
import type { PurchaseReceipt } from '@/types/purchase-receipt';
import { receiptVatSummary } from '../../purchase-receipt/lib/pr-display';

export { formatBaht, formatMoney } from '../../purchase-orders/lib/po-display';

/**
 * The status shown on screen (TASK-0327 D1). The API stores pending/partial/paid from the payments and
 * never sets cancelled itself; "overdue" exists only here, from the due date.
 * Checked in order, the first match wins.
 */
export type DisplayStatus = 'cancelled' | 'paid' | 'overdue' | 'partial' | 'pending';

export const DISPLAY_STATUS_KEYS: DisplayStatus[] = ['pending', 'partial', 'overdue', 'paid', 'cancelled'];

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: 'รอชำระ',
  partial: 'ชำระบางส่วน',
  overdue: 'เกินกำหนด',
  paid: 'ชำระแล้ว',
  cancelled: 'ยกเลิก',
};

export const DISPLAY_STATUS_TONES: Record<DisplayStatus, BadgeTone> = {
  pending: 'warning',
  partial: 'info',
  overdue: 'danger',
  paid: 'success',
  cancelled: 'neutral',
};

const roundCurrency = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export function paymentsTotal(payments: Pick<InvoicePaymentItem, 'invoice_payment_price'>[] | undefined): number {
  return roundCurrency((payments ?? []).reduce((sum, item) => sum + Number(item.invoice_payment_price || 0), 0));
}

/** pending/partial/paid exactly as the API's `calculateStatus` derives them. */
export function paymentStatus(total: number, paid: number): 'pending' | 'partial' | 'paid' {
  if (paid <= 0) return 'pending';
  if (paid < total) return 'partial';
  return 'paid';
}

/** Whole days from today (local) to the due date: negative once it has passed, null without a date. */
export function daysUntil(due: string | undefined, today: string = toLocalIsoDate()): number | null {
  const dueDate = toDateValue(due ? due.slice(0, 10) : undefined);
  const todayDate = toDateValue(today);
  if (!dueDate || !todayDate) return null;
  const start = Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const end = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((end - start) / 86_400_000);
}

export function displayStatus(
  stored: InvoiceSupplierRow['invoice_supplier_status'] | undefined,
  total: number,
  paid: number,
  due: string | undefined,
  today?: string,
): DisplayStatus {
  if (stored === 'cancelled') return 'cancelled';
  const byPayments = paymentStatus(total, paid);
  if (byPayments === 'paid') return 'paid';
  const days = daysUntil(due, today);
  if (days !== null && days < 0) return 'overdue';
  return byPayments;
}

export interface InvoiceView {
  row: InvoiceSupplierRow;
  total: number;
  paid: number;
  remaining: number;
  status: DisplayStatus;
  /** Days to the due date; negative when overdue. */
  days: number | null;
  receiptCode: string;
  supplierName: string;
  vatType: VatType;
}

export function invoiceView(row: InvoiceSupplierRow, today?: string): InvoiceView {
  const total = roundCurrency(Number(row.invoice_supplier_total || 0));
  const paid = paymentsTotal(row.invoicePayments);
  // findAll joins the whole receipt, so its VAT type is there even though the row type does not name it.
  const receipt = row.purchaseReceipt as (InvoiceSupplierRow['purchaseReceipt'] & { vat_type?: VatType }) | undefined;
  return {
    row,
    total,
    paid,
    remaining: roundCurrency(Math.max(total - paid, 0)),
    status: displayStatus(row.invoice_supplier_status, total, paid, row.invoice_supplier_due_date, today),
    days: daysUntil(row.invoice_supplier_due_date, today),
    receiptCode: row.purchaseReceipt?.purchase_receipt_code || row.purchase_receipt_code || '-',
    supplierName: row.supplier?.supplier_name || row.supplier_name || '-',
    vatType: row.vat_type || receipt?.vat_type || 'none',
  };
}

/** The line under the due date: "อีก 6 วัน", "ครบกำหนดวันนี้", "เกินกำหนด 3 วัน" or "ชำระครบแล้ว". */
export function dueNote(view: Pick<InvoiceView, 'status' | 'days'>): { text: string; tone: 'muted' | 'warning' | 'danger' } {
  if (view.status === 'paid') return { text: 'ชำระครบแล้ว', tone: 'muted' };
  if (view.status === 'cancelled' || view.days === null) return { text: '', tone: 'muted' };
  if (view.days < 0) return { text: `เกินกำหนด ${Math.abs(view.days).toLocaleString('th-TH')} วัน`, tone: 'danger' };
  if (view.days === 0) return { text: 'ครบกำหนดวันนี้', tone: 'warning' };
  return { text: `อีก ${view.days.toLocaleString('th-TH')} วัน`, tone: view.days <= 7 ? 'warning' : 'muted' };
}

export function paidPercent(total: number, paid: number): number {
  if (total <= 0) return paid > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
}

export function accountLabel(account: InvoiceSupplierPayment | undefined): string {
  if (!account) return '';
  return [account.bank_name, account.account_number].filter(Boolean).join(' · ');
}

/** "พ.ย. 2569" for an ISO date. */
export function monthLabel(iso: string): string {
  const date = toDateValue(iso);
  return date ? new Intl.DateTimeFormat('th-TH', { month: 'short', year: 'numeric' }).format(date) : '-';
}

/** The ISO date `days` after an ISO date (local calendar). */
export function addDaysIso(iso: string, days: number): string {
  const base = toDateValue(iso) ?? new Date();
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return toLocalIsoDate(next);
}

/**
 * Parses a baht amount typed by a person: digits with an optional "." and up to two decimals, commas allowed
 * as thousands separators. Empty text and anything else (letters, "1e3", three decimals) return null.
 */
export function parseAmount(text: string): number | null {
  const compact = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(compact)) return null;
  const value = Number(compact);
  return Number.isFinite(value) ? value : null;
}

/** An amount as editable text: "1250.5" → "1,250.50". */
export function amountText(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * What the supplier is owed for a receipt, VAT included (TASK-0328 D1). `purchase_receipt_total` is the
 * pre-VAT sum; the API's `purchase_receipt_subtotal` carries VAT for an exclude-VAT receipt and is the cap
 * it checks invoices against. A receipt without it falls back to the receipt VAT helper.
 */
export function receiptPayable(receipt: PurchaseReceipt): number {
  const subtotal = Number(receipt.purchase_receipt_subtotal);
  if (receipt.purchase_receipt_subtotal != null && Number.isFinite(subtotal)) return subtotal;
  return receiptVatSummary(receipt, DEFAULT_VAT_RATE_PERCENT).total;
}
