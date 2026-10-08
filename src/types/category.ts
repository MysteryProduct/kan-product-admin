import { PaginationMeta } from './pagination';
import type { Size } from './size';
export interface Category {
    category_id: number;
    category_name: string;
    sizes?: Size[];
    categorySize?: { id?: number; size_id: number; size?: Size }[];
    size_ids?: number[];
}

export interface CategoryResponse {
    data : Category[];
    meta: PaginationMeta;
}

export interface CreateCategoryDto {
    category_name: string;
    size_ids?: number[];
}

export interface UpdateCategoryDto {
    category_id: number;
    category_name: string;
    size_ids?: number[];
}