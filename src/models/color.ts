import axiosInstance from '@/lib/axios';
import { ColorResponse,CreateColorDto, UpdateColorDto } from '@/types/color';

export default class ColorModel {
    getColors = async (
        page: number = 1,
        limit: number = 10,
        search?: string
    ): Promise<ColorResponse> => {
        try {
            const response = await axiosInstance.get<ColorResponse>('/color/', {
                params: {
                    page,
                    limit,
                    ...(search && { search }),
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching colors:', error);
            throw error;
        }
    };

    // Additional methods for creating, updating, deleting colors can be added here
    async getAllColors(): Promise<ColorResponse> {
        const first = await this.getColors(1, 100);
        const data = [...first.data];
        for (let page = 2; page <= first.meta.last_page; page++) {
            data.push(...(await this.getColors(page, 100)).data);
        }
        return { data, meta: { total: data.length, page: 1, limit: data.length, last_page: data.length ? 1 : 0 } };
    }

    createColor = async (createColorDto: CreateColorDto) => {
        try {
            // Send only the fields the strict API accepts (see tests/api-write-contract.test.mjs).
            const { color_name, color_hex } = createColorDto;
            const response = await axiosInstance.post('/color/', { color_name, color_hex });
            return response.data;
        } catch (error) {
            console.error('Error creating color:', error);
            throw error;
        }
    }

    updateColor = async ({ color_id, color_name, color_hex }: UpdateColorDto) => {
        try {
            const response = await axiosInstance.patch(`/color/${color_id}`, {
                ...(color_name !== undefined && { color_name }),
                ...(color_hex !== undefined && { color_hex }),
            });
            return response.data;
        } catch (error) {
            console.error('Error updating color:', error);
            throw error;
        }
    }

    deleteColor = async (color_id: number) => {
        try {
            const response = await axiosInstance.delete(`/color/${color_id}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting color:', error);
            throw error;
        }
    }
};