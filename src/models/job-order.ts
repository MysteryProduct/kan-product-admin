import axiosInstance from '@/lib/axios';
import { PaginationMeta } from '@/types/pagination';
import {
  CreateJobOrderDto,
  JobOrder,
  JobOrderResponse,
  UpdateJobOrderDto,
} from '@/types/job-order';

interface SingleJobOrderResponse {
  data: JobOrder;
  message?: string;
}

class JobOrderModel {
  private defaultMeta(page: number, limit: number, total: number): PaginationMeta {
    return {
      total,
      page,
      last_page: Math.max(1, Math.ceil(total / Math.max(limit, 1))),
      limit,
    };
  }

  private normalizeListResponse(payload: unknown, page: number, limit: number): JobOrderResponse {
    const safePayload = payload as
      | JobOrderResponse
      | { data?: JobOrder[]; items?: JobOrder[]; meta?: PaginationMeta }
      | JobOrder[];

    if (Array.isArray(safePayload)) {
      return {
        data: safePayload,
        meta: this.defaultMeta(page, limit, safePayload.length),
      };
    }

    if (Array.isArray(safePayload?.data)) {
      return {
        data: safePayload.data,
        meta: safePayload.meta || this.defaultMeta(page, limit, safePayload.data.length),
      };
    }

    if (Array.isArray((safePayload as { items?: JobOrder[] })?.items)) {
      const items = (safePayload as { items: JobOrder[] }).items;
      return {
        data: items,
        meta: (safePayload as { meta?: PaginationMeta }).meta || this.defaultMeta(page, limit, items.length),
      };
    }

    return {
      data: [],
      meta: this.defaultMeta(page, limit, 0),
    };
  }

  async getJobOrders(
    page: number = 1,
    limit: number = 100,
    sortOrder?: 'ASC' | 'DESC',
    search?: string,
    filters?: Record<string, string>,
    dateStart?: string,
    dateEnd?: string,
  ): Promise<JobOrderResponse> {
    try {
      const response = await axiosInstance.get<JobOrderResponse | JobOrder[] | { data?: JobOrder[]; items?: JobOrder[]; meta?: PaginationMeta }>('/job-order', {
        params: {
          page,
          limit,
          ...(search && { search }),
          ...(filters && Object.keys(filters).length > 0 && { filters: JSON.stringify(filters) }),
          ...(dateStart && { date_start: dateStart }),
          ...(dateEnd && { date_end: dateEnd }),
          ...(sortOrder && { sort_order: sortOrder }),
        },
      });

      return this.normalizeListResponse(response.data, page, limit);
    } catch (error) {
      console.error('Error fetching job orders:', error);
      throw error;
    }
  }

  async getJobOrderById(id: string): Promise<JobOrder> {
    try {
      const response = await axiosInstance.get<SingleJobOrderResponse>(`/job-order/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching job order ${id}:`, error);
      throw error;
    }
  }

  async createJobOrder(data: CreateJobOrderDto): Promise<JobOrder> {
    try {
      const response = await axiosInstance.post<SingleJobOrderResponse>('/job-order', data);
      return response.data.data;
    } catch (error) {
      console.error('Error creating job order:', error);
      throw error;
    }
  }

  async updateJobOrder(data: UpdateJobOrderDto): Promise<JobOrder> {
    try {
      const response = await axiosInstance.patch<SingleJobOrderResponse>(`/job-order/${data.job_order_id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`Error updating job order ${data.job_order_id}:`, error);
      throw error;
    }
  }

  async deleteJobOrder(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/job-order/${id}`);
    } catch (error) {
      console.error(`Error deleting job order ${id}:`, error);
      throw error;
    }
  }

  async updateJobOrderStatus(
    jobOrderId: string,
    status: string,
    updateBy?: string,
    jobOrderQty?: number,
    jobOrderDefectQty?: number,
  ): Promise<JobOrder> {
    try {
      const response = await axiosInstance.patch<SingleJobOrderResponse>(`/job-order/${jobOrderId}/status`, {
        job_order_status: status,
        ...(typeof jobOrderQty === 'number' && { job_order_qty: jobOrderQty }),
        ...(typeof jobOrderDefectQty === 'number' && { job_order_defect_qty: jobOrderDefectQty }),
        ...(updateBy && { update_by: updateBy }),
      });
      return response.data.data;
    } catch (primaryError) {
      try {
        const fallbackResponse = await axiosInstance.patch<SingleJobOrderResponse>(`/job-order/${jobOrderId}`, {
          job_order_status: status,
          ...(typeof jobOrderQty === 'number' && { job_order_qty: jobOrderQty }),
          ...(typeof jobOrderDefectQty === 'number' && { job_order_defect_qty: jobOrderDefectQty }),
          ...(updateBy && { update_by: updateBy }),
        });
        return fallbackResponse.data.data;
      } catch (fallbackError) {
        console.error(`Error updating status for job order ${jobOrderId}:`, primaryError, fallbackError);
        throw fallbackError;
      }
    }
  }
}

export default JobOrderModel;
