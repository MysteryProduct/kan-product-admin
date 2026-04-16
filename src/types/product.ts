import { PaginationMeta } from './pagination';

export interface ProductFile {
    product_file_id?: number;
    product_id?: number;
    product_variant_id?: string | null;
    product_file_name: string;
    product_file_category: 'image' | 'video';
    file?: File; // สำหรับไฟล์ที่ยังไม่ได้ upload
    preview?: string; // สำหรับแสดง preview
}

export interface ProductUnitRef {
    product_unit_id: number;
    product_unit_name: string;
}

export interface ProductVariantMaterial {
    product_material_id?: number;
    product_variant_id?: string;
    material_id: string;
    material_qty: number;
    material?: {
        material_id: string;
        material_name: string;
        material_description?: string;
        material_price?: number;
    };
}

export interface ProductVariant {
    product_variant_id?: string;
    client_variant_key?: string;
    product_id?: string;
    product_variant_price: number;
    size_id: number;
    color_id: number;
    product_unit_id: number;
    adddate?: Date;
    product_variant_status?: string;
    size?: {
        size_id: number;
        size_name: string;
    };
    color?: {
        color_id: number;
        color_name: string;
        color_hex?: string;
    };
    productUnit?: ProductUnitRef;
    stock?: {
        stock_product_id?: number;
        stock_product_qty?: number;
        stock_reserve_qty?: number;
        stock_product_remain_qty?: number;
        stock_product_cost?: number;
        stock_product_status?: string;
    };
    product_materials?: ProductVariantMaterial[];
    productMaterials?: ProductVariantMaterial[];
    files?: ProductFile[];
}

export interface Product {
    product_id: string;
    product_name: string;
    product_description: string;
    product_variant_price?: number;
    category : {
        category_id: number;
        category_name: string;
    }
    color?: {
        color_id: number;
        color_name: string;
    }
    productUnit?: ProductUnitRef;
    product_unit_id?: number;
    stock?: {
        stock_id: number;
        stock_qty: number;
        stock_status : string;
    }
    adddate: Date;
    files?: ProductFile[];
    product_variants?: ProductVariant[];
    productVariants?: ProductVariant[];
    product_materials?: ProductVariantMaterial[];
    productMaterials?: ProductVariantMaterial[];
}

export interface CreateProductVariantDto {
    client_variant_key: string;
    product_variant_price: number;
    size_id: number;
    color_id: number;
    product_unit_id: number;
    product_variant_status: string;
    product_materials: {
        material_id: string;
        material_qty: number;
    }[];
}

export interface CreateProductDto {
    product_name: string;
    product_description: string;
    category_id: number;
    product_variants: CreateProductVariantDto[];
    product_files?: File[];
    variant_files?: Record<string, File[]>;
    files?: File[];
}

export interface UpdateProductDto {
    product_id: string;
    product_name: string;
    product_description: string;
    category_id: number;
    product_variants: Array<CreateProductVariantDto & { product_variant_id?: string }>;
    product_files?: File[];
    variant_files?: Record<string, File[]>;
    existing_product_files?: number[];
    existing_variant_files?: Record<string, number[]>;
    files?: File[];
    existing_files?: number[]; // IDs ของไฟล์ที่เก็บไว้
}

export interface ProductResponse {
    data: Product[];
    meta: PaginationMeta;
}
