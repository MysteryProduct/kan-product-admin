import axiosInstance from '@/lib/axios';
import type {
  Cashflow,
  DashboardList,
  DashboardListKey,
  DashboardSummary,
  SalesDashboard,
  StockFilter,
  StockOverviewResponse,
  SalesMix,
  TopProductRange,
  TopProducts,
} from '@/types/dashboard';

/** Bangkok calendar days as YYYY-MM-DD; `to` is included. */
export interface DashboardDates {
  from: string;
  to: string;
}

// A preset goes as `range`, days as `from` and `to`; the API refuses both together.
const periodParams = (period: TopProductRange | DashboardDates) =>
  typeof period === 'string' ? { range: period } : period;

export default class DashboardModel {
  async getSummary(): Promise<DashboardSummary> {
    const response = await axiosInstance.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  }

  /** Sales and receipts for today and this month, for the sales dashboard page. */
  async getSalesSummary(dates?: DashboardDates): Promise<SalesDashboard> {
    const response = await axiosInstance.get<SalesDashboard>('/dashboard/sales-summary', { params: dates });
    return response.data;
  }

  /** Income, expense and purchases by month and year; at most five years (the API refuses more). */
  async getCashflow(fromYear: number, toYear: number): Promise<Cashflow> {
    const response = await axiosInstance.get<Cashflow>('/dashboard/cashflow', {
      params: { from_year: fromYear, to_year: toYear },
    });
    return response.data;
  }

  /** The ten best-selling products of a period. */
  async getTopProducts(period: TopProductRange | DashboardDates): Promise<TopProducts> {
    const response = await axiosInstance.get<TopProducts>('/dashboard/top-products', { params: periodParams(period) });
    return response.data;
  }

  /** Receipts by payment method and sales by channel for a period. */
  async getSalesMix(period: TopProductRange | DashboardDates): Promise<SalesMix> {
    const response = await axiosInstance.get<SalesMix>('/dashboard/sales-mix', { params: periodParams(period) });
    return response.data;
  }

  /** Stock by variant under a category / code-or-name filter, for the stock card. */
  async getStockOverview(filter: StockFilter): Promise<StockOverviewResponse> {
    const response = await axiosInstance.get<StockOverviewResponse>('/dashboard/stock-overview', {
      params: { ...filter },
    });
    return response.data;
  }

  /**
   * The rows behind one Dashboard number, a page at a time (10 a page). `extra` carries the
   * stock list's filter and status; the server ignores it for every other list.
   */
  async getList(
    key: DashboardListKey,
    page: number,
    limit = 10,
    extra: Record<string, string | number | undefined> = {},
  ): Promise<DashboardList> {
    const response = await axiosInstance.get<DashboardList>(`/dashboard/lists/${key}`, {
      params: { page, limit, ...extra },
    });
    return response.data;
  }
}
