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

export interface DashboardSummary {
  timezone: 'Asia/Bangkok';
  generated_at: string;
  sales?: SalesSummary;
}
