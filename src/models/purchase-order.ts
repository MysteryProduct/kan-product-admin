import axiosInstance from '@/lib/axios';
import {
  PurchaseOrder,
  PurchaseOrderResponse,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from '@/types/purchase-order';

export interface ApiPurchaseOrderResponse {
  data: PurchaseOrder[];
  meta: {
    page: number;
    limit: number;
    total: number;
    last_page: number;
  };
}

export interface SinglePurchaseOrderResponse {
  data: PurchaseOrder;
  message?: string;
}

class PurchaseOrderModel {
  /**
   * ดึงข้อมูล Purchase Orders ทั้งหมด
   */
  async getPurchaseOrders(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<ApiPurchaseOrderResponse> {
    try {
      const response = await axiosInstance.get<ApiPurchaseOrderResponse>('/purchase-order', {
        params: {
          page,
          limit,
          ...(search && { search }),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      throw error;
    }
  }

  /**
   * ดึงข้อมูล Purchase Order ตาม ID
   */
  async getPurchaseOrderById(id: string): Promise<PurchaseOrder> {
    try {
      const response = await axiosInstance.get<SinglePurchaseOrderResponse>(
        `/purchase-order/${id}`
      );
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching purchase order ${id}:`, error);
      throw error;
    }
  }

  /**
   * สร้าง Purchase Order ใหม่
   */
  async createPurchaseOrder(data: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    try {
      const response = await axiosInstance.post<SinglePurchaseOrderResponse>(
        '/purchase-order',
        data
      );
      return response.data.data;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }

  /**
   * แก้ไข Purchase Order
   */
  async updatePurchaseOrder(data: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    try {
      const response = await axiosInstance.put<SinglePurchaseOrderResponse>(
        `/purchase-order/${data.purchase_order_id}`,
        data
      );
      return response.data.data;
    } catch (error) {
      console.error('Error updating purchase order:', error);
      throw error;
    }
  }

  /**
   * ลบ Purchase Order
   */
  async deletePurchaseOrder(id: number): Promise<void> {
    try {
      await axiosInstance.delete(`/purchase-order/${id}`);
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      throw error;
    }
  }
}

export default PurchaseOrderModel;
