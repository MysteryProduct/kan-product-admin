import axiosInstance from '@/lib/axios';
import type { DashboardList, DashboardListKey, DashboardSummary, SalesDashboard } from '@/types/dashboard';

export default class DashboardModel {
  async getSummary(): Promise<DashboardSummary> {
    const response = await axiosInstance.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  }

  /** Sales and receipts for today and this month, for the sales dashboard page. */
  async getSalesSummary(): Promise<SalesDashboard> {
    const response = await axiosInstance.get<SalesDashboard>('/dashboard/sales-summary');
    return response.data;
  }

  /** The rows behind one Dashboard number, a page at a time (10 a page). */
  async getList(key: DashboardListKey, page: number, limit = 10): Promise<DashboardList> {
    const response = await axiosInstance.get<DashboardList>(`/dashboard/lists/${key}`, {
      params: { page, limit },
    });
    return response.data;
  }
}
