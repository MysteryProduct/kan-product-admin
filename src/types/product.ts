import { PaginationMeta } from './pagination';

export interface ProductFile {
    product_file_id?: number;
    product_id?: number;
    product_file_name: string;
    product_file_category: 'image' | 'video';
    file?: File; // สำหรับไฟล์ที่ยังไม่ได้ upload
    preview?: string; // สำหรับแสดง preview
}

export interface ProductUnitRef {
    product_unit_id: number;
    product_unit_name: string;
}

export interface ProductMaterial {
    product_material_id?: number;
    product_id?: string;
    material_id: string;
    material_qty: number;
    material?: {
        material_id: string;
        material_name: string;
        material_description?: string;
        material_price?: number;
    };
}

export interface Product {
    product_id: string;
    product_name: string;
    product_description: string;
    product_price: number;
    category : {
        category_id: number;
        category_name: string;
    }
    color : {
        color_id: number;
        color_name: string;
    }
    productUnit?: ProductUnitRef;
    product_unit_id?: number;
    stock : {
        stock_id: number;
        stock_qty: number;
        stock_status : string;
    }
    adddate: Date;
    files?: ProductFile[];
    product_materials?: ProductMaterial[];
    productMaterials?: ProductMaterial[];
}

export interface CreateProductDto {
    product_name: string;
    product_description: string;
    product_price: number;
    category_id: number;
    color_id: number;
    product_unit_id: number;
    product_materials: {
        material_id: string;
        material_qty: number;
    }[];
    files?: File[];
}

export interface UpdateProductDto {
    product_id: string;
    product_name: string;
    product_description: string;
    product_price: number;
    category_id: number;
    color_id: number;
    product_unit_id: number;
    product_materials: {
        material_id: string;
        material_qty: number;
    }[];
    files?: File[];
    existing_files?: number[]; // IDs ของไฟล์ที่เก็บไว้
}

export interface ProductResponse {
    data: Product[];
    meta: PaginationMeta;
}
