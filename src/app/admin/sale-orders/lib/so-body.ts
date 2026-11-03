import { calculateVatSummary, type VatType } from '@/lib/vat';

/** One line of the form, with quantity and price already read as numbers. */
export interface SoBodyLine {
  /** The saved line being edited, so the API keeps its product variant and reservation (TASK-0339). */
  sale_order_list_id?: string;
  fetch_sale_order_id?: string;
  product_name: string;
  qty: number;
  price: number;
  cost: number;
  job_order_id?: string;
}

export interface SoBodyFields {
  name: string;
  detail: string;
  address: string;
  type: string;
  vatType: VatType;
}

/**
 * The body of `POST /sale-order` and `PATCH /sale-order/:id`, with the same keys and figures the old
 * insert/update dialogs sent: totals from `calculateVatSummary` over the lines plus any shipping fee.
 */
export function buildSaleOrderBody(fields: SoBodyFields, lines: SoBodyLine[], shippingFee: number, vatRate: number) {
  const itemsTotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const vatSummary = calculateVatSummary(itemsTotal + shippingFee, fields.vatType, vatRate);
  return {
    sale_order_name: fields.name.trim(),
    sale_order_detail: fields.detail,
    shipping_address_name: fields.address,
    sale_order_type: fields.type,
    vat_type: fields.vatType,
    sale_order_subtotal: vatSummary.subtotal,
    sale_order_vat_amount: vatSummary.vatAmount,
    sale_order_total: vatSummary.total,
    saleOrderLists: lines.map((line) => ({
      sale_order_list_id: line.sale_order_list_id || undefined,
      fetch_sale_order_id: line.fetch_sale_order_id || undefined,
      product_name: line.product_name,
      sale_order_list_qty: line.qty,
      sale_order_list_price: line.price,
      sale_order_list_total: line.qty * line.price,
      sale_order_list_cost: line.cost,
      job_order_id: line.job_order_id,
    })),
  };
}
