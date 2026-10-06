import axiosInstance from '@/lib/axios';
import { AppSettings, CreateSettingsDto, UpdateSettingsDto } from '@/types/settings';

interface SettingsPayload {
  data?: AppSettings | AppSettings[];
}

class SettingsModel {
  async getSettings(): Promise<AppSettings | null> {
    try {
      const response = await axiosInstance.get<AppSettings | SettingsPayload>('/settings');
      const payload = response.data as AppSettings | SettingsPayload;
      
      if (payload && typeof payload === 'object' && 'data' in payload) {
        const data = payload.data;
        if (Array.isArray(data)) {
          
          return data[0] || null;
        }
        return data || null;
      }

      return payload as AppSettings;
    } catch (error) {
      throw error;
    }
  }

  // Used only when the database has no settings row yet; afterwards the row is edited.
  async createSettings(payload: CreateSettingsDto): Promise<AppSettings> {
    const response = await axiosInstance.post<AppSettings | SettingsPayload>('/settings', payload);
    const data = response.data as AppSettings | SettingsPayload;
    if (data && typeof data === 'object' && 'data' in data) {
      const normalized = data.data;
      const settings = Array.isArray(normalized) ? normalized[0] : normalized;
      if (!settings) throw new Error('API ไม่ได้ส่งข้อมูลการตั้งค่าที่บันทึกกลับมา');
      return settings;
    }
    return data as AppSettings;
  }

  async updateSettings(payload: UpdateSettingsDto): Promise<AppSettings> {
    try {
      const response = await axiosInstance.patch<AppSettings | SettingsPayload>(`/settings/${payload.setting_id}`, payload);
      const data = response.data as AppSettings | SettingsPayload;
      if (data && typeof data === 'object' && 'data' in data) {
        const normalized = data.data;
        const settings = Array.isArray(normalized) ? normalized[0] : normalized;
        if (!settings) throw new Error('API ไม่ได้ส่งข้อมูลการตั้งค่าที่บันทึกกลับมา');
        return settings;
      }
      return data as AppSettings;
    } catch (error) {
      throw error;
    }
  }
}

export default SettingsModel;
