import type { BadgeTone } from '@/components/StatusBadge';
import { PURCHASE_ORDER_STATUS_TONE } from '@/lib/status-tones';
import { calculateVatSummary, VatSummary, VatType } from '@/lib/vat';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types/purchase-order';

export type PurchaseOrderStatus = PurchaseOrder['purchase_order_status'];

// Every status the API writes: draft when saved as one (TASK-0320), pending by default or once a
// draft is submitted, active on approval, partial/completed from receipts and inactive on rejection.
export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'ฉบับร่าง',
  pending: 'รออนุมัติ',
  active: 'อนุมัติแล้ว · รอรับ',
  partial: 'รับบางส่วน',
  completed: 'รับครบแล้ว',
  inactive: 'ยกเลิก',
};

export function statusLabel(status: string | undefined): string {
  return (status && PURCHASE_ORDER_STATUS_LABELS[status as PurchaseOrderStatus]) || status || '-';
}

export function statusTone(status: string | undefined): BadgeTone {
  return (status && PURCHASE_ORDER_STATUS_TONE[status]) || 'neutral';
}

/** The API also returns how much of each line is still to receive (`purchase_order_list_balance_qty`). */
export type PurchaseOrderLine = PurchaseOrderItem & { purchase_order_list_balance_qty?: number | null };

export function orderLines(order: PurchaseOrder): PurchaseOrderLine[] {
  return (order.purchaseOrderLists ?? (order as { items?: PurchaseOrderLine[] }).items ?? []) as PurchaseOrderLine[];
}

export function lineTotal(line: PurchaseOrderItem): number {
  return Number(line.purchase_order_list_total) || Number(line.purchase_order_list_qty) * Number(line.purchase_order_list_price);
}

/**
 * The API saves `purchase_order_total` as the sum of the lines before VAT and works VAT out from it,
 * so the screen does the same with the shared calculateVatSummary.
 */
export function orderVatSummary(order: PurchaseOrder, vatRate: number): VatSummary {
  const base = Number(order.purchase_order_total) || orderLines(order).reduce((sum, line) => sum + lineTotal(line), 0);
  return calculateVatSummary(base, (order.vat_type || 'none') as VatType, vatRate);
}

const moneyFormat = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(amount: number): string {
  return moneyFormat.format(Number.isFinite(amount) ? amount : 0);
}

export function formatBaht(amount: number): string {
  return `฿${formatMoney(amount)}`;
}

const COMPANY_WORDS = /^(บริษัท|ห้างหุ้นส่วนจำกัด|ห้างหุ้นส่วน|หจก\.?|บจก\.?|ร้าน)\s*/;
const LETTER = /[ก-ฮA-Za-z0-9]/;

/** Two letters for the supplier's square, e.g. "ทส" for "บริษัท ไทยสตีล ซัพพลาย จำกัด". */
export function supplierInitials(name: string | undefined): string {
  const words = (name ?? '').replace(COMPANY_WORDS, '').split(/\s+/).filter(Boolean);
  const firstLetter = (word: string) => Array.from(word).find((char) => LETTER.test(char)) ?? '';
  if (words.length >= 2) return `${firstLetter(words[0])}${firstLetter(words[1])}`.toUpperCase();
  const letters = Array.from(words[0] ?? '').filter((char) => LETTER.test(char));
  return letters.slice(0, 2).join('').toUpperCase() || '-';
}
