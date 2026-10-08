import axiosInstance from '@/lib/axios';
import { CategoryResponse, UpdateCategoryDto } from '@/types/category';

export default class CategoryModel {
    getCategories = async (page = 1, limit = 10, search?: string): Promise<CategoryResponse> => {
        const response = await axiosInstance.get<CategoryResponse>('/category/', {
            params: { page, limit, ...(search && { search }) },
        });
        return {
            ...response.data,
            data: response.data.data.map(category => ({
                ...category,
                size_ids: Array.from(new Set(category.categorySize?.map(relation => relation.size_id) ?? category.size_ids ?? [])),
            })),
        };
    };

    async getAllCategories(): Promise<CategoryResponse> {
        const first = await this.getCategories(1, 100);
        const data = [...first.data];
        for (let page = 2; page <= first.meta.last_page; page++) {
            data.push(...(await this.getCategories(page, 100)).data);
        }
        return { data, meta: { total: data.length, page: 1, limit: data.length, last_page: data.length ? 1 : 0 } };
    }

    createCategory = async (category_name: string, size_ids: number[] = []) => {
        const response = await axiosInstance.post('/category/', { category_name, size_ids });
        return response.data;
    };

    updateCategory = async ({ category_id, category_name, size_ids }: UpdateCategoryDto) => {
        // The API rejects unknown fields, and the form state is a full list row
        // (relations such as `categorySize` included), so send only what it accepts.
        const response = await axiosInstance.patch(`/category/${category_id}`, {
            category_name,
            ...(size_ids !== undefined && { size_ids }),
        });
        return response.data;
    };

    deleteCategory = async (category_id: number) => {
        const response = await axiosInstance.delete(`/category/${category_id}`);
        return response.data;
    };
}
