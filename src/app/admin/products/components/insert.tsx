'use client';
import { useState, useEffect } from 'react';
import ProductModel from '@/models/product';
import CategoryModel from '@/models/category';
import ColorModel from '@/models/color';
import { Category } from '@/types/category';
import { Color } from '@/types/color';
import { ProductFile } from '@/types/product';
import CustomSelect from '@/components/CustomSelect';
import { emojiCategories } from '@/lib/emojis';
interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProductDescription {
  icon: string;
  text: string;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const ACCEPTED_FILE_TYPES = 'image/*,video/*';

export default function ProductForm({ isOpen, onClose, onSuccess }: ProductFormProps) {
  const [formData, setFormData] = useState({
    product_name: '',
    product_description: '',
    price: '',
    category_id: '',
    color_id: '',
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>(Object.keys(emojiCategories)[0]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [files, setFiles] = useState<ProductFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'success' | 'error'>('success');
  const [dialogMessage, setDialogMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCategoriesAndColors();
    }
  }, [isOpen]);

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

  // แปลงข้อความ (newline) เป็น JSON Array
  const convertDescriptionToJSON = (text: string): ProductDescription[] => {
    if (!text.trim()) return [];
    return text
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const match = line.match(/^([\p{Emoji}\p{Emoji_Component}]+)\s+(.+)$/u);
        if (match) {
          return { icon: match[1], text: match[2] };
        }
        return { icon: '', text: line };
      });
  };

  // แปลง JSON Array กลับเป็นข้อความ (newline)
  const convertJSONToDescription = (data: ProductDescription[]): string => {
    if (!Array.isArray(data) || data.length === 0) return '';
    return data.map(item => `${item.icon} ${item.text}`).join('\n');
  };

  // แทรก emoji ลงใน textarea
  const insertEmoji = (emoji: string) => {
    const textarea = document.querySelector('textarea[name="product_description"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.product_description;
    const before = text.substring(0, start);
    const after = text.substring(end);

    // ถ้าไม่ได้อยู่ต้นบรรทัด ให้ขึ้นบรรทัดใหม่
    const needNewLine = before.length > 0 && !before.endsWith('\n');
    const newText = before + (needNewLine ? '\n' : '') + emoji + ' ' + after;

    setFormData({ ...formData, product_description: newText });

    // ตั้งตำแหน่ง cursor หลัง emoji
    setTimeout(() => {
      const newPosition = start + (needNewLine ? 1 : 0) + emoji.length + 1;
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (files.length + selectedFiles.length > MAX_FILES) {
      setError(`สามารถอัปโหลดได้สูงสุด ${MAX_FILES} ไฟล์`);
      return;
    }

    // ตรวจสอบประเภทไฟล์
    const invalidFiles = selectedFiles.filter(
      (file) => !file.type.startsWith('image/') && !file.type.startsWith('video/')
    );

    if (invalidFiles.length > 0) {
      setError('รองรับเฉพาะไฟล์รูปภาพและวีดีโอเท่านั้น');
      return;
    }

    // ตรวจสอบขนาดไฟล์
    const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_FILE_SIZE);

    if (oversizedFiles.length > 0) {
      setError('ไฟล์มีขนาดเกิน 30MB กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า');
      return;
    }

    const newFiles: ProductFile[] = selectedFiles.map((file) => {
      const isVideo = file.type.startsWith('video/');
      return {
        product_file_name: file.name,
        product_file_category: isVideo ? 'video' : 'image',
        file: file,
        preview: URL.createObjectURL(file),
      };
    });

    setFiles([...files, ...newFiles]);
    setError(null);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    if (newFiles[index].preview) {
      URL.revokeObjectURL(newFiles[index].preview!);
    }
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const productModel = new ProductModel();
      const filesToUpload = files.map((f) => f.file!);

      // แปลง description เป็น JSON Array
      const descriptionJSON = convertDescriptionToJSON(formData.product_description);
      const descriptionString = JSON.stringify(descriptionJSON);

      await productModel.createProduct({
        product_name: formData.product_name,
        product_description: descriptionString,
        price: parseFloat(formData.price),
        category_id: parseInt(formData.category_id),
        color_id: parseInt(formData.color_id),
        files: filesToUpload,
      });

      // Clean up previews
      files.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });

      // แสดง dialog สำเร็จ
      setDialogType('success');
      setDialogMessage('บันทึกข้อมูลสินค้าสำเร็จ!');
      setShowDialog(true);
      
    } catch (err: any) {
      // แสดง dialog ไม่สำเร็จ
      setDialogType('error');
      setDialogMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setShowDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    if (dialogType === 'success') {
      // Reset form และปิด
      setFormData({
        product_name: '',
        product_description: '',
        price: '',
        category_id: '',
        color_id: '',
      });
      setFiles([]);
      setError(null);
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-300/40 bg-opacity-50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">เพิ่มสินค้า</h2>
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                คำอธิบายสินค้า <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
              >
                <span className="text-base">😀</span>
                {showEmojiPicker ? 'ซ่อน Emoji' : 'เลือก Emoji'}
              </button>
            </div>

            {/* Emoji Picker Buttons */}
            {showEmojiPicker && (
              <div className="mb-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                {/* หมวดหมู่ */}
                <div className="flex flex-wrap gap-2 p-3 border-b border-blue-200">
                  {Object.keys(emojiCategories).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedEmojiCategory(category)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        selectedEmojiCategory === category
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-blue-100'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                {/* Emoji ตามหมวดหมู่ */}
                <div className="flex flex-wrap gap-2 p-3">
                  {emojiCategories[selectedEmojiCategory as keyof typeof emojiCategories].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-2xl hover:bg-white hover:scale-110 transition-all rounded px-2 py-1 hover:shadow-md"
                      title={`แทรก ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              required
              rows={10}
              name="product_description"
              value={formData.product_description}
              onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
              className="w-full text-gray-800 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="กรอกคำอธิบายสินค้า..."
            />
            <p className="mt-2 text-xs text-gray-500">
              💡 <strong>วิธีใช้:</strong> คลิกปุ่ม "เลือก Emoji" ด้านบนเพื่อเลือกไอคอน หรือพิมพ์เอง แต่ละบรรทัดเป็นรายการหนึ่ง<br />
              <span className="text-gray-400">ตัวอย่าง: ✅ เก็บความเย็นได้นาน 12 ชั่วโมง</span>
            </p>
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

          {/* Upload Files */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              รูปภาพ/วีดีโอสินค้า (สูงสุด {MAX_FILES} ไฟล์)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileChange}
                disabled={files.length >= MAX_FILES}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer ${files.length >= MAX_FILES ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  {files.length >= MAX_FILES
                    ? 'ถึงจำนวนไฟล์สูงสุดแล้ว'
                    : 'คลิกเพื่ออัปโหลดรูปภาพหรือวีดีโอ'}
                </p>
                <p className="mt-1 text-xs text-gray-500">รองรับไฟล์รูปภาพและวีดีโอ</p>
              </label>
            </div>
          </div>

          {/* File Preview */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {files.map((file, index) => (
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
                    onClick={() => removeFile(index)}
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
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-xl">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-gray-700 font-medium">กำลังบันทึกข้อมูล...</p>
          </div>
        </div>
      )}
    </div>

    {/* Dialog Modal */}
    {showDialog && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={handleDialogClose} />
        <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-fadeIn">
          <div className="flex flex-col items-center gap-4">
            {/* Icon */}
            {dialogType === 'success' ? (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            
            {/* Title */}
            <h3 className={`text-xl font-semibold ${
              dialogType === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              {dialogType === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}
            </h3>
            
            {/* Message */}
            <p className="text-gray-700 text-center">{dialogMessage}</p>
            
            {/* Button */}
            <button
              onClick={handleDialogClose}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                dialogType === 'success'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              ตกลง
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
