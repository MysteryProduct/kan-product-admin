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

export interface DashboardSummary {
  timezone: 'Asia/Bangkok';
  generated_at: string;
  sales?: SalesSummary;
  pending_work?: PendingWork;
  stock_out?: StockOut;
  operations?: Operations;
  /** Blocks the employee may see but that could not be computed, as `section.block`. */
  unavailable?: string[];
}

/** The Dashboard numbers whose rows can be opened; a key equals its name in PendingWork. */
export type DashboardListKey =
  | 'sale_orders_to_approve'
  | 'store_orders_to_review'
  | 'store_orders_to_ship'
  | 'store_orders_to_pickup'
  | 'contact_requests_new'
  | 'purchase_orders_to_approve';

/** What a row is, which decides the existing detail view that can open it. */
export type DashboardListKind = 'sale_order' | 'store_order' | 'contact_request' | 'purchase_order';

/** One row of GET /dashboard/lists/:list; the same shape for every list. */
export interface DashboardListRow {
  id: string;
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
