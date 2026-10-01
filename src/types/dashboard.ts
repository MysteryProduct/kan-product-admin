import type { PaginationMeta } from '@/types/pagination';

// Shape of GET /dashboard/summary. A block is missing when the signed-in
// employee has no `view` permission on the menu it comes from.
export interface PeriodPair<T> {
  today: T;
  month: T;
}

export interface SalesSummary {
  /** Net of refunds, plus the refunds on their own (both in baht). */
  received?: PeriodPair<{ net: number; refunded: number }>;
  /** Sale orders approved in the period, not reduced by later cancellations or returns. */
  approved?: PeriodPair<{ amount: number; count: number }>;
  /** Store orders whose first payment falls in the period. */
  store_orders?: PeriodPair<number>;
}

/** Current counts of work waiting for an employee; each is present only if its menu can be viewed. */
export interface PendingWork {
  sale_orders_to_approve?: number;
  store_orders_to_review?: number;
  store_orders_to_ship?: number;
  store_orders_to_pickup?: number;
  contact_requests_new?: number;
  purchase_orders_to_approve?: number;
}

/** A list of things that are out of stock: the full count and the first few names. */
export interface StockOutList<T> {
  count: number;
  items: T[];
}

/** Variants and materials whose remaining stock is 0; a list is present only if its menu can be viewed. */
export interface StockOut {
  products?: StockOutList<{
    product_variant_id: string;
    product_name: string;
    color_name: string | null;
    size_name: string | null;
  }>;
  materials?: StockOutList<{ material_id: string; material_name: string }>;
}

/** Production and purchasing; each block is present only if its menu can be viewed. */
export interface Operations {
  /** Counts per status (as GET /job-order/summary) and the open jobs past their target date. */
  job_orders?: {
    all: number;
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    overdue: number;
  };
  /** Approved purchase orders still waiting for goods (active or partial). */
  purchase_orders_to_receive?: number;
  /** Supplier invoices not paid in full, and how many are past due or due within 7 days. */
  supplier_invoices?: { unpaid: number; overdue: number; due_soon: number };
}

/** The sales dashboard page's figures (its own endpoint). */
export interface SalesDashboard {
  timezone: 'Asia/Bangkok';
  generated_at: string;
  sales?: SalesSummary;
  /** Blocks the employee may see but that could not be computed, as `section.block`. */
  unavailable?: string[];
}

/** One measure by month and year; a month that has not begun is null. */
export interface CashflowSeries {
  /** Per year, 12 months in baht. */
  monthly: Record<string, (number | null)[]>;
  /** Per year, the sum of its months (the current year counts up to today). */
  yearly: Record<string, number>;
}

/** Income, expense and purchases by Bangkok month and year (sales dashboard charts). */
export interface Cashflow {
  timezone: 'Asia/Bangkok';
  generated_at: string;
  from_year: number;
  to_year: number;
  current: { year: number; month: number };
  /** Net receipts after refunds. */
  income?: CashflowSeries;
  /** Money paid to suppliers. */
  expense?: CashflowSeries;
  /** Value of approved goods receipts. */
  purchases?: CashflowSeries;
  /** Money given back by refund receipts (positive). */
  refunds?: CashflowSeries;
  /** What was received before refunds: income = receipts - refunds. */
  receipts?: CashflowSeries;
  unavailable?: string[];
}

export type TopProductRange = 'this_month' | 'last_3_months' | 'this_year' | 'all';

export interface TopProduct {
  rank: number;
  /** Null for a sale order line that has no product variant. */
  product_id: string | null;
  name: string;
  /** Units sold, net of returns. */
  quantity: number;
  /** Net units at the price written on the sale order lines; VAT and shipping of the whole order are not added. */
  amount: number;
}

/** The best-selling products of a period (sales dashboard). */
export interface TopProducts {
  timezone: 'Asia/Bangkok';
  generated_at: string;
  range: TopProductRange;
  /** The period as Bangkok dates: from (included) to (not included). */
  from: string;
  to: string;
  /** Left out when the employee may not view sale orders. */
  items?: TopProduct[];
  unavailable?: string[];
}

export interface PaymentMethodShare {
  /** As stored (promptpay, card, cash, ...); null when it was not recorded. */
  method: string | null;
  count: number;
  amount: number;
}

export interface SalesChannelShare {
  /** The sale order type as stored (store, online, order, ...). */
  type: string;
  count: number;
  amount: number;
}

/** Receipts by payment method and sales by channel for one period (sales dashboard). */
export interface SalesMix {
  timezone: 'Asia/Bangkok';
  generated_at: string;
  range: TopProductRange;
  /** The period as Bangkok dates: from (included) to (not included). */
  from: string;
  to: string;
  payment_methods?: { items: PaymentMethodShare[]; refunded: number };
  channels?: SalesChannelShare[];
  unavailable?: string[];
}

export interface DashboardSummary {
  timezone: 'Asia/Bangkok';
  generated_at: string;
  pending_work?: PendingWork;
  stock_out?: StockOut;
  operations?: Operations;
  /** Blocks the employee may see but that could not be computed, as `section.block`. */
  unavailable?: string[];
}

/** The Dashboard numbers whose rows can be opened; one key per number. */
export type DashboardListKey =
  | 'sale_orders_to_approve'
  | 'store_orders_to_review'
  | 'store_orders_to_ship'
  | 'store_orders_to_pickup'
  | 'contact_requests_new'
  | 'purchase_orders_to_approve'
  | 'stock_out_products'
  | 'stock_out_materials'
  | 'job_orders_pending'
  | 'job_orders_in_progress'
  | 'job_orders_completed'
  | 'job_orders_cancelled'
  | 'job_orders_overdue'
  | 'purchase_orders_to_receive'
  | 'supplier_invoices_unpaid'
  | 'supplier_invoices_overdue'
  | 'supplier_invoices_due_soon';

/** What a row is, which decides the existing detail view that can open it. */
export type DashboardListKind =
  | 'sale_order'
  | 'store_order'
  | 'contact_request'
  | 'purchase_order'
  | 'product_variant'
  | 'material'
  | 'job_order'
  | 'invoice_supplier';

/** One row of GET /dashboard/lists/:list; the same shape for every list. */
export interface DashboardListRow {
  id: string;
  /** The record that opens from the row; a variant stands for part of its product, so it opens the product. */
  ref_id: string;
  kind: DashboardListKind;
  code: string | null;
  title: string | null;
  party: string | null;
  date: string | null;
  amount: number | null;
  status: string | null;
}

export interface DashboardList {
  data: DashboardListRow[];
  meta: PaginationMeta;
}
