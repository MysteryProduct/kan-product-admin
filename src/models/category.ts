import axiosInstance from '@/lib/axios';
import { Category,CategoryResponse,UpdateCategoryDto } from '@/types/category';

export default class CategoryModel {
    private getEntity<T>(payload: unknown): T {
        if (payload && typeof payload === 'object' && 'data' in payload) {
            return (payload as { data: T }).data;
        }

        return payload as T;
    }

    private getSizeIdsFromPayload(payload: unknown): number[] {
        if (!payload || typeof payload !== 'object') {
            return [];
        }

        const container = payload as {
            size_ids?: unknown;
            data?: unknown;
        };

        if (Array.isArray(container.size_ids)) {
            return container.size_ids
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id));
        }

        if (!Array.isArray(container.data)) {
            return [];
        }

        return container.data
            .map((item) => {
                if (item && typeof item === 'object') {
                    const row = item as {
                        size_id?: unknown;
                        size?: { size_id?: unknown };
                    };

                    const directSizeId = Number(row.size_id);
                    const nestedSizeId = Number(row.size?.size_id);

                    if (Number.isFinite(directSizeId)) {
                        return directSizeId;
                    }

                    if (Number.isFinite(nestedSizeId)) {
                        return nestedSizeId;
                    }
                }

                return NaN;
            })
            .filter((id) => Number.isFinite(id));
    }

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

    createCategory = async (category_name: string, size_ids: number[] = []) => {
        try {
            const response = await axiosInstance.post('/category/', { category_name });

            const createdCategory = this.getEntity<Category>(response.data);

            if (createdCategory?.category_id && size_ids.length > 0) {
                await this.syncCategorySizes(createdCategory.category_id, size_ids);
            }

            return response.data;
        } catch (error) {
            console.error('Error creating category:', error);
            throw error;
        }
    }

    updateCategory = async (category: UpdateCategoryDto) => {
        try {
            const response = await axiosInstance.patch(`/category/${category.category_id}`, { category_name: category.category_name });

            if (Array.isArray(category.size_ids)) {
                await this.syncCategorySizes(category.category_id, category.size_ids);
            }

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

    getCategorySizeIds = async (category_id: number): Promise<number[]> => {
        try {
            const response = await axiosInstance.get<unknown>('/category-size/', {
                params: { category_id },
            });
            const payload = response.data;

            return Array.from(new Set(this.getSizeIdsFromPayload(payload)));
        } catch (error) {
            console.error('Error fetching category sizes:', error);
            return [];
        }
    }

    syncCategorySizes = async (category_id: number, size_ids: number[]): Promise<void> => {
        const uniqueSizeIds = Array.from(
            new Set(size_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))
        );

        try {
            await axiosInstance.post('/category-size/', {
                category_id,
                size_ids: uniqueSizeIds,
            });
        } catch (error) {
            console.error('Error syncing category-size relation:', error);
            throw error;
        }
    }
}