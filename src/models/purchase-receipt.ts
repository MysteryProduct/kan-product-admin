import axiosInstance from '@/lib/axios';
import {
  CreatePurchaseReceiptDto,
  PurchaseReceipt,
  PurchaseReceiptResponse,
  UpdatePurchaseReceiptDto,
} from '@/types/purchase-receipt';

interface SinglePurchaseReceiptResponse {
  data: PurchaseReceipt;
  message?: string;
}

class PurchaseReceiptModel {
  async getPurchaseReceipts(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: 'entry_date' | 'purchase_receipt_total' | null,
    sortOrder?: 'ASC' | 'DESC',
    filters?: Record<string, string>,
  ): Promise<PurchaseReceiptResponse> {
    try {
      const response = await axiosInstance.get<PurchaseReceiptResponse>('/purchase-receipt', {
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
      console.error('Error fetching purchase receipts:', error);
      throw error;
    }
  }

  async getApprovedPurchaseReceiptsForInvoiceStatus(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: 'entry_date' | 'purchase_receipt_total' | null,
    sortOrder?: 'ASC' | 'DESC',
    filters?: Record<string, string>,
  ): Promise<PurchaseReceiptResponse> {
    try {
      const response = await axiosInstance.get<PurchaseReceiptResponse>('/purchase-receipt/approved/invoice-status', {
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
      console.error('Error fetching approved purchase receipts for invoice status:', error);
      throw error;
    }
  }

  async getPurchaseReceiptById(id: string): Promise<PurchaseReceipt> {
    try {
      const response = await axiosInstance.get<SinglePurchaseReceiptResponse>(`/purchase-receipt/${id}`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  async createPurchaseReceipt(data: CreatePurchaseReceiptDto): Promise<PurchaseReceipt> {
    try {
      const response = await axiosInstance.post<SinglePurchaseReceiptResponse>('/purchase-receipt', data);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }
  async approvePurchaseReceipt(id: string, update_by: string): Promise<PurchaseReceipt> {
    try {
      const response = await axiosInstance.post<SinglePurchaseReceiptResponse>(
        `/purchase-receipt/${id}/approve`,
        { status: 'approved', update_by }
      );
      return response.data.data;
    }
    catch (error) {
      throw error;
    }
  }
  async updatePurchaseReceipt(data: UpdatePurchaseReceiptDto): Promise<PurchaseReceipt> {
    try {
      const response = await axiosInstance.patch<SinglePurchaseReceiptResponse>(
        `/purchase-receipt/${data.purchase_receipt_id}`,
        data,
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePurchaseReceipt(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/purchase-receipt/${id}`);
    } catch (error) {
      throw error;
    }
  }
}

export default PurchaseReceiptModel;
