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

export interface DashboardSummary {
  timezone: 'Asia/Bangkok';
  generated_at: string;
  sales?: SalesSummary;
  pending_work?: PendingWork;
}
