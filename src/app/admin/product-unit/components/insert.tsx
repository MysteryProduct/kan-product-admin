'use client';
import { useState } from 'react';
import { ProductUnit } from '@/types/product-unit';
import { ProductUnitModel } from '@/models/product-unit';
import ActionResultDialog from '@/components/ActionResultDialog';
import Modal from '@/components/Modal';

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

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="เพิ่มหน่วยสินค้า"
                size="md"
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
                            form="insert-product-unit-form"
                            className="ka-btn ka-btn--primary"
                            disabled={loading}
                        >
                            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </>
                }
            >
                <form id="insert-product-unit-form" onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-[var(--ink)] mb-2" htmlFor="unit_name">
                            ชื่อหน่วยสินค้า
                        </label>
                        <input
                            type="text"
                            id="unit_name"
                            name="unit_name"
                            value={formData.unit_name}
                            onChange={handleChange}
                            className="ka-input"
                        />
                    </div>
                    {/* Error Message */}
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
                action="insert"
                message={resultDialog.message}
                onClose={handleResultDialogClose}
            />
        </>
    );
}
