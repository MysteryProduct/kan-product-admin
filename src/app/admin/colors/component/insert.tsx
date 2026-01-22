'use client';

import { useEffect, useState } from 'react';
import { CreateColorDto } from '@/types/color';
import ColorModel from '@/models/color';

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
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form when opened
      setFormData({
        color_name: '',
        color_hex: '#000000',
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
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
      setSuccess(true);
      
      // Reset form
      setFormData({
        color_name: '',
        color_hex: '#000000',
      });

      // Close modal and refresh data after 1 second
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      console.error('Error creating color:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-100/50 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">เพิ่มสีใหม่</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">บันทึกข้อมูลสีสำเร็จ</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Color Name Field */}
          <div>
            <label htmlFor="color_name" className="block text-sm font-medium text-gray-700 mb-2">
              ชื่อสี
            </label>
            <input
              id="color_name"
              type="text"
              name="color_name"
              value={formData.color_name}
              onChange={handleChange}
              placeholder="เช่น สีแดง, สีน้ำเงิน"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              disabled={loading}
            />
          </div>

          {/* Color Picker Field */}
          <div>
            <label htmlFor="hexCode" className="block text-sm font-medium text-gray-700 mb-2">
              รหัสสี (HEX)
            </label>
            <div className="flex gap-3">
              <input
                id="hexCode"
                type="color"
                name="color_hex"
                value={formData.color_hex}
                onChange={handleChange}
                className="w-14 h-10 border border-gray-300 rounded-lg cursor-pointer"
                disabled={loading}
              />
              <input
                type="text"
                name="color_hex"
                value={formData.color_hex}
                onChange={handleChange}
                placeholder="#000000"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 font-mono text-sm"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              ตัวอย่าง: #FF0000 (สีแดง), #0000FF (สีน้ำเงิน), #00FF00 (สีเขียว)
            </p>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ตัวอย่างสี
            </label>
            <div
              className="w-full h-20 rounded-lg border-2 border-gray-300 shadow-sm transition-colors"
              style={{ backgroundColor: formData.color_hex }}
            ></div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                กำลังบันทึก...
              </>
            ) : (
              'บันทึกข้อมูล'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
