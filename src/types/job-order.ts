import { PaginationMeta } from './pagination';

export type JobOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type JobOrderType = 'website' | 'purchase';

export interface JobOrderMaterial {
  job_order_material_id?: number;
  job_order_id?: string;
  material_id: string;
  material_qty: number;
  material?: {
    material_id: string;
    material_name: string;
    material_price?: number;
  };
}

export interface JobOrder {
  job_order_id: string;
  job_order_name: string;
  job_order_description?: string;
  job_order_qty?: number;
  job_order_defect_qty?: number;
  job_order_price?: number;
  job_order_type: JobOrderType | string;
  job_order_status: JobOrderStatus | string;
  product_variant_id?: string | null;
  size_id?: number | null;
  color_id?: number | null;
  employee_id?: string;
  target_date?: string | Date;
  create_date?: string | Date;
  employee?: {
    employee_id: string;
    employee_firstname?: string;
    employee_lastname?: string;
    employee_fullname?: string;
  };
  productVariant?: {
    product_variant_id?: string;
    size_id?: number;
    color_id?: number;
    size?: {
      size_id: number;
      size_name: string;
    };
    color?: {
      color_id: number;
      color_name: string;
      color_hex?: string;
    };
    product?: {
      product_id?: string;
      product_name?: string;
    };
  };
  size?: {
    size_id: number;
    size_name: string;
  };
  color?: {
    color_id: number;
    color_name: string;
    color_hex?: string;
  };
  job_order_materials?: JobOrderMaterial[];
  jobOrderMaterials?: JobOrderMaterial[];
}

export interface JobOrderResponse {
  data: JobOrder[];
  meta: PaginationMeta;
}

export interface CreateJobOrderDto {
  job_order_name: string;
  job_order_description?: string;
  job_order_qty?: number;
  job_order_defect_qty?: number;
  job_order_price?: number;
  job_order_type: JobOrderType | string;
  job_order_status?: JobOrderStatus | string;
  product_variant_id?: string | null;
  size_id?: number | null;
  color_id?: number | null;
  employee_id?: string;
  create_by?: string;
  target_date?: string;
  jobOrderMaterials?: Array<{
    material_id: string;
    material_qty: number;
    material_name?: string;
  }>;
}

export interface UpdateJobOrderDto extends Partial<CreateJobOrderDto> {
  job_order_id: string;
  update_by?: string;
}
