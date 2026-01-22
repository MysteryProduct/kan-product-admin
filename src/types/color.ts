import { PaginationMeta } from "./pagination";
export interface Color {
    color_id: number;
    color_name: string;
    color_hex: string;
}

export interface CreateColorDto {
    color_name: string;
    color_hex: string;
}

export interface UpdateColorDto {
    color_id: number;
    color_name?: string;
    color_hex?: string;
}

export interface ColorResponse {
    data : Color[];
    meta: PaginationMeta;
}
