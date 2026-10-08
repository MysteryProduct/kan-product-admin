import axiosInstance from '@/lib/axios';
import { CreateSizeDto, Size, SizeCategoryRelation, SizeResponse, UpdateSizeDto } from '@/types/size';

export default class SizeModel {
    private getEntity<T>(payload: T | { data: T }): T {
        return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload as T;
    }

    async getSizes(page = 1, limit = 10, search?: string): Promise<SizeResponse> {
        const response = await axiosInstance.get<SizeResponse>('/sizes/', {
            params: { page, limit, ...(search && { search }) },
        });
        return response.data;
    }

    // Option lists must not send an illegal limit or silently drop sizes after the first page.
    async getAllSizes(): Promise<SizeResponse> {
        const first = await this.getSizes(1, 100);
        const data = [...first.data];
        for (let page = 2; page <= first.meta.last_page; page++) {
            data.push(...(await this.getSizes(page, 100)).data);
        }
        return { data, meta: { total: data.length, page: 1, limit: data.length, last_page: data.length ? 1 : 0 } };
    }

    async createSize(payload: CreateSizeDto): Promise<Size> {
        const response = await axiosInstance.post<Size | { data: Size }>('/sizes/', payload);
        return this.getEntity(response.data);
    }

    async updateSize({ size_id, ...payload }: UpdateSizeDto): Promise<Size> {
        const response = await axiosInstance.patch<Size | { data: Size }>(`/sizes/${size_id}`, payload);
        return this.getEntity(response.data);
    }

    async deleteSize(sizeId: number): Promise<void> {
        await axiosInstance.delete(`/sizes/${sizeId}`);
    }

    async getCategoryRelationsBySize(sizeId: number): Promise<SizeCategoryRelation> {
        const response = await axiosInstance.get<Size | { data: Size }>(`/sizes/${sizeId}`);
        const size = this.getEntity(response.data);
        return { category_ids: size.category_ids ?? [], category: size.category ?? [] };
    }
}
