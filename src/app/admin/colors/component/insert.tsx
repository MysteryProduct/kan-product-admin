'use client';

import { useEffect, useState } from 'react';
import { CreateColorDto } from '@/types/color';
import ColorModel from '@/models/color';
import ActionResultDialog from '@/components/ActionResultDialog';
import Modal from '@/components/Modal';

interface ColorFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ColorForm({ isOpen, onClose, onSuccess }: ColorFormProps) {
  const [formData, setFormData] = useState({
    color_name: '',
    color_hex: '#000000',
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

  useEffect(() => {
    if (isOpen) {
      // Reset form when opened
      setFormData({
        color_name: '',
        color_hex: '#000000',
      });
      setError(null);
      setResultDialog((prev) => ({ ...prev, isOpen: false }));
    }
  }, [isOpen]);
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
      if (!formData.color_name.trim()) {
        setError('กรุณากรอกชื่อสี');
        setLoading(false);
        return;
      }

      if (!formData.color_hex.match(/^#[0-9A-F]{6}$/i)) {
        setError('รูปแบบรหัสสี HEX ไม่ถูกต้อง');
        setLoading(false);
        return;
      }

      const colorData: CreateColorDto = {
        color_name: formData.color_name.trim(),
        color_hex: formData.color_hex,
      };

      const colorModel = new ColorModel();
      await colorModel.createColor(colorData);
      setResultDialog({
        isOpen: true,
        status: 'success',
        message: 'บันทึกข้อมูลสีสำเร็จ',
      });
      
      // Reset form
      setFormData({
        color_name: '',
        color_hex: '#000000',
      });

    } catch (err: unknown) {
      setResultDialog({
        isOpen: true,
        status: 'error',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
      });
      console.error('Error creating color:', err);
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
        title="เพิ่มสีใหม่"
        description="กำหนดชื่อและรหัสสีที่ใช้กับสินค้า"
        size="md"
        closeOnBackdrop={!loading}
        closeOnEscape={!loading}
        footer={
          <>
            <button type="button" onClick={onClose} disabled={loading} className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50">
              ยกเลิก
            </button>
            <button type="submit" form="create-color-form" disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Zm2 5.3A8 8 0 0 1 4 12H0c0 3 1.1 5.8 3 7.9l3-2.6Z" />
                  </svg>
                  กำลังบันทึก…
                </>
              ) : 'บันทึกข้อมูล'}
            </button>
          </>
        }
      >
        <form id="create-color-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div role="alert" className="rounded-lg border border-[var(--color-error)] bg-[var(--color-bg-secondary)] p-4">
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          {/* Color Name Field */}
          <div>
            <label htmlFor="color_name" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
              ชื่อสี
            </label>
            <input
              id="color_name"
              type="text"
              name="color_name"
              value={formData.color_name}
              onChange={handleChange}
              placeholder="เช่น สีแดง, สีน้ำเงิน"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-2.5 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
              disabled={loading}
            />
          </div>

          {/* Color Picker Field */}
          <div>
            <label htmlFor="hexCode" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
              รหัสสี (HEX)
            </label>
            <div className="flex gap-3">
              <input
                id="hexCode"
                type="color"
                name="color_hex"
                value={formData.color_hex}
                onChange={handleChange}
                className="h-11 w-14 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
                disabled={loading}
              />
              <input
                type="text"
                name="color_hex"
                value={formData.color_hex}
                onChange={handleChange}
                placeholder="#000000"
                aria-label="รหัสสี HEX"
                className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                disabled={loading}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              ตัวอย่าง: #FF0000 (สีแดง), #0000FF (สีน้ำเงิน), #00FF00 (สีเขียว)
            </p>
          </div>

          {/* Preview */}
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
              ตัวอย่างสี
            </p>
            <div
              className="h-20 w-full rounded-lg border border-[var(--color-border)]"
              aria-label={`ตัวอย่างสี ${formData.color_hex}`}
              style={{ backgroundColor: formData.color_hex }}
            ></div>
          </div>
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
