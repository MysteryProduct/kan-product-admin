import { PaginationMeta } from './pagination';

export type JobOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
// `custom` (TASK-0219): made for a Custom request; completing it adds no store stock.
export type JobOrderType = 'website' | 'purchase' | 'custom';

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

/** One layer of an approved Custom design, as the people who make it need it: no ids and no file address. */
export interface JobOrderDesignLayer {
  no: number;
  kind: 'image' | 'text' | 'other';
  text: string | null;
  file_name: string | null;
  width: number | null;
  height: number | null;
  side: string | null;
  /** Position and size as fractions (0–1) of the face, as the Store Studio stored them. */
  x: number | null;
  y: number | null;
  scale: number | null;
  /** Degrees, -180 to 180. */
  rotation: number | null;
}

export interface JobOrderDesignItem {
  item_no: number;
  template_name: string;
  quantity: number;
  sale_unit: string;
  options: { group: string; value: string }[];
  layers: JobOrderDesignLayer[];
}

/**
 * TASK-0219: the Custom request behind a Custom job. Lists and the board carry the two codes; a single
 * job (`GET /job-order/:id`) also carries the approved revision and its design.
 */
export interface JobOrderCustomRequest {
  code: string;
  sale_order_code: string;
  approved_revision?: number | null;
  items?: JobOrderDesignItem[];
}

export interface JobOrder {
  /** Null or absent for a job no Custom request points at. */
  custom_request?: JobOrderCustomRequest | null;
  job_order_id: string;
  // ADR-0001: JO + Bangkok day + number, issued by the API on create.
  job_order_code: string;
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
  finish_date?: string | Date;
  completed_date?: string | Date;
  completed_at?: string | Date;
  finish_at?: string | Date;
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
