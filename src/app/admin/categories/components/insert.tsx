'use client';

import { useEffect, useState } from 'react';
import { CreateCategoryDto } from '@/types/category';
import CategoryModel from '@/models/category';

interface CategoryFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function CategoryForm({ isOpen, onClose, onSuccess }: CategoryFormProps) {
    const [formData, setFormData] = useState({
        category_name: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset form when opened
            setFormData({
                category_name: '',
            });
            setError(null);
            setSuccess(false);
        }
    }, [isOpen]);
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
            if (!formData.category_name.trim()) {
                setError('กรุณากรอกชื่อประเภทสินค้า');
                setLoading(false);
                return;
            }
            const categoryModel = new CategoryModel();
            await categoryModel.createCategory(formData.category_name);
            setSuccess(true);
            setLoading(false);
            setTimeout(() => {
                onClose();
                onSuccess?.();
            }, 1000);
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการสร้างประเภทสินค้า');
            setLoading(false);
        }
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-300/40 bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                <h2 className="text-xl text-gray-700 font-semibold mb-4">เพิ่มประเภทสินค้า</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="category_name">
                            ชื่อประเภทสินค้า
                        </label>
                        <input
                            type="text"
                            id="category_name"
                            name="category_name"
                            value={formData.category_name}
                            onChange={handleChange}
                            className="w-full text-gray-700 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-300"
                            disabled={loading}
                            required
                        />
                    </div>
                    {success && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-3 mb-2">
                            <p className="text-sm text-green-800">บันทึกข้อมูลประเภทสินค้าสำเร็จ</p>
                        </div>
                    )}

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
                            className="mr-4 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                            disabled={loading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            disabled={loading}
                        >
                            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
