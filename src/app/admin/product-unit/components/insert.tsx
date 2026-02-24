'use client';
import { useState } from 'react';
import { ProductUnit } from '@/types/product-unit';
import { ProductUnitModel } from '@/models/product-unit';
import ActionResultDialog from '@/components/ActionResultDialog';

const productUnitModel = new ProductUnitModel();
interface ProductUnitFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function ProductUnitForm({ isOpen, onClose, onSuccess }: ProductUnitFormProps) {
    const [formData, setFormData] = useState({
        unit_name: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultDialog, setResultDialog] = useState<{
        isOpen: boolean;
        status: 'success' | 'error';
        message: string;
    }>({
        isOpen: false,
        status: 'success',
        message: '',
    });

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
        setLoading(true);
        try {
            // Validate inputs
            if (!formData.unit_name.trim()) {
                setError('กรุณากรอกชื่อหน่วยสินค้า');
                setLoading(false);
                return;
            }
            await productUnitModel.createProductUnit(formData.unit_name);
            setResultDialog({
                isOpen: true,
                status: 'success',
                message: 'บันทึกข้อมูลหน่วยสินค้าสำเร็จ',
            });
        } catch (err: any) {
            setResultDialog({
                isOpen: true,
                status: 'error',
                message: err?.message || 'เกิดข้อผิดพลาดในการสร้างหน่วยสินค้า',
            });
        } finally {
            setLoading(false);
        }
    }

    const handleResultDialogClose = () => {
        const isSuccess = resultDialog.status === 'success';
        setResultDialog((prev) => ({ ...prev, isOpen: false }));

        if (isSuccess) {
            onClose();
            onSuccess?.();
        }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed  inset-0 flex items-center justify-center bg-gray-400/40 bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">เพิ่มหน่วยสินค้า</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="unit_name">
                            ชื่อหน่วยสินค้า
                        </label>
                        <input
                            type="text"
                            id="unit_name"
                            name="unit_name"
                            value={formData.unit_name}
                            onChange={handleChange}
                            className="w-full text-gray-600 px-3 py-2 border border-gray-300 rounded"
                        />
                    </div>
                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-3 mb-2">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="mr-4 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            disabled={loading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            disabled={loading}
                        >
                            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
            <ActionResultDialog
                isOpen={resultDialog.isOpen}
                status={resultDialog.status}
                action="insert"
                message={resultDialog.message}
                onClose={handleResultDialogClose}
            />
        </div>
    );
}