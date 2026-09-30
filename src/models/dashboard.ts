import axiosInstance from '@/lib/axios';
import type { DashboardSummary } from '@/types/dashboard';

export default class DashboardModel {
  async getSummary(): Promise<DashboardSummary> {
    const response = await axiosInstance.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  }
}
