import { useEffect, useState } from 'react';
import { UpdateColorDto } from '@/types/color';
import ColorModel from '@/models/color';
import ActionResultDialog from '@/components/ActionResultDialog';
import Modal from '@/components/Modal';

interface UpdateColorFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialData: UpdateColorDto;
}

export default function UpdateColorForm({ isOpen, onClose, onSuccess, initialData }: UpdateColorFormProps) {
    const [formData, setFormData] = useState<UpdateColorDto>(initialData);
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
            // Reset form when opened
            setFormData(initialData);
            setError(null);
            setResultDialog((prev) => ({ ...prev, isOpen: false }));
        }
    }, [isOpen, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            // Validate inputs
            if (!formData.color_name?.trim()) {
                setError('กรุณากรอกชื่อสี');
                setLoading(false);
                return;
            }
            if (formData.color_hex && !formData.color_hex.match(/^#[0-9A-F]{6}$/i)) {
                setError('รูปแบบรหัสสี HEX ไม่ถูกต้อง');
                setLoading(false);
                return;
            }
            const colorModel = new ColorModel();
            // Assuming updateColor method exists in ColorModel
            await colorModel.updateColor(formData);
            setResultDialog({
                isOpen: true,
                status: 'success',
                message: 'บันทึกข้อมูลสีสำเร็จ',
            });
        } catch (err: any) {
            setResultDialog({
                isOpen: true,
                status: 'error',
                message: err?.message || 'เกิดข้อผิดพลาดในการอัปเดตสี',
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
                title="แก้ไขสี"
                size="md"
                closeOnBackdrop={!loading && !resultDialog.isOpen}
                closeOnEscape={!loading && !resultDialog.isOpen}
                footer={
                    <>
                        <button type="button" onClick={onClose} disabled={loading} className="ka-btn">
                            ยกเลิก
                        </button>
                        <button type="submit" form="update-color-form" disabled={loading} className="ka-btn ka-btn--primary">
                            {loading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    กำลังบันทึก...
                                </>
                            ) : (
                                'บันทึกข้อมูล'
                            )}
                        </button>
                    </>
                }
            >
                <form id="update-color-form" onSubmit={handleSubmit} className="space-y-4">
                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-[var(--danger-soft)] border border-[var(--danger)] rounded-lg">
                            <p className="text-sm text-[var(--danger)]">{error}</p>
                        </div>
                    )}

                    {/* Color Name Field */}
                    <div>
                        <label htmlFor="color_name" className="block text-sm font-medium text-[var(--ink)] mb-2">
                            ชื่อสี
                        </label>
                        <input
                            id="color_name"
                            type="text"
                            name="color_name"
                            value={formData.color_name}
                            onChange={handleChange}
                            placeholder="เช่น สีแดง, สีน้ำเงิน"
                            className="ka-input"
                            disabled={loading}
                        />
                    </div>

                    {/* Color Picker Field */}
                    <div>
                        <label htmlFor="hexCode" className="block text-sm font-medium text-[var(--ink)] mb-2">
                            รหัสสี (HEX)
                        </label>
                        <div className="flex gap-3">
                            <input
                                id="hexCode"
                                type="color"
                                name="color_hex"
                                value={formData.color_hex}
                                onChange={handleChange}
                                className="w-14 h-10 border border-[var(--border-control)] bg-[var(--bg-surface)] rounded-lg cursor-pointer"
                                disabled={loading}
                            />
                            <input
                                type="text"
                                name="color_hex"
                                value={formData.color_hex}
                                onChange={handleChange}
                                placeholder="#000000"
                                className="ka-input min-w-0 flex-1 font-mono"
                                disabled={loading}
                            />
                        </div>
                        <p className="text-[13px] text-[var(--ink-muted)] mt-1">
                            ตัวอย่าง: #FF0000 (สีแดง), #0000FF (สีน้ำเงิน), #00FF00 (สีเขียว)
                        </p>
                    </div>

                    {/* Preview */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--ink)] mb-2">
                            ตัวอย่างสี
                        </label>
                        <div
                            className="w-full h-20 rounded-lg border-2 border-[var(--border-control)] shadow-sm transition-colors"
                            style={{ backgroundColor: formData.color_hex }}
                        ></div>
                    </div>
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
    );
}
