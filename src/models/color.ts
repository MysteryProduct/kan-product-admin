import axiosInstance from '@/lib/axios';

// Interface สำหรับ Color
export interface Color {
    id: string | number;
    name: string;
    hexCode: string;
    status: 'Active' | 'Inactive';
    createdAt?: string;
    updatedAt?: string;
}

// Interface สำหรับ API Response
export interface ColorResponse {
    data: [];
    // total: number;
    // page: number;
    // limit: number;
}

export interface SingleColorResponse {
    data: Color;
    message?: string;
}

// Interface สำหรับการสร้าง/แก้ไข Color
export interface CreateColorDto {
    name: string;
    hexCode: string;
    status?: 'Active' | 'Inactive';
}

export interface UpdateColorDto {
    name?: string;
    hexCode?: string;
    status?: 'Active' | 'Inactive';
}

// ===== Color API Service =====

/**
 * ดึงข้อมูล Colors ทั้งหมด
 * @param page - หน้าที่ต้องการ (สำหรับ pagination)
 * @param limit - จำนวนรายการต่อหน้า
 * @param search - คำค้นหา (optional)
 */
// export const 

/**
 * ดึงข้อมูล Color ตาม ID
 * @param id - Color ID
 */
export const getColorById = async (id: string | number): Promise<SingleColorResponse> => {
    try {
        const response = await axiosInstance.get<SingleColorResponse>(`/colors/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching color ${id}:`, error);
        throw error;
    }
};

/**
 * สร้าง Color ใหม่
 * @param colorData - ข้อมูล Color ที่ต้องการสร้าง
 */
export const createColor = async (colorData: CreateColorDto): Promise<SingleColorResponse> => {
    try {
        const response = await axiosInstance.post<SingleColorResponse>('/colors', colorData);
        return response.data;
    } catch (error) {
        console.error('Error creating color:', error);
        throw error;
    }
};

/**
 * แก้ไข Color
 * @param id - Color ID
 * @param colorData - ข้อมูลที่ต้องการแก้ไข
 */
export const updateColor = async (
    id: string | number,
    colorData: UpdateColorDto
): Promise<SingleColorResponse> => {
    try {
        const response = await axiosInstance.put<SingleColorResponse>(`/colors/${id}`, colorData);
        return response.data;
    } catch (error) {
        console.error(`Error updating color ${id}:`, error);
        throw error;
    }
};

/**
 * ลบ Color
 * @param id - Color ID ที่ต้องการลบ
 */
export const deleteColor = async (id: string | number): Promise<{ message: string }> => {
    try {
        const response = await axiosInstance.delete<{ message: string }>(`/colors/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting color ${id}:`, error);
        throw error;
    }
};

/**
 * Toggle Color Status (Active/Inactive)
 * @param id - Color ID
 */
export const toggleColorStatus = async (id: string | number): Promise<SingleColorResponse> => {
    try {
        const response = await axiosInstance.patch<SingleColorResponse>(`/colors/${id}/toggle-status`);
        return response.data;
    } catch (error) {
        console.error(`Error toggling color status ${id}:`, error);
        throw error;
    }
};

export default class ColorModel {
    getColors = async (
        page: number = 1,
        limit: number = 10,
        search?: string
    ): Promise<ColorResponse> => {
        try {
            const response = await axiosInstance.get<ColorResponse>('/color/', {
                // params: {
                //     page,
                //     limit,
                //     ...(search && { search }),
                // },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching colors:', error);
            throw error;
        }
    };
};