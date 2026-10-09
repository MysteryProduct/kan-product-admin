import axiosInstance from "@/lib/axios";
import { ProductUnit, ApiProductUnitResponse } from "@/types/product-unit";

export class ProductUnitModel {
    /** ดึงข้อมูล Product Units ทั้งหมด */
    async getProductUnits(
        page: number = 1,
        limit: number = 10,
        search?: string
    ): Promise<ApiProductUnitResponse> {
        try {
            const response = await axiosInstance.get<ApiProductUnitResponse>("/product-unit", {
                params: {
                    page,
                    limit,
                    ...(search && { search }),
                },
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching product units:", error);
            throw error;
        }
    }

    // Option lists must not silently drop units after the first page (TASK-0149).
    async getAllProductUnits(search?: string): Promise<ApiProductUnitResponse> {
        const first = await this.getProductUnits(1, 100, search);
        const data = [...first.data];
        for (let page = 2; page <= first.meta.last_page; page++) {
            data.push(...(await this.getProductUnits(page, 100, search)).data);
        }
        return { data, meta: { ...first.meta, page: 1, limit: data.length, last_page: data.length ? 1 : 0 } };
    }

    createProductUnit = async (productUnitName: string): Promise<ProductUnit> => {
        try {
            const response = await axiosInstance.post<ProductUnit>("/product-unit", {
                product_unit_name: productUnitName,
            });
            return response.data;
        } catch (error) {
            console.error("Error creating product unit:", error);
            throw error;
        }
    };

    updateProductUnit = async (
        productUnitId: number,
        productUnitName: string
    ): Promise<ProductUnit> => {
        try {
            const response = await axiosInstance.patch<ProductUnit>(`/product-unit/${productUnitId}`, {
                product_unit_name: productUnitName,
            });
            return response.data;
        }
        catch (error) {
            console.error("Error updating product unit:", error);
            throw error;
        }
    };

    deleteProductUnit = async (productUnitId: number): Promise<void> => {
        try {
            await axiosInstance.delete(`/product-unit/${productUnitId}`);
        } catch (error) {
            console.error("Error deleting product unit:", error);
            throw error;
        }
    };
}