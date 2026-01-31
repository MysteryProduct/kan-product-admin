import axiosInstance from "@/lib/axios";
import { Stock } from "@/types/stock";

// Interface สำหรับ API Response
export interface ApiStockResponse {
  data: Stock[];
}

// ===== Stock API Service =====

export default class StockModel {
    /** ดึงข้อมูล Stock status ทั้งหมด */
    async getStockStatuses() {
        try {
            const response = await axiosInstance.get('/stocks/count-status');
            return response.data;
        } catch (error) {
            console.error('Error fetching stock statuses:', error);
            throw error;
        }
    }
}