import axiosInstance from '@/lib/axios';
import { AppSettings, UpdateSettingsDto } from '@/types/settings';

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

  async updateSettings(payload: UpdateSettingsDto): Promise<AppSettings> {
    try {
      const response = await axiosInstance.patch<AppSettings | SettingsPayload>(`/settings/${payload.setting_id}`, payload);
      const data = response.data as AppSettings | SettingsPayload;
      if (data && typeof data === 'object' && 'data' in data) {
        const normalized = data.data;
        return Array.isArray(normalized) ? normalized[0] : normalized;
      }
      return data as AppSettings;
    } catch (error) {
      throw error;
    }
  }
}

export default SettingsModel;
