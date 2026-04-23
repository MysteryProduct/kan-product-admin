import { PaginationMeta } from './pagination';
import { VatType } from '@/lib/vat';
export interface PurchaseOrderItem {
  purchase_order_list_id: number;
  material_id: string;
  purchase_order_list_qty: number;
  purchase_order_list_price: number;
  purchase_order_list_total: number;
  purchase_order_id: string;
  product_unit_id?: number;
  material?: {
    material_id: string;
    material_name: string;
    material_price: number;
  };
  productUnit?: {
    product_unit_id: number;
    product_unit_name: string;
  };
}

export interface PurchaseOrder {
  purchase_order_id: string;
  purchase_order_name: string;
  purchase_order_detail: string;
  purchase_order_code: string;
  supplier?:{
    supplier_id:  string;
    supplier_name: string;
    vat_type?: VatType;
  };
  supplier_id: string;
  purchaseOrderLists?: PurchaseOrderItem[];
  vat_type?: VatType;
  purchase_order_subtotal?: number;
  purchase_order_vat_amount?: number;
  purchase_order_total: number;
  purchase_date: Date;
  create_at?: Date;
  purchase_order_status: 'pending' | 'active' | 'inactive' | 'partial' | 'completed';
}

export interface PurchaseOrderResponse {
  data: PurchaseOrder[];
  meta: PaginationMeta;
}

export interface CreatePurchaseOrderDto {
  purchase_order_name: string;
  purchase_order_detail: string;
  supplier_id: string;
  vat_type?: VatType;
  purchase_order_subtotal?: number;
  purchase_order_vat_amount?: number;
  create_by?: string;
  purchase_order_total: number;
  purchaseOrderLists: {
    material_id: string;
    purchase_order_list_qty: number;
    purchase_order_list_price: number;
    purchase_order_list_total: number;
    product_unit_id?: number;
  }[];
}

export interface UpdatePurchaseOrderDto extends CreatePurchaseOrderDto {
  purchase_order_id: string;
  update_by: string;
}
