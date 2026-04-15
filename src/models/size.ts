import axiosInstance from '@/lib/axios';
import { PaginationMeta } from '@/types/pagination';
import type { Category } from '@/types/category';
import { CreateSizeDto, Size, SizeCategoryRelation, SizeResponse, UpdateSizeDto } from '@/types/size';

export default class SizeModel {
    private getEntity<T>(payload: unknown): T {
        if (payload && typeof payload === 'object' && 'data' in payload) {
            return (payload as { data: T }).data;
        }

        return payload as T;
    }

    private toPaginationMeta(total: number): PaginationMeta {
        return {
            total,
            page: 1,
            last_page: 1,
            limit: total,
        };
    }

    private toPaginatedResponse(payload: unknown): SizeResponse {
        if (
            payload &&
            typeof payload === 'object' &&
            'data' in payload &&
            Array.isArray((payload as { data: unknown }).data) &&
            'meta' in payload
        ) {
            return payload as SizeResponse;
        }

        if (
            payload &&
            typeof payload === 'object' &&
            'data' in payload &&
            Array.isArray((payload as { data: unknown }).data)
        ) {
            const list = (payload as { data: Size[] }).data;
            return {
                data: list,
                meta: this.toPaginationMeta(list.length),
            };
        }

        if (Array.isArray(payload)) {
            return {
                data: payload as Size[],
                meta: this.toPaginationMeta(payload.length),
            };
        }

        return {
            data: [],
            meta: this.toPaginationMeta(0),
        };
    }

    private getCategoryIdsFromPayload(payload: unknown): number[] {
        if (!payload || typeof payload !== 'object') {
            return [];
        }

        const container = payload as {
            category_ids?: unknown;
            data?: unknown;
        };

        if (Array.isArray(container.category_ids)) {
            return container.category_ids
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
                        category_id?: unknown;
                        category?: { category_id?: unknown };
                    };
                    const directId = Number(row.category_id);
                    const nestedId = Number(row.category?.category_id);

                    if (Number.isFinite(directId)) {
                        return directId;
                    }

                    if (Number.isFinite(nestedId)) {
                        return nestedId;
                    }
                }

                return NaN;
            })
            .filter((id) => Number.isFinite(id));
    }

    private getCategoriesFromPayload(payload: unknown): Category[] {
        if (!payload || typeof payload !== 'object') {
            return [];
        }

        const container = payload as {
            category?: unknown;
            data?: unknown;
        };

        if (Array.isArray(container.category)) {
            return container.category as Category[];
        }

        if (!Array.isArray(container.data)) {
            return [];
        }

        return container.data
            .map((item) => {
                if (item && typeof item === 'object') {
                    const row = item as {
                        category?: Category;
                        category_id?: unknown;
                        category_name?: unknown;
                    };

                    if (row.category) {
                        return row.category;
                    }

                    const categoryId = Number(row.category_id);
                    const categoryName =
                        typeof row.category_name === 'string' ? row.category_name : '';

                    if (Number.isFinite(categoryId)) {
                        return {
                            category_id: categoryId,
                            category_name: categoryName,
                        } as Category;
                    }
                }

                return null;
            })
            .filter((item): item is Category => item !== null);
    }


    async getSizes(page: number = 1, limit: number = 10, search?: string): Promise<SizeResponse> {
        const response = await axiosInstance.get<unknown>('/sizes/', {
            params: {
                page,
                limit,
                ...(search && { search }),
            },
        });
        const payload = response.data;

        return this.toPaginatedResponse(payload);
    }

    async createSize(payload: CreateSizeDto): Promise<Size> {
        const response = await axiosInstance.post<unknown>('/sizes/', {
            size_name: payload.size_name,
        });
        const createdPayload = response.data;

        const createdSize = this.getEntity<Size>(createdPayload);

        if (createdSize?.size_id && payload.category_ids) {
            await this.syncSizeCategories(createdSize.size_id, payload.category_ids);
        }

        return createdSize;
    }

    async updateSize(payload: UpdateSizeDto): Promise<Size> {
        const response = await axiosInstance.patch<unknown>(`/sizes/${payload.size_id}`, {
            size_name: payload.size_name,
        });
        const updatedPayload = response.data;

        if (payload.category_ids) {
            await this.syncSizeCategories(payload.size_id, payload.category_ids);
        }

        return this.getEntity<Size>(updatedPayload);
    }

    async deleteSize(sizeId: number): Promise<void> {
        await axiosInstance.delete(`/sizes/${sizeId}`);
    }

    async getCategoryRelationsBySize(sizeId: number): Promise<SizeCategoryRelation> {
        const response = await axiosInstance.get<SizeCategoryRelation>(`/category-size/${sizeId}`, {
            params: { size_id: sizeId },
        });
        
        const payload = response.data;
        
        return {
            category_ids: payload.category_ids,
            category: payload.category,
        };
    }

    async syncSizeCategories(sizeId: number, categoryIds: number[]): Promise<void> {
        const uniqueCategoryIds = Array.from(
            new Set(categoryIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))
        );
        await axiosInstance.delete(`/category-size/${sizeId}`, {});
        await axiosInstance.post('/category-size/', {
            size_id: sizeId,
            category_ids: uniqueCategoryIds,
        });
    }
}
