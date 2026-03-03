import axiosInstance from '@/lib/axios';
import { PaginationMeta } from '@/types/pagination';
import { CreateMaterialDto, Material, UpdateMaterialDto } from '@/types/material';

export interface ApiMaterialResponse {
  data: Material[];
  meta: PaginationMeta;
}

export interface SingleMaterialResponse {
  data: Material;
  message?: string;
}

class MaterialModel {
  async getMaterials(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: 'adddate' | 'material_price' | null,
    sortOrder?: 'ASC' | 'DESC',
    filters?: Record<string, string>,
  ): Promise<ApiMaterialResponse> {
    try {
      const response = await axiosInstance.get<ApiMaterialResponse>('/materials', {
        params: {
          page,
          limit,
          ...(search && { search }),
          ...(sortField && { sortField }),
          ...(sortOrder && { sortOrder }),
          ...(filters && { filters: JSON.stringify(filters) }),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching materials:', error);
      throw error;
    }
  }

  async getMaterialById(id: string): Promise<Material> {
    try {
      const response = await axiosInstance.get<SingleMaterialResponse>(`/materials/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching material ${id}:`, error);
      throw error;
    }
  }

  async createMaterial(materialData: CreateMaterialDto): Promise<Material> {
    try {
      const response = await axiosInstance.post<SingleMaterialResponse>('/materials', materialData);
      return response.data.data;
    } catch (error) {
      console.error('Error creating material:', error);
      throw error;
    }
  }

  async updateMaterial(materialData: UpdateMaterialDto): Promise<Material> {
    try {
      const response = await axiosInstance.patch<SingleMaterialResponse>(
        `/materials/${materialData.material_id}`,
        materialData,
      );
      return response.data.data;
    } catch (error) {
      console.error(`Error updating material ${materialData.material_id}:`, error);
      throw error;
    }
  }

  async deleteMaterial(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/materials/${id}`);
    } catch (error) {
      console.error(`Error deleting material ${id}:`, error);
      throw error;
    }
  }
}

export default MaterialModel;
