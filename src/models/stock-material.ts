import axiosInstance from '@/lib/axios';

interface ProductMaterial {
    material_id: string;
    material_qty: number;
}
class StockMaterialModel {
    async checkStockBeforeProduce(materialId: ProductMaterial[], targetValue: number) {
        try {
            const response = await axiosInstance.post('/stock-materials/checkStockBeforeProduce', {
                materials: materialId,
                targetValue,
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    }
}
export default StockMaterialModel;