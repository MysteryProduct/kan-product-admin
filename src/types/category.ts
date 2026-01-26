import { PaginationMeta } from './pagination';
export interface Category {
    category_id: number;
    category_name: string;
}

export interface CategoryResponse {
    data : Category[];
    meta: PaginationMeta;
}

export interface CreateCategoryDto {
    category_name: string;
}

export interface UpdateCategoryDto {
    category_id: number;
    category_name: string;
}