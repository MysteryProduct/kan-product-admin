import axiosInstance from '@/lib/axios';
import {
  CreateSaleOrderDto,
  FetchSaleOrder,
  FetchSaleOrderResponse,
  SaleOrder,
  SaleOrderListOptions,
  SaleOrderResponse,
  SaleOrderSummary,
  UpdateSaleOrderDto,
} from '@/types/sale-order';

interface SingleSaleOrderResponse {
  data: SaleOrder;
  message?: string;
}

interface SingleFetchSaleOrderResponse {
  data: FetchSaleOrder;
  message?: string;
}

const unwrapSaleOrder = (payload: SaleOrder | SingleSaleOrderResponse): SaleOrder => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload as SaleOrder;
};

class SaleOrderModel {
  async getFetchSaleOrders(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: string | null,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<FetchSaleOrderResponse> {
    try {
      const response = await axiosInstance.get<
        FetchSaleOrderResponse & { total?: number; totalPages?: number; page?: number; limit?: number }
      >('/fetch-sale-order', {
        params: {
          page,
          limit,
          ...(search && { search }),
          ...(sortField && { sortField }),
          ...(sortOrder && { sortOrder }),
        },
      });
      const body = response.data;
      // The API answers { data, total, page, limit, totalPages } here, not the { data, meta } of the other lists.
      return {
        data: body.data,
        meta: body.meta ?? {
          total: body.total ?? body.data?.length ?? 0,
          page: Number(body.page ?? page),
          last_page: body.totalPages ?? 1,
          limit: Number(body.limit ?? limit),
        },
      };
    } catch (error) {
      console.error('Error fetching fetch sale orders:', error);
      throw error;
    }
  }

  async getSaleOrders(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: 'sale_order_total' | 'create_date' | null,
    sortOrder?: 'ASC' | 'DESC',
    saleOrderType?: string,
    options: SaleOrderListOptions = {},
  ): Promise<SaleOrderResponse> {
    try {
      const response = await axiosInstance.get<SaleOrderResponse>('/sale-order', {
        params: {
          ...(saleOrderType && { type: saleOrderType }),
          ...(options.statuses?.length && { filters: JSON.stringify({ sale_order_status: options.statuses }) }),
          ...(options.dateStart && { date_start: options.dateStart }),
          ...(options.dateEnd && { date_end: options.dateEnd }),
          page,
          limit,
          ...(search && { search }),
          ...(sortField && { sortField }),
          ...(sortOrder && { sortOrder }),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching sale orders:', error);
      throw error;
    }
  }

  async getSaleOrderSummary(saleOrderType?: string): Promise<SaleOrderSummary> {
    const response = await axiosInstance.get<SaleOrderSummary>('/sale-order/summary', {
      params: { ...(saleOrderType && { type: saleOrderType }) },
    });
    return response.data;
  }

  async getSaleOrderById(id: string): Promise<SaleOrder> {
    try {
      const response = await axiosInstance.get<SaleOrder | SingleSaleOrderResponse>(`/sale-order/${id}`);
      return unwrapSaleOrder(response.data);
    } catch (error) {
      throw error;
    }
  }

  async createSaleOrder(data: CreateSaleOrderDto): Promise<SaleOrder> {
    try {
      const response = await axiosInstance.post<SaleOrder | SingleSaleOrderResponse>('/sale-order', data);
      return unwrapSaleOrder(response.data);
    } catch (error) {
      throw error;
    }
  }

  async updateSaleOrder(data: UpdateSaleOrderDto): Promise<SaleOrder> {
    try {
      const response = await axiosInstance.patch<SaleOrder | SingleSaleOrderResponse>(
        `/sale-order/${data.sale_order_id}`,
        data,
      );
      return unwrapSaleOrder(response.data);
    } catch (error) {
      throw error;
    }
  }

  async approveSaleOrder(id: string, update_by: string): Promise<SaleOrder> {
    try {
      const response = await axiosInstance.post<SaleOrder | SingleSaleOrderResponse>(
        `/sale-order/${id}/approve`,
        { status: 'approved', update_by },
      );
      return unwrapSaleOrder(response.data);
    } catch (error) {
      throw error;
    }
  }

  async cancelSaleOrder(id: string, reason: string): Promise<SaleOrder> {
    const response = await axiosInstance.post<SaleOrder | SingleSaleOrderResponse>(`/sale-order/${id}/cancel`, { reason });
    return unwrapSaleOrder(response.data);
  }

  async returnSaleOrderItems(id: string, return_reference: string, items: { sale_order_list_id: string; quantity: number }[]): Promise<SaleOrder> {
    const response = await axiosInstance.post<SaleOrder | SingleSaleOrderResponse>(`/sale-order/${id}/return`, { return_reference, items });
    return unwrapSaleOrder(response.data);
  }

  async deleteSaleOrder(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/sale-order/${id}`);
    } catch (error) {
      throw error;
    }
  }
}

export default SaleOrderModel;
