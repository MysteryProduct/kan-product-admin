'use client';
import { useState, useEffect } from 'react';
import ProductModel from '@/models/product';
import CategoryModel from '@/models/category';
import ColorModel from '@/models/color';
import { Category } from '@/types/category';
import { Color } from '@/types/color';
import { Product, ProductFile } from '@/types/product';
import CustomSelect from '@/components/CustomSelect';

interface UpdateProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData: Product;
}

const MAX_FILES = 5;
const ACCEPTED_FILE_TYPES = 'image/*,video/*';

export default function UpdateProductForm({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: UpdateProductFormProps) {
  const [formData, setFormData] = useState({
    product_name: initialData.product_name,
    product_description: initialData.product_description,
    price: initialData.price.toString(),
    category_id: initialData.category_id.toString(),
    color_id: initialData.color_id.toString(),
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [existingFiles, setExistingFiles] = useState<ProductFile[]>(initialData.files || []);
  const [newFiles, setNewFiles] = useState<ProductFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        product_name: initialData.product_name,
        product_description: initialData.product_description,
        price: initialData.price.toString(),
        category_id: initialData.category_id.toString(),
        color_id: initialData.color_id.toString(),
      });
      setExistingFiles(initialData.files || []);
      setNewFiles([]);
      fetchCategoriesAndColors();
    }
  }, [isOpen, initialData]);

  const fetchCategoriesAndColors = async () => {
    try {
      const categoryModel = new CategoryModel();
      const colorModel = new ColorModel();

      const [categoryRes, colorRes] = await Promise.all([
        categoryModel.getCategories(1, 100),
        colorModel.getColors(1, 100),
      ]);

      setCategories(categoryRes.data);
      setColors(colorRes.data);
    } catch (err) {
      console.error('Failed to fetch categories and colors:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const totalFiles = existingFiles.length + newFiles.length + selectedFiles.length;

    if (totalFiles > MAX_FILES) {
      setError(`สามารถมีไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์`);
      return;
    }

    const files: ProductFile[] = selectedFiles.map((file) => {
      const isVideo = file.type.startsWith('video/');
      return {
        product_file_name: file.name,
        product_file_category: isVideo ? 'video' : 'image',
        file: file,
        preview: URL.createObjectURL(file),
      };
    });

    setNewFiles([...newFiles, ...files]);
    setError(null);
  };

  const removeExistingFile = (index: number) => {
    const updated = [...existingFiles];
    updated.splice(index, 1);
    setExistingFiles(updated);
  };

  const removeNewFile = (index: number) => {
    const updated = [...newFiles];
    if (updated[index].preview) {
      URL.revokeObjectURL(updated[index].preview!);
    }
    updated.splice(index, 1);
    setNewFiles(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const productModel = new ProductModel();
      const filesToUpload = newFiles.map((f) => f.file!);
      const existingFileIds = existingFiles
        .filter((f) => f.product_file_id)
        .map((f) => f.product_file_id!);

      await productModel.updateProduct({
        product_id: initialData.product_id,
        product_name: formData.product_name,
        product_description: formData.product_description,
        price: parseFloat(formData.price),
        category_id: parseInt(formData.category_id),
        color_id: parseInt(formData.color_id),
        files: filesToUpload,
        existing_files: existingFileIds,
      });

      // Clean up previews
      newFiles.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });

      setNewFiles([]);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalFiles = existingFiles.length + newFiles.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-300/40 bg-opacity-50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">แก้ไขสินค้า</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* ชื่อสินค้า */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ชื่อสินค้า <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              className="w-full text-gray-800 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="กรอกชื่อสินค้า"
            />
          </div>

          {/* คำอธิบาย */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              คำอธิบายสินค้า <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={formData.product_description}
              onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
              className="w-full text-gray-800 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="กรอกคำอธิบายสินค้า"
            />
          </div>

          {/* ราคา */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ราคา <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full text-gray-800 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          {/* ประเภทและสี */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomSelect
              label="ประเภท"
              required
              value={formData.category_id}
              onChange={(value) => setFormData({ ...formData, category_id: value })}
              options={categories.map((cat) => ({
                value: cat.category_id,
                label: cat.category_name,
              }))}
              placeholder="เลือกประเภท"
            />

            <CustomSelect
              label="สี"
              required
              value={formData.color_id}
              onChange={(value) => setFormData({ ...formData, color_id: value })}
              options={colors.map((color) => ({
                value: color.color_id,
                label: color.color_name,
                color: color.color_hex,
              }))}
              placeholder="เลือกสี"
              showColor
            />
          </div>

          {/* Existing Files */}
          {existingFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ไฟล์เดิม ({existingFiles.length})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {existingFiles.map((file, index) => (
                  <div key={file.product_file_id || index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                      {file.product_file_category === 'image' ? (
                        <img
                          src={file.product_file_name}
                          alt={`Product file ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={file.product_file_name}
                          className="w-full h-full object-cover"
                          controls
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExistingFile(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload New Files */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              เพิ่มรูปภาพ/วีดีโอ ({totalFiles}/{MAX_FILES} ไฟล์)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileChange}
                disabled={totalFiles >= MAX_FILES}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer ${totalFiles >= MAX_FILES ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  {totalFiles >= MAX_FILES
                    ? 'ถึงจำนวนไฟล์สูงสุดแล้ว'
                    : 'คลิกเพื่ออัปโหลดรูปภาพหรือวีดีโอเพิ่มเติม'}
                </p>
                <p className="mt-1 text-xs text-gray-500">รองรับไฟล์รูปภาพและวีดีโอ</p>
              </label>
            </div>
          </div>

          {/* New Files Preview */}
          {newFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ไฟล์ใหม่ ({newFiles.length})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {newFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                      {file.product_file_category === 'image' ? (
                        <img
                          src={file.preview}
                          alt={file.product_file_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={file.preview}
                          className="w-full h-full object-cover"
                          controls
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewFile(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="mt-1 text-xs text-gray-600 truncate">{file.product_file_name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
