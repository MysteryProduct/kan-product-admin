import type { BadgeTone } from '@/components/StatusBadge';
import { calculateVatSummary, VatSummary, VatType } from '@/lib/vat';
import type { PurchaseReceipt, PurchaseReceiptListItem } from '@/types/purchase-receipt';

/** The API also returns the rate a receipt was saved with (0 when it has no VAT). */
export type Receipt = PurchaseReceipt & { vat_rate?: number | string | null };

export type ReceiptStatus = PurchaseReceipt['purchase_receipt_status'];

// Every status the API writes: pending when saved, approved (stock added) and rejected ("ยกเลิกเอกสาร").
export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ยกเลิก',
};

const RECEIPT_STATUS_TONE: Record<ReceiptStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
};

export function receiptStatusLabel(status: string | undefined): string {
  return (status && RECEIPT_STATUS_LABELS[status as ReceiptStatus]) || '-';
}

export function receiptStatusTone(status: string | undefined): BadgeTone {
  return (status && RECEIPT_STATUS_TONE[status as ReceiptStatus]) || 'neutral';
}

export function receiptLines(receipt: PurchaseReceipt): PurchaseReceiptListItem[] {
  return receipt.purchaseReceiptLists ?? [];
}

export function receiptLineTotal(line: PurchaseReceiptListItem): number {
  return Number(line.purchase_receipt_list_total) || Number(line.purchase_receipt_list_qty) * Number(line.purchase_receipt_list_price);
}

/** The rate a receipt was saved with; one saved before the API kept it uses today's setting. */
export function receiptVatRate(receipt: Receipt, fallbackRate: number): number {
  const saved = Number(receipt.vat_rate);
  return receipt.vat_rate !== null && receipt.vat_rate !== undefined && Number.isFinite(saved) ? saved : fallbackRate;
}

/**
 * The API saves `purchase_receipt_total` as the sum of the lines, before VAT when VAT is added on top,
 * and keeps the grand total in `purchase_receipt_subtotal`. Every screen works the totals out from
 * the line sum with the shared calculateVatSummary, so the list, the detail page and the form agree.
 */
export function receiptVatSummary(receipt: Receipt, fallbackRate: number): VatSummary {
  const base = Number(receipt.purchase_receipt_total) || receiptLines(receipt).reduce((sum, line) => sum + receiptLineTotal(line), 0);
  return calculateVatSummary(base, (receipt.vat_type || 'none') as VatType, receiptVatRate(receipt, fallbackRate));
}

/** Product unit names by id; list rows carry only the id. */
export type UnitNames = ReadonlyMap<number, string>;

interface QtyLine {
  qty: number;
  unitId?: number | null;
  unitName?: string | null;
}

/** "120 ชิ้น", or "2 รายการ" when the lines are counted in different units. */
export function quantityText(lines: QtyLine[], units: UnitNames): string {
  const total = lines.reduce((sum, line) => sum + line.qty, 0);
  const names = new Set(lines.map((line) => line.unitName || (line.unitId ? units.get(Number(line.unitId)) : undefined) || ''));
  if (names.size === 1) {
    const [name] = [...names];
    return `${total.toLocaleString('th-TH')} ${name || 'หน่วย'}`;
  }
  return `${lines.length.toLocaleString('th-TH')} รายการ`;
}

export function receiptQuantityText(receipt: PurchaseReceipt, units: UnitNames): string {
  return quantityText(
    receiptLines(receipt).map((line) => ({
      qty: Number(line.purchase_receipt_list_qty) || 0,
      unitId: line.product_unit_id,
      unitName: line.productUnit?.product_unit_name,
    })),
    units,
  );
}

export interface OrderLineQty {
  purchase_order_list_qty: number | string;
  purchase_order_list_balance_qty?: number | string | null;
  product_unit_id?: number | null;
  productUnit?: { product_unit_name: string } | null;
}

export interface Progress {
  received: number;
  ordered: number;
  /** A unit name, or "รายการครบ" when lines in different units are counted instead. */
  unit: string;
}

/**
 * How much of an order has been received: ordered minus what is still to receive. Lines in different
 * units cannot be added up, so then it counts the lines received in full. Null without line data.
 */
export function orderProgress(lines: OrderLineQty[] | undefined, units: UnitNames): Progress | null {
  if (!lines || lines.length === 0) return null;
  if (lines.some((line) => line.purchase_order_list_balance_qty === null || line.purchase_order_list_balance_qty === undefined)) return null;
  const receivedOf = (line: OrderLineQty) =>
    Math.max(0, Number(line.purchase_order_list_qty) - Number(line.purchase_order_list_balance_qty));
  const names = new Set(lines.map((line) => line.productUnit?.product_unit_name || (line.product_unit_id ? units.get(Number(line.product_unit_id)) : undefined) || ''));
  if (names.size === 1) {
    const [name] = [...names];
    return {
      received: lines.reduce((sum, line) => sum + receivedOf(line), 0),
      ordered: lines.reduce((sum, line) => sum + Number(line.purchase_order_list_qty), 0),
      unit: name || 'หน่วย',
    };
  }
  return {
    received: lines.filter((line) => receivedOf(line) >= Number(line.purchase_order_list_qty)).length,
    ordered: lines.length,
    unit: 'รายการครบ',
  };
}

export function vatTypeText(vatType: string | undefined, rate: number): string {
  if (vatType === 'include') return `ราคารวม VAT ${rate}%`;
  if (vatType === 'exclude') return `แยก VAT ${rate}%`;
  return 'ไม่คิด VAT';
}

export function vatShortText(vatType: string | undefined): string {
  if (vatType === 'include') return 'รวม VAT';
  if (vatType === 'exclude') return 'แยก VAT';
  return 'ไม่คิด VAT';
}
