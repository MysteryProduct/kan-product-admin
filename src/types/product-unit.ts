import { PaginationMeta } from "./pagination";
export interface ProductUnit {
  product_unit_id: number;
  product_unit_name: string;
}

export interface ApiProductUnitResponse {
    data : ProductUnit[];
    meta : PaginationMeta;
}