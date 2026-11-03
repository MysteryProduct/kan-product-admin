import { PaginationMeta } from './pagination';
import { VatType } from '@/lib/vat';

export interface FetchSaleOrder {
  fetch_sale_order_id: string;
  job_order_id: string;
  fetch_sale_order_name: string;
  fetch_sale_order_qty: number;
  fetch_sale_order_price: number;
  fetch_sale_order_cost: number;
  create_date?: Date;
  // Loaded with the row, so the card can name the job order it came from.
  jobOrder?: { job_order_code?: string } | null;
}

export interface FetchSaleOrderResponse {
  data: FetchSaleOrder[];
  meta: PaginationMeta;
}

export interface SaleOrderList {
  sale_order_list_id?: string;
  sale_order_id?: string;
  fetch_sale_order_id?: string;
  product_variant_id?: string;
  product_name: string;
  job_order_id: string;
  sale_order_list_qty: number;
  returned_qty?: number;
  sale_order_list_price: number;
  sale_order_list_total: number;
  sale_order_list_cost?: number;
  // Loaded by GET /sale-order/:id so a line can show its size and colour.
  productVariant?: {
    product?: { product_name?: string } | null;
    size?: { size_name?: string } | null;
    color?: { color_name?: string } | null;
  } | null;
}

export interface SaleOrder {
  sale_order_id: string;
  sale_order_code?: string;
  // The code before the TASK-0112 renumbering, if it had another ("เลขเดิม").
  legacy_code?: string | null;
  user_id?: string;
  shipping_address_id?: string;
  shipping_address_name?: string;
  sale_order_name: string;
  sale_order_detail?: string;
  sale_order_type?: string;
  sale_order_status: 'pending' | 'approved' | 'partial' | 'paid' | 'cancelled' | 'partially_returned' | 'returned';
  vat_type?: VatType;
  vat_rate?: number;
  sale_order_vat_amount?: number;
  sale_order_subtotal?: number;
  sale_order_total: number;
  // The part of sale_order_total that is shipping; Store orders only (TASK-0038).
  sale_order_shipping_fee?: number;
  // Net received (refunds included), added to each row of GET /sale-order by TASK-0335.
  amount_paid?: number;
  create_date?: string;
  update_date?: string;
  create_at?: Date;
  create_by?: string;
  update_at?: Date;
  update_by?: string;
  saleOrderLists?: SaleOrderList[];
}

export interface SaleOrderResponse {
  data: SaleOrder[];
  meta: PaginationMeta;
}

export interface CreateSaleOrderDto {
  sale_order_name: string;
  sale_order_detail?: string;
  shipping_address_name?: string;
  sale_order_type?: string;
  vat_type?: VatType;
  sale_order_subtotal?: number;
  sale_order_vat_amount?: number;
  sale_order_total: number;
  create_by?: string;
  saleOrderLists: {
    fetch_sale_order_id?: string;
    product_variant_id?: string;
    product_name: string;
    sale_order_list_qty: number;
    sale_order_list_price: number;
    sale_order_list_total: number;
    sale_order_list_cost?: number;
  }[];
}

export interface UpdateSaleOrderDto extends CreateSaleOrderDto {
  sale_order_id: string;
  update_by?: string;
}

export type SaleOrderStatus = SaleOrder['sale_order_status'];

/** GET /sale-order/summary (TASK-0335); the received_* figures are null without payment_receipts:view. */
export interface SaleOrderSummary {
  counts: Record<'all' | SaleOrderStatus, number>;
  pending_total: number;
  outstanding_total: number;
  outstanding_count: number;
  received_this_month: number | null;
  received_last_month: number | null;
}

export interface SaleOrderListOptions {
  statuses?: SaleOrderStatus[];
  dateStart?: string;
  dateEnd?: string;
}
