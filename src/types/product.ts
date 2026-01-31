import { PaginationMeta } from './pagination';

export interface ProductFile {
    product_file_id?: number;
    product_id?: number;
    product_file_name: string;
    product_file_category: 'image' | 'video';
    file?: File; // สำหรับไฟล์ที่ยังไม่ได้ upload
    preview?: string; // สำหรับแสดง preview
}

export interface Product {
    product_id: string;
    product_name: string;
    product_description: string;
    price: number;
    category : {
        category_id: number;
        category_name: string;
    }
    color : {
        color_id: number;
        color_name: string;
    }
    stock : {
        stock_id: number;
        stock_qty: number;
        stock_status : string;
    }
    adddate: Date;
    files?: ProductFile[];
    
}

export interface CreateProductDto {
    product_name: string;
    product_description: string;
    price: number;
    category_id: number;
    color_id: number;
    files?: File[];
}

export interface UpdateProductDto {
    product_id: number;
    product_name: string;
    product_description: string;
    price: number;
    category_id: number;
    color_id: number;
    files?: File[];
    existing_files?: number[]; // IDs ของไฟล์ที่เก็บไว้
}

export interface ProductResponse {
    data: Product[];
    meta: PaginationMeta;
}
