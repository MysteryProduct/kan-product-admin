export interface PurchaseOrderItem {
  purchase_order_list_id: number;
  product_id: string;
  purchase_order_list_qty: number;
  purchase_order_list_price: number;
  purchase_order_list_total: number;
  product?: {
    product_id: string;
    product_name: string;
    price: number;
  };
}

export interface PurchaseOrder {
  purchase_order_id: string;
  purchase_order_name: string;
  purchase_order_detail: string;
  purchase_date: string;
  items?: PurchaseOrderItem[];
  total_items?: number;
  total_amount?: number;
}

export interface PurchaseOrderResponse {
  data: PurchaseOrder[];
  meta: {
    page: number;
    limit: number;
    total: number;
    last_page: number;
  };
}

export interface CreatePurchaseOrderDto {
  purchase_order_name: string;
  purchase_order_detail: string;
  purchaseOrderLists: {
    product_id: string;
    purchase_order_list_qty: number;
    purchase_order_list_price: number;
    purchase_order_list_total: number;
  }[];
}

export interface UpdatePurchaseOrderDto extends CreatePurchaseOrderDto {
  purchase_order_id: string;
}
