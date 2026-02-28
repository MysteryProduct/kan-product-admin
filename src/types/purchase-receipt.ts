import { PaginationMeta } from './pagination';

export interface PurchaseReceiptListItem {
  purchase_receipt_list_id?: string;
  product_id: string;
  purchase_order_list_id: string;
  purchase_receipt_list_qty: number;
  purchase_receipt_list_price: number;
  purchase_receipt_list_total: number;
  purchase_receipt_id?: string;
  create_at?: Date;
  product_unit_id: number;
  product?: {
    product_id: string;
    product_name: string;
    price?: number;
  };
  productUnit?: {
    product_unit_id: number;
    product_unit_name: string;
  };
  purchaseOrderList?: {
    purchase_order_list_id: string;
    purchase_order_list_qty?: number;
    purchase_order_list_price?: number;
    purchase_order_list_total?: number;
    purchase_order_list_balance_qty?: number;
  };
}

export interface PurchaseReceipt {
  purchase_receipt_id: string;
  purchase_receipt_code?: string;
  purchase_order_id: string;
  supplier_id: string;
  entry_date: Date;
  purchase_receipt_detail?: string;
  purchase_receipt_total: number;
  create_at?: Date;
  create_by?: string;
  update_at?: Date;
  update_by?: string;
  supplier?: {
    supplier_id: string;
    supplier_name: string;
  };
  purchaseOrder?: {
    purchase_order_id: string;
    purchase_order_code?: string;
    purchase_order_name?: string;
  };
  purchaseReceiptLists?: PurchaseReceiptListItem[];
}

export interface PurchaseReceiptResponse {
  data: PurchaseReceipt[];
  meta: PaginationMeta;
}

export interface CreatePurchaseReceiptDto {
  purchase_order_id: string;
  supplier_id: string;
  entry_date: string;
  purchase_receipt_detail?: string;
  purchase_receipt_total: number;
  create_by?: string;
  purchaseReceiptLists: {
    product_id: string;
    purchase_order_list_id: string;
    purchase_receipt_list_qty: number;
    purchase_receipt_list_price: number;
    purchase_receipt_list_total: number;
    product_unit_id: number;
    create_at?: string;
  }[];
}

export interface UpdatePurchaseReceiptDto extends CreatePurchaseReceiptDto {
  purchase_receipt_id: string;
  update_by?: string;
}
