import { PaginationMeta } from './pagination';

export interface Material {
    material_id: string;
    material_name: string;
    material_description: string;
    material_price: number;
    adddate: Date;
}

export interface CreateMaterialDto {
    material_name: string;
    material_description: string;
    material_price: number;
}

export interface UpdateMaterialDto extends CreateMaterialDto {
    material_id: string;
}

export interface MaterialResponse {
    data: Material[];
    meta: PaginationMeta;
}
