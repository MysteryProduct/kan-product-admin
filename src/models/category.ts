import axiosInstance from '@/lib/axios';
import { Category,CategoryResponse,UpdateCategoryDto } from '@/types/category';
export default class CategoryModel {
    getCategories = async (
        page: number = 1,
        limit: number = 10,
        search?: string
    ): Promise<CategoryResponse> => {
        try {
            const response = await axiosInstance.get<CategoryResponse>('/category/', {
                params: {
                    page,
                    limit,
                    ...(search && { search }),
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }
    };
    createCategory = async (category_name: string) => {
        try {
            const response = await axiosInstance.post('/category/', { category_name });
            return response.data;
        } catch (error) {
            console.error('Error creating category:', error);
            throw error;
        }
    }

    updateCategory = async (category: UpdateCategoryDto) => {
        try {
            const response = await axiosInstance.patch(`/category/${category.category_id}`, { category_name: category.category_name });
            return response.data;
        } catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    }

    deleteCategory = async (category_id: number) => {
        try {
            const response = await axiosInstance.delete(`/category/${category_id}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    }
}