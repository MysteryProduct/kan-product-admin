'use client';
import { useEffect, useState } from 'react';
import { ProductUnit } from '@/types/product-unit';
import { ProductUnitModel } from '@/models/product-unit';

const productUnitModel = new ProductUnitModel();

interface UpdateProductUnitFormProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: ProductUnit;
    onSuccess?: () => void;
}

export default function UpdateProductUnitForm({ isOpen, onClose, initialData, onSuccess }: UpdateProductUnitFormProps) {
    const [formData, setFormData] = useState({
        product_unit_name:  '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    useEffect(() => {
        if (isOpen) {
            // Reset form when opened
            setFormData(initialData);
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, initialData]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    }
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);
        setLoading(true);
        try {
            // Validate inputs
            if (!formData.product_unit_name.trim()) {
                setError('กรุณากรอกชื่อหน่วยสินค้า');
                setLoading(false);
                return;
            }
            if (initialData) {
                await productUnitModel.updateProductUnit(initialData.product_unit_id, formData.product_unit_name);
                setSuccess(true);
                setLoading(false);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                    onSuccess?.();
                }, 1000);
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการอัปเดตหน่วยสินค้า');
            setLoading(false);
        }
    }
    if (!isOpen) return null;
    return (
        <div className="fixed  inset-0 flex items-center justify-center bg-gray-400/40 bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">แก้ไขหน่วยสินค้า</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="product_unit_name" className="block text-gray-700 font-medium mb-2">
                            ชื่อหน่วยสินค้า
                        </label>
                        <input
                            type="text"
                            id="product_unit_name"
                            name="product_unit_name"
                            value={formData.product_unit_name}
                            onChange={handleChange}
                            className="w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                        />
                    </div>
                    {success && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-3 mb-2">
                            <p className="text-sm text-green-800">แก้ไขข้อมูลหน่วยสินค้าสำเร็จ</p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-3 mb-2">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}
                    <div className="flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                            disabled={loading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            disabled={loading}
                        >
                            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}