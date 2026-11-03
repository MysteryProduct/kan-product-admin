import type { BadgeTone } from '@/components/StatusBadge';
import { SALE_ORDER_STATUS_TONE } from '@/lib/status-tones';
import type { SaleOrder, SaleOrderList, SaleOrderStatus } from '@/types/sale-order';

export const SALE_ORDER_STATUS_LABELS: Record<SaleOrderStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  partial: 'ชำระบางส่วน',
  paid: 'ชำระครบแล้ว',
  cancelled: 'ยกเลิก',
  partially_returned: 'คืนสินค้าบางส่วน',
  returned: 'คืนสินค้าทั้งหมด',
};

export function statusLabel(status: string | undefined): string {
  return (status && SALE_ORDER_STATUS_LABELS[status as SaleOrderStatus]) || status || '-';
}

export function statusTone(status: string | undefined): BadgeTone {
  return (status && SALE_ORDER_STATUS_TONE[status]) || 'neutral';
}

export const SALE_ORDER_TYPE_OPTIONS = [
  { value: 'custom', label: 'งานผลิต Custom' },
  { value: 'store', label: 'หน้าร้านออนไลน์' },
  { value: 'order', label: 'ขายจากการสั่งซื้อ' },
  { value: 'online', label: 'ขายบนเว็บไซต์' },
] as const;

/** Types the create and edit forms offer; custom and store orders come from their own checkouts. */
export const FORM_TYPE_OPTIONS = SALE_ORDER_TYPE_OPTIONS.filter((option) => option.value === 'order' || option.value === 'online');

export function typeLabel(type: string | undefined): string {
  return SALE_ORDER_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'ขายบนเว็บไซต์';
}

export function orderLines(order: SaleOrder): SaleOrderList[] {
  return order.saleOrderLists ?? [];
}

export function lineTotal(line: SaleOrderList): number {
  return Number(line.sale_order_list_total) || Number(line.sale_order_list_qty) * Number(line.sale_order_list_price);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The amount that has to be paid: the API's `sale_order_subtotal`, VAT and shipping included. */
export function payable(order: SaleOrder): number {
  return Number(order.sale_order_subtotal ?? order.sale_order_total) || 0;
}

export function vatAmount(order: SaleOrder): number {
  return Number(order.sale_order_vat_amount) || 0;
}

/** Before VAT, shipping included when the document carries it (shipping is a VAT-included price). */
export function beforeVat(order: SaleOrder): number {
  return round2(payable(order) - vatAmount(order));
}

export interface PaymentState {
  /** 0–100, clamped. */
  percent: number;
  paid: number;
  due: number;
  text: string;
  tone: 'none' | 'part' | 'full' | 'refund';
}

/**
 * How far an order is paid, from the net received amount. A cancelled order never opened for payment,
 * and an order that was returned shows what was kept after the refund.
 */
export function paymentState(order: SaleOrder, received?: number): PaymentState {
  const total = payable(order);
  const paid = round2(Number(received ?? order.amount_paid ?? 0)) || 0;
  const status = order.sale_order_status;
  const due = Math.max(0, round2(total - paid));
  const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((paid / total) * 100))) : 0;
  if (status === 'cancelled') return { percent: 0, paid, due: 0, text: 'ยกเลิกก่อนอนุมัติ', tone: 'none' };
  if (status === 'pending') return { percent: 0, paid, due, text: 'ยังไม่เปิดรับชำระ', tone: 'none' };
  if (status === 'partially_returned' || status === 'returned') {
    return { percent, paid, due, text: `รับสุทธิ ${formatBaht(paid)} หลังคืนสินค้า`, tone: 'refund' };
  }
  if (paid <= 0) return { percent: 0, paid, due, text: 'ยังไม่รับชำระ', tone: 'none' };
  if (due <= 0) return { percent: 100, paid, due: 0, text: 'รับครบแล้ว', tone: 'full' };
  return { percent, paid, due, text: `รับแล้ว ${percent}% · ค้าง ${formatBaht(due)}`, tone: 'part' };
}

const NO_DIRECT_RETURN = ['store', 'custom'];

/**
 * What can still be returned of a line: what was sold less what came back. Only a line sold from stock (with a
 * product variant) goes back into stock; the API refuses a line sold from ready-to-sell goods of a job order.
 */
export function returnableQty(line: SaleOrderList): number {
  if (!line.product_variant_id) return 0;
  return Math.max(0, Number(line.sale_order_list_qty) - Number(line.returned_qty ?? 0));
}

/** Which commands an order offers, by its status and type; the page also checks the employee's permission. */
export const allows = {
  edit: (order: SaleOrder) => order.sale_order_status === 'pending' && order.sale_order_type !== 'custom',
  /** The API refuses to delete a store order or a custom order. */
  remove: (order: SaleOrder) =>
    order.sale_order_status === 'pending' && order.sale_order_type !== 'custom' && order.sale_order_type !== 'store',
  approve: (order: SaleOrder) => order.sale_order_status === 'pending' && order.sale_order_type !== 'custom',
  cancel: (order: SaleOrder) => order.sale_order_status === 'pending',
  /** A custom order is paid through its own deposit flow, not a generic receipt. */
  pay: (order: SaleOrder) =>
    (order.sale_order_status === 'approved' || order.sale_order_status === 'partial') && order.sale_order_type !== 'custom',
  return: (order: SaleOrder) =>
    ['approved', 'partial', 'paid', 'partially_returned'].includes(order.sale_order_status) &&
    !NO_DIRECT_RETURN.includes(order.sale_order_type ?? '') &&
    orderLines(order).some((line) => returnableQty(line) > 0),
};

const moneyFormat = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(amount: number): string {
  return moneyFormat.format(Number.isFinite(amount) ? amount : 0);
}

export function formatBaht(amount: number): string {
  return `฿${formatMoney(amount)}`;
}

/** "ขนาด M · สีดำ" for a line's variant, or an empty string when it has neither. */
export function variantText(line: SaleOrderList): string {
  const size = line.productVariant?.size?.size_name;
  const color = line.productVariant?.color?.color_name;
  return [size && `ขนาด ${size}`, color && `สี${color}`].filter(Boolean).join(' · ');
}
