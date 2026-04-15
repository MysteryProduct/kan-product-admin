import { PaginationMeta } from './pagination';
import type { Category } from './category';

export interface Size {
    size_id: number;
    size_name: string;
    category?: Category[];
    category_ids?: number[];
}

export interface SizeResponse {
    data: Size[];
    meta: PaginationMeta;
}

export interface CreateSizeDto {
    size_name: string;
    category_ids?: number[];
}

export interface UpdateSizeDto {
    size_id: number;
    size_name: string;
    category_ids?: number[];
}

export interface SizeCategoryRelation {
    category_ids: number[];
    category: Category[];
}
