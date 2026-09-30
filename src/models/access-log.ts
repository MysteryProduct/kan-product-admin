import axiosInstance from '@/lib/axios';
import type { AccessLogResponse, AccessLogType } from '@/types/access-log';

class AccessLogModel {
  async getLogs(page = 1, limit = 20, type?: AccessLogType): Promise<AccessLogResponse> {
    const response = await axiosInstance.get<AccessLogResponse>('/access-logs', {
      params: { page, limit, ...(type && { type }) },
    });
    return response.data;
  }
}

export default AccessLogModel;
