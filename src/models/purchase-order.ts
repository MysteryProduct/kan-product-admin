import axiosInstance from '@/lib/axios';
import {
  PurchaseOrder,
  PurchaseOrderResponse,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from '@/types/purchase-order';

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
    search?: string,
    sortField?: 'purchase_date' | 'purchase_order_total' | null,
    sortOrder?: 'ASC' | 'DESC',
    filters?: Record<string, string>,
  ): Promise<PurchaseOrderResponse> {
    try {
      const response = await axiosInstance.get<PurchaseOrderResponse>('/purchase-order', {
        params: {
          page,
          limit,
          ...(search && { search }),
          ...(sortField && { sortField }),
          ...(sortOrder && { sortOrder }),
          ...(filters && { filters: JSON.stringify(filters) }),
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
      const response = await axiosInstance.patch<SinglePurchaseOrderResponse>(
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
  async deletePurchaseOrder(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/purchase-order/${id}`);
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      throw error;
    }
  }
}

export default PurchaseOrderModel;
