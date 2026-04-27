import axiosInstance from '@/lib/axios';
import {
  CreateSaleOrderDto,
  FetchSaleOrder,
  FetchSaleOrderResponse,
  SaleOrder,
  SaleOrderResponse,
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
      const response = await axiosInstance.get<FetchSaleOrderResponse>('/fetch-sale-order', {
        params: {
          page,
          limit,
          ...(search && { search }),
          ...(sortField && { sortField }),
          ...(sortOrder && { sortOrder }),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching fetch sale orders:', error);
      throw error;
    }
  }

  async getSaleOrders(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: 'sale_order_total' | null,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<SaleOrderResponse> {
    try {
      const response = await axiosInstance.get<SaleOrderResponse>('/sale-order', {
        params: {
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

  async deleteSaleOrder(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/sale-order/${id}`);
    } catch (error) {
      throw error;
    }
  }
}

export default SaleOrderModel;
