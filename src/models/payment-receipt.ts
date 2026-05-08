import axiosInstance from '@/lib/axios';
import {
  CreatePaymentReceiptDto,
  PaymentReceipt,
  PaymentReceiptResponse,
  UpdatePaymentReceiptDto,
} from '@/types/payment-receipt';

interface SinglePaymentReceiptResponse {
  data: PaymentReceipt;
  message?: string;
}

const unwrapPaymentReceipt = (payload: PaymentReceipt | SinglePaymentReceiptResponse): PaymentReceipt => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload as PaymentReceipt;
};

class PaymentReceiptModel {
  async getPaymentReceipts(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: 'payment_date' | 'amount_paid' | null,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<PaymentReceiptResponse> {
    try {
      const response = await axiosInstance.get<PaymentReceiptResponse>('/payment-receipt', {
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
      console.error('Error fetching payment receipts:', error);
      throw error;
    }
  }

  async getPaymentReceiptById(id: string): Promise<PaymentReceipt> {
    try {
      const response = await axiosInstance.get<PaymentReceipt | SinglePaymentReceiptResponse>(`/payment-receipt/${id}`);
      return unwrapPaymentReceipt(response.data);
    } catch (error) {
      throw error;
    }
  }

  async createPaymentReceipt(data: CreatePaymentReceiptDto): Promise<PaymentReceipt> {
    try {
      const response = await axiosInstance.post<PaymentReceipt | SinglePaymentReceiptResponse>('/payment-receipt', data);
      return unwrapPaymentReceipt(response.data);
    } catch (error) {
      throw error;
    }
  }

  async updatePaymentReceipt(data: UpdatePaymentReceiptDto): Promise<PaymentReceipt> {
    try {
      const response = await axiosInstance.patch<PaymentReceipt | SinglePaymentReceiptResponse>(
        `/payment-receipt/${data.payment_receipt_id}`,
        data,
      );
      return unwrapPaymentReceipt(response.data);
    } catch (error) {
      throw error;
    }
  }

  async deletePaymentReceipt(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/payment-receipt/${id}`);
    } catch (error) {
      throw error;
    }
  }
}

export default PaymentReceiptModel;
