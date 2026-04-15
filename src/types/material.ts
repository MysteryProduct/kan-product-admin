import { PaginationMeta } from './pagination';

export interface Material {
    material_id: string;
    material_name: string;
    material_description: string;
    material_price: number;
    size_id: number;
    color_id: number;
    adddate: Date;
    color? : {
        color_id: number;
        color_name: string;
    }
    size? : {
        size_id: number;
        size_name: string;
    }
}

export interface CreateMaterialDto {
    material_name: string;
    material_description: string;
    material_price: number;
    size_id: number;
    color_id: number;
}

export interface UpdateMaterialDto extends CreateMaterialDto {
    material_id: string;
}

export interface MaterialResponse {
    data: Material[];
    meta: PaginationMeta;
}
