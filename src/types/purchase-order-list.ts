import { PaginationMeta } from './pagination';
export interface PurchaseOrderItem {
    purchase_order_list_id: string;
    product_id: string;
    purchase_order_list_qty: number;
    purchase_order_list_price: number;
    purchase_order_list_total: number;
    purchase_order_list_balance_qty?: number;
    purchase_order_id: string;
    product_unit_id?: number;
    product?: {
        product_id: string;
        product_name: string;
    };
    productUnit?: {
        product_unit_id: number;
        product_unit_name: string;
    };
}

export interface PurchaseOrderItemResponse {
    data: PurchaseOrderItem[];
    meta?: PaginationMeta;
}