'use client';

import { useEffect, useState } from 'react';
import { UpdateCategoryDto } from '@/types/category';
import CategoryModel from '@/models/category';
import ActionResultDialog from '@/components/ActionResultDialog';
import SizeModel from '@/models/size';
import { Size } from '@/types/size';

interface CategoryFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialData: UpdateCategoryDto;
}

export default function UpdateCategoryForm({ isOpen, onClose, onSuccess, initialData }: CategoryFormProps) {
    const [formData, setFormData] = useState<UpdateCategoryDto>({
        category_id: 0,
        category_name: '',
        size_ids: [],
    });
    const [sizes, setSizes] = useState<Size[]>([]);
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
    useEffect(() => {
        if (isOpen) {
            setFormData({
                ...initialData,
                size_ids: initialData.size_ids ?? [],
            });
            setError(null);
            setResultDialog((prev) => ({ ...prev, isOpen: false }));

            const fetchFormData = async () => {
                const sizeModel = new SizeModel();
                const categoryModel = new CategoryModel();
                try {
                    const [sizeResponse, selectedSizeIds] = await Promise.all([
                        sizeModel.getSizes(1, 200),
                        categoryModel.getCategorySizeIds(initialData.category_id),
                    ]);

                    setSizes(sizeResponse.data);
                    setFormData((prev) => ({
                        ...prev,
                        size_ids: selectedSizeIds,
                    }));
                } catch (fetchError) {
                    console.error('Error fetching update category form data:', fetchError);
                    setSizes([]);
                }
            };

            fetchFormData();
        }
    }, [isOpen, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    const toggleSize = (sizeId: number) => {
        setFormData((prev) => ({
            ...prev,
            size_ids: prev.size_ids?.includes(sizeId)
                ? prev.size_ids.filter((id) => id !== sizeId)
                : [...(prev.size_ids || []), sizeId],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (!formData.category_name.trim()) {
                setError('กรุณากรอกชื่อประเภทสินค้า');
                setLoading(false);
                return;
            }
            const categoryModel = new CategoryModel();
            await categoryModel.updateCategory(formData);
            setResultDialog({
                isOpen: true,
                status: 'success',
                message: 'อัปเดตข้อมูลประเภทสินค้าสำเร็จ',
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปเดตประเภทสินค้า';
            setResultDialog({
                isOpen: true,
                status: 'error',
                message,
            });
        } finally {
            setLoading(false);
        }
    };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-semibold text-gray-700 dark:text-gray-100">อัปเดตประเภทสินค้า</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-gray-700 dark:text-gray-200" htmlFor="category_name">
                            ชื่อประเภทสินค้า
                        </label>
                        <input
                            type="text"
                            id="category_name"
                            name="category_name"
                            value={formData.category_name}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-700 focus:border-blue-300 focus:outline-none focus:ring dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-gray-700 dark:text-gray-200">
                            Size ที่เชื่อมโยง
                        </label>
                        <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 sm:grid-cols-2">
                            {sizes.length > 0 ? (
                                sizes.map((size) => (
                                    <label
                                        key={size.size_id}
                                        className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={Boolean(formData.size_ids?.includes(size.size_id))}
                                            onChange={() => toggleSize(size.size_id)}
                                            disabled={loading}
                                        />
                                        {size.size_name}
                                    </label>
                                ))
                            ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400">ไม่พบรายการ Size</span>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-3 mb-2">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
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

            <ActionResultDialog
                isOpen={resultDialog.isOpen}
                status={resultDialog.status}
                action="update"
                message={resultDialog.message}
                onClose={handleResultDialogClose}
            />
        </div>
    )
}
