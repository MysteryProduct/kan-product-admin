import axiosInstance from '@/lib/axios';
import {
  ReleasedStoreLot,
  StoreLotResponse,
  StoreLotStatus,
} from '@/types/store-lot';

class StoreLotModel {
  async getStoreLots(
    page: number = 1,
    limit: number = 20,
    status: StoreLotStatus = 'unreleased',
    search?: string,
  ): Promise<StoreLotResponse> {
    const response = await axiosInstance.get<StoreLotResponse>('/store-lots', {
      params: { page, limit, status, ...(search && { search }) },
    });
    return response.data;
  }

  async releaseStoreLot(id: string, note?: string): Promise<ReleasedStoreLot> {
    const response = await axiosInstance.post<ReleasedStoreLot>(
      `/store-lots/${id}/release`,
      note ? { note } : {},
    );
    return response.data;
  }
}

export default StoreLotModel;
