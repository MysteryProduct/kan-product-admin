import { PaginationMeta } from './pagination';
import { VatType } from '@/lib/vat';

export interface FetchSaleOrder {
  fetch_sale_order_id: string;
  job_order_id: string;
  fetch_sale_order_name: string;
  fetch_sale_order_qty: number;
  fetch_sale_order_price: number;
  fetch_sale_order_cost: number;
  create_date?: Date;
}

export interface FetchSaleOrderResponse {
  data: FetchSaleOrder[];
  meta: PaginationMeta;
}

export interface SaleOrderList {
  sale_order_list_id?: string;
  sale_order_id?: string;
  fetch_sale_order_id?: string;
  product_variant_id?: string;
  product_name: string;
  job_order_id: string;
  sale_order_list_qty: number;
  sale_order_list_price: number;
  sale_order_list_total: number;
  sale_order_list_cost?: number;
}

export interface SaleOrder {
  sale_order_id: string;
  sale_order_code?: string;
  user_id?: string;
  shipping_address_id?: string;
  shipping_address_name?: string;
  sale_order_name: string;
  sale_order_detail?: string;
  sale_order_type?: string;
  sale_order_status: 'pending' | 'approved' | 'rejected' | 'completed';
  vat_type?: VatType;
  vat_rate?: number;
  sale_order_vat_amount?: number;
  sale_order_subtotal?: number;
  sale_order_total: number;
  create_at?: Date;
  create_by?: string;
  update_at?: Date;
  update_by?: string;
  saleOrderLists?: SaleOrderList[];
}

export interface SaleOrderResponse {
  data: SaleOrder[];
  meta: PaginationMeta;
}

export interface CreateSaleOrderDto {
  sale_order_name: string;
  sale_order_detail?: string;
  shipping_address_name?: string;
  sale_order_type?: string;
  vat_type?: VatType;
  sale_order_subtotal?: number;
  sale_order_vat_amount?: number;
  sale_order_total: number;
  create_by?: string;
  saleOrderLists: {
    fetch_sale_order_id?: string;
    product_variant_id?: string;
    product_name: string;
    sale_order_list_qty: number;
    sale_order_list_price: number;
    sale_order_list_total: number;
    sale_order_list_cost?: number;
  }[];
}

export interface UpdateSaleOrderDto extends CreateSaleOrderDto {
  sale_order_id: string;
  update_by?: string;
}
