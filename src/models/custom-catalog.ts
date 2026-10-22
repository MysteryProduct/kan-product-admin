import axiosInstance from '@/lib/axios';
import { ProductUnitModel } from '@/models/product-unit';
import MaterialModel from '@/models/material';
import type { ProductUnit } from '@/types/product-unit';
import type {
  CustomProductType,
  CustomTemplateHead,
  CustomTemplateSummary,
  RevisionDetail,
} from '@/types/custom-catalog';

const BASE = '/custom-catalog';

export interface MaterialChoice {
  material_id: string;
  material_code: string;
  material_name: string;
}

class CustomCatalogModel {
  async getTypes(): Promise<CustomProductType[]> {
    return (await axiosInstance.get<CustomProductType[]>(`${BASE}/types`)).data;
  }

  async createType(data: { type_code: string; type_name: string; sale_unit?: string }) {
    return (await axiosInstance.post<CustomProductType>(`${BASE}/types`, data)).data;
  }

  async updateType(id: string, data: { type_name?: string; sale_unit?: string; is_active?: boolean }) {
    return (await axiosInstance.patch<CustomProductType>(`${BASE}/types/${id}`, data)).data;
  }

  async getTemplates(): Promise<CustomTemplateSummary[]> {
    return (await axiosInstance.get<CustomTemplateSummary[]>(`${BASE}/templates`)).data;
  }

  async createTemplate(data: { template_code: string; custom_product_type_id: string; template_name: string }) {
    return (await axiosInstance.post<{ custom_template_id: string; revision: number }>(`${BASE}/templates`, data)).data;
  }

  async getTemplate(id: string): Promise<CustomTemplateHead> {
    return (await axiosInstance.get<CustomTemplateHead>(`${BASE}/templates/${id}`)).data;
  }

  async getRevision(id: string, revision: number): Promise<RevisionDetail> {
    return (await axiosInstance.get<RevisionDetail>(`${BASE}/templates/${id}/revisions/${revision}`)).data;
  }

  async createDraft(id: string) {
    return (await axiosInstance.post<{ revision: number }>(`${BASE}/templates/${id}/revisions`)).data;
  }

  async saveDraft(id: string, revision: number, body: unknown): Promise<RevisionDetail> {
    return (await axiosInstance.put<RevisionDetail>(`${BASE}/templates/${id}/revisions/${revision}`, body)).data;
  }

  async discardDraft(id: string, revision: number) {
    await axiosInstance.delete(`${BASE}/templates/${id}/revisions/${revision}`);
  }

  /** One GLB for a draft; the API reads the file itself and keeps it on its own disk. */
  async uploadModel(id: string, revision: number, file: File): Promise<RevisionDetail> {
    const body = new FormData();
    body.append('file', file);
    // Up to 15 MB, so the shared 10 s limit is too short on a slow line.
    return (
      await axiosInstance.post<RevisionDetail>(`${BASE}/templates/${id}/revisions/${revision}/model`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      })
    ).data;
  }

  async deleteModel(id: string, revision: number): Promise<RevisionDetail> {
    return (await axiosInstance.delete<RevisionDetail>(`${BASE}/templates/${id}/revisions/${revision}/model`)).data;
  }

  /** The stored GLB (staff may read a draft's), as bytes for the preview. */
  async getModelBytes(id: string, revision: number): Promise<ArrayBuffer> {
    return (
      await axiosInstance.get<ArrayBuffer>(`${BASE}/templates/${id}/revisions/${revision}/model`, { responseType: 'arraybuffer', timeout: 120_000 })
    ).data;
  }

  async publish(id: string, revision: number): Promise<RevisionDetail> {
    return (await axiosInstance.post<RevisionDetail>(`${BASE}/templates/${id}/revisions/${revision}/publish`)).data;
  }

  /** Every material, page by page, so the recipe picker never drops one. */
  async getMaterialChoices(): Promise<MaterialChoice[]> {
    const model = new MaterialModel();
    const out: MaterialChoice[] = [];
    let page = 1;
    for (;;) {
      const response = await model.getMaterials(page, 100);
      for (const m of response.data) {
        out.push({ material_id: m.material_id, material_code: m.material_code ?? '', material_name: m.material_name });
      }
      if (page >= response.meta.last_page) break;
      page += 1;
    }
    return out;
  }

  async getUnitChoices(): Promise<ProductUnit[]> {
    return (await new ProductUnitModel().getAllProductUnits()).data;
  }
}

export default CustomCatalogModel;
