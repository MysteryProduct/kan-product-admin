import axiosInstance from '@/lib/axios';
import { PurchaseOrderItemResponse } from '@/types/purchase-order-list';

class PurchaseOrderListModel {
    async getPurchaseOrderItems(
        purchase_order_id: string,
        page: number = 1,
        limit: number = 10,
        search?: string,
        sortField?: 'purchase_order_list_price' | 'purchase_order_list_total' | null,
        sortOrder?: 'ASC' | 'DESC',
        excludeIds?: string,
    ): Promise<PurchaseOrderItemResponse> {
        try {
            const response = await axiosInstance.post<PurchaseOrderItemResponse>(`/purchase-order-list/findByPurchaseOrderId`, {
                purchaseOrderId: purchase_order_id,
                page,
                limit,
                ...(search && { search }),
                ...(sortField && { sortField }),
                ...(sortOrder && { sortOrder }),
                ...(excludeIds && { excludeIds }),
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching purchase order items for order ${purchase_order_id}:`, error);
            throw error;
        }
    }
}

export default PurchaseOrderListModel;