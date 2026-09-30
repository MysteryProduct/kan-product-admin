'use client';

import { useEffect, useState } from 'react';
import { UpdateCategoryDto } from '@/types/category';
import CategoryModel from '@/models/category';
import ActionResultDialog from '@/components/ActionResultDialog';
import SizeModel from '@/models/size';
import { Size } from '@/types/size';
import LoadErrorBanner, { failedLabels, partialLoadText } from '@/components/LoadErrorBanner';
import Modal from '@/components/Modal';

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
    const [loadError, setLoadError] = useState<string | null>(null);
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
                // One failing request must not hide the other, and the person needs to know which one is missing.
                setLoadError(null);
                const results = await Promise.allSettled([
                    sizeModel.getSizes(1, 200),
                    categoryModel.getCategorySizeIds(initialData.category_id),
                ]);
                const [sizeResponse, selectedSizeIds] = results;

                if (sizeResponse.status === 'fulfilled') setSizes(sizeResponse.value.data);
                // Without the saved relation the sizes the category came with stay ticked.
                if (selectedSizeIds.status === 'fulfilled') {
                    setFormData((prev) => ({
                        ...prev,
                        size_ids: selectedSizeIds.value,
                    }));
                }

                const failed = failedLabels(results, ['ขนาด', 'ขนาดที่เลือกไว้เดิม']);
                if (failed.length > 0) {
                    console.error('Error fetching update category form data:', results);
                    setLoadError(partialLoadText(failed));
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
    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="อัปเดตประเภทสินค้า"
                size="lg"
                closeOnBackdrop={!loading && !resultDialog.isOpen}
                closeOnEscape={!loading && !resultDialog.isOpen}
                footer={
                    <>
                        <button
                            type="button"
                            onClick={onClose}
                            className="ka-btn"
                            disabled={loading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            form="update-category-form"
                            className="ka-btn ka-btn--primary"
                            disabled={loading}
                        >
                            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </>
                }
            >
                <form id="update-category-form" onSubmit={handleSubmit} className="space-y-4">
                    <LoadErrorBanner message={loadError} />
                    <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="category_name">
                            ชื่อประเภทสินค้า
                        </label>
                        <input
                            type="text"
                            id="category_name"
                            name="category_name"
                            value={formData.category_name}
                            onChange={handleChange}
                            className="ka-input"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                            Size ที่เชื่อมโยง
                        </label>
                        <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3 sm:grid-cols-2">
                            {sizes.length > 0 ? (
                                sizes.map((size) => (
                                    <label
                                        key={size.size_id}
                                        className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)]"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={Boolean(formData.size_ids?.includes(size.size_id))}
                                            onChange={() => toggleSize(size.size_id)}
                                            className="ka-check"
                                            disabled={loading}
                                        />
                                        {size.size_name}
                                    </label>
                                ))
                            ) : (
                                <span className="text-sm text-[var(--ink-muted)]">ไม่พบรายการ Size</span>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-[var(--danger-soft)] border border-[var(--danger)] rounded-lg mt-3 mb-2">
                            <p className="text-sm text-[var(--danger)]">{error}</p>
                        </div>
                    )}
                </form>
            </Modal>

            <ActionResultDialog
                isOpen={resultDialog.isOpen}
                status={resultDialog.status}
                action="update"
                message={resultDialog.message}
                onClose={handleResultDialogClose}
            />
        </>
    )
}
