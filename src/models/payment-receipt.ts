import axiosInstance from '@/lib/axios';
import {
  CreatePaymentReceiptDto,
  PaymentReceipt,
  PaymentReceiptFilters,
  PaymentReceiptListParams,
  PaymentReceiptResponse,
  PaymentReceiptSummary,
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

/** Empty values are left out, so an unset filter stays unset; a list goes as `a,b`. */
const filterParams = ({ payment_method, payment_receipt_type, ...rest }: PaymentReceiptFilters) => ({
  ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value)),
  ...(payment_method?.length && { payment_method: payment_method.join(',') }),
  ...(payment_receipt_type?.length && { payment_receipt_type: payment_receipt_type.join(',') }),
});

class PaymentReceiptModel {
  /** The list of the v2 page: filters, sort and paging together (TASK-0348). */
  async listPaymentReceipts({
    page = 1,
    limit = 10,
    sortField,
    sortOrder,
    sale_order_id,
    ...filters
  }: PaymentReceiptListParams): Promise<PaymentReceiptResponse> {
    const response = await axiosInstance.get<PaymentReceiptResponse>('/payment-receipts', {
      params: {
        page,
        limit,
        ...(sortField && { sortField }),
        ...(sortOrder && { sortOrder }),
        ...(sale_order_id && { sale_order_id }),
        ...filterParams(filters),
      },
    });
    return response.data;
  }

  /** The month's numbers, tab counts and method counts; takes the list's filters. */
  async getPaymentReceiptSummary(filters: PaymentReceiptFilters = {}): Promise<PaymentReceiptSummary> {
    const response = await axiosInstance.get<PaymentReceiptSummary>('/payment-receipts/summary', {
      params: filterParams(filters),
    });
    return response.data;
  }

  /** The receipts of one sale order, newest payment first, refunds included (TASK-0335). */
  async getPaymentReceiptsBySaleOrder(saleOrderId: string, limit: number = 50): Promise<PaymentReceiptResponse> {
    const response = await axiosInstance.get<PaymentReceiptResponse>('/payment-receipts', {
      params: { sale_order_id: saleOrderId, page: 1, limit },
    });
    return response.data;
  }

  async getPaymentReceipts(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: 'payment_date' | 'amount_paid' | null,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<PaymentReceiptResponse> {
    try {
      const response = await axiosInstance.get<PaymentReceiptResponse>('/payment-receipts', {
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
      const response = await axiosInstance.get<PaymentReceipt | SinglePaymentReceiptResponse>(`/payment-receipts/${id}`);
      return unwrapPaymentReceipt(response.data);
    } catch (error) {
      throw error;
    }
  }

  async createPaymentReceipt(data: CreatePaymentReceiptDto): Promise<PaymentReceipt> {
    try {
      const response = await axiosInstance.post<PaymentReceipt | SinglePaymentReceiptResponse>('/payment-receipts', data);
      return unwrapPaymentReceipt(response.data);
    } catch (error) {
      throw error;
    }
  }

  async updatePaymentReceipt(data: UpdatePaymentReceiptDto): Promise<PaymentReceipt> {
    try {
      const response = await axiosInstance.patch<PaymentReceipt | SinglePaymentReceiptResponse>(
        `/payment-receipts/${data.payment_receipt_id}`,
        data,
      );
      return unwrapPaymentReceipt(response.data);
    } catch (error) {
      throw error;
    }
  }

  async deletePaymentReceipt(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/payment-receipts/${id}`);
    } catch (error) {
      throw error;
    }
  }
}

export default PaymentReceiptModel;
