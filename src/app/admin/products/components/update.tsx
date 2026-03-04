'use client';

import { useEffect, useState } from 'react';
import ProductModel from '@/models/product';
import CategoryModel from '@/models/category';
import ColorModel from '@/models/color';
import MaterialModel from '@/models/material';
import { ProductUnitModel } from '@/models/product-unit';
import { Category } from '@/types/category';
import { Color } from '@/types/color';
import { Material } from '@/types/material';
import { Product, ProductFile, ProductMaterial } from '@/types/product';
import { ProductUnit } from '@/types/product-unit';
import CustomSelect from '@/components/CustomSelect';
import { emojiCategories } from '@/lib/emojis';
import ActionResultDialog from '@/components/ActionResultDialog';

interface UpdateProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData: Product;
}

interface ProductDescription {
  icon: string;
  text: string;
}

interface ProductMaterialRow {
  id: string;
  material_id: string;
  material_qty: number;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = 'image/*,video/*';

const productModel = new ProductModel();
const categoryModel = new CategoryModel();
const colorModel = new ColorModel();
const materialModel = new MaterialModel();
const productUnitModel = new ProductUnitModel();

const createEmptyMaterialRow = (): ProductMaterialRow => ({
  id: crypto.randomUUID(),
  material_id: '',
  material_qty: 1,
});

const toRows = (materials: ProductMaterial[] | undefined): ProductMaterialRow[] => {
  if (!materials || materials.length === 0) {
    return [createEmptyMaterialRow()];
  }

  return materials.map((item) => ({
    id: crypto.randomUUID(),
    material_id: item.material_id,
    material_qty: Number(item.material_qty) || 1,
  }));
};

export default function UpdateProductForm({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: UpdateProductFormProps) {
    console.log(initialData);
    
  const [formData, setFormData] = useState({
    product_name: initialData.product_name,
    product_description: initialData.product_description,
    product_price: initialData.product_price.toString(),
    category_id: initialData.category.category_id.toString(),
    color_id: initialData.color.color_id.toString(),
    product_unit_id: (initialData.productUnit?.product_unit_id || initialData.product_unit_id || '').toString(),
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [productMaterials, setProductMaterials] = useState<ProductMaterialRow[]>(
    toRows(initialData.product_materials || initialData.productMaterials)
  );
  const [existingFiles, setExistingFiles] = useState<ProductFile[]>(initialData.files || []);
  const [newFiles, setNewFiles] = useState<ProductFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>(Object.keys(emojiCategories)[0]);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'success' | 'error'>('success');
  const [dialogMessage, setDialogMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let descriptionText = initialData.product_description;
    try {
      const parsedDesc = JSON.parse(initialData.product_description);
      if (Array.isArray(parsedDesc)) {
        descriptionText = convertJSONToDescription(parsedDesc);
      }
    } catch {
      descriptionText = initialData.product_description;
    }

    setFormData({
      product_name: initialData.product_name,
      product_description: descriptionText,
      product_price: initialData.product_price.toString(),
      category_id: initialData.category.category_id.toString(),
      color_id: initialData.color.color_id.toString(),
      product_unit_id: (initialData.productUnit?.product_unit_id || initialData.product_unit_id || '').toString(),
    });
    setProductMaterials(toRows(initialData.product_materials || initialData.productMaterials));
    setExistingFiles(initialData.files || []);
    setNewFiles([]);
    void fetchLookupData();
  }, [isOpen, initialData]);

  const fetchLookupData = async () => {
    try {
      const [categoryRes, colorRes, materialRes, unitRes] = await Promise.all([
        categoryModel.getCategories(1, 100),
        colorModel.getColors(1, 100),
        materialModel.getMaterials(1, 200),
        productUnitModel.getProductUnits(1, 100),
      ]);

      setCategories(categoryRes.data);
      setColors(colorRes.data);
      setMaterials(materialRes.data);
      setProductUnits(unitRes.data);
    } catch (fetchError) {
      console.error('Failed to fetch lookup data:', fetchError);
    }
  };

  const convertDescriptionToJSON = (text: string): ProductDescription[] => {
    if (!text.trim()) return [];

    return text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const match = line.match(/^([\p{Emoji}\p{Emoji_Component}]+)\s+(.+)$/u);
        if (match) {
          return { icon: match[1], text: match[2] };
        }
        return { icon: '', text: line };
      });
  };

  const convertJSONToDescription = (data: ProductDescription[]): string => {
    if (!Array.isArray(data) || data.length === 0) return '';
    return data.map((item) => `${item.icon} ${item.text}`.trim()).join('\n');
  };

  const insertEmoji = (emoji: string) => {
    const textarea = document.querySelector('textarea[name="product_description"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.product_description;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const needNewLine = before.length > 0 && !before.endsWith('\n');
    const newText = before + (needNewLine ? '\n' : '') + emoji + ' ' + after;

    setFormData((prev) => ({ ...prev, product_description: newText }));

    setTimeout(() => {
      const newPosition = start + (needNewLine ? 1 : 0) + emoji.length + 1;
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const totalFiles = existingFiles.length + newFiles.length + selectedFiles.length;

    if (totalFiles > MAX_FILES) {
      setError(`สามารถมีไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์`);
      return;
    }

    const invalidFiles = selectedFiles.filter(
      (file) => !file.type.startsWith('image/') && !file.type.startsWith('video/')
    );

    if (invalidFiles.length > 0) {
      setError('รองรับเฉพาะไฟล์รูปภาพและวีดีโอเท่านั้น');
      return;
    }

    const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_FILE_SIZE);

    if (oversizedFiles.length > 0) {
      setError('ไฟล์มีขนาดเกิน 30MB กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า');
      return;
    }

    const files: ProductFile[] = selectedFiles.map((file) => {
      const isVideo = file.type.startsWith('video/');
      return {
        product_file_name: file.name,
        product_file_category: isVideo ? 'video' : 'image',
        file,
        preview: URL.createObjectURL(file),
      };
    });

    setNewFiles((prev) => [...prev, ...files]);
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

  const addMaterialRow = () => {
    setProductMaterials((prev) => [...prev, createEmptyMaterialRow()]);
  };

  const removeMaterialRow = (id: string) => {
    setProductMaterials((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((row) => row.id !== id);
    });
  };

  const updateMaterialRow = (id: string, field: 'material_id' | 'material_qty', value: string | number) => {
    setProductMaterials((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row;
        }

        if (field === 'material_qty') {
          return {
            ...row,
            material_qty: Number(value),
          };
        }

        return {
          ...row,
          material_id: String(value),
        };
      })
    );
  };

  const getMaterialOptionsForRow = (rowId: string) => {
    const selectedInOtherRows = new Set(
      productMaterials
        .filter((row) => row.id !== rowId && row.material_id)
        .map((row) => row.material_id)
    );

    return materials.map((material) => ({
      ...material,
      disabled: selectedInOtherRows.has(material.material_id),
    }));
  };

  const parseErrorMessage = (err: unknown) => {
    const errorWithResponse = err as {
      response?: {
        data?: {
          message?: string | string[];
        };
      };
      message?: string;
    };

    const responseMessage = errorWithResponse.response?.data?.message;

    if (Array.isArray(responseMessage)) {
      return responseMessage.join(', ');
    }

    if (typeof responseMessage === 'string') {
      return responseMessage;
    }

    return errorWithResponse.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล';
  };

  const validateMaterials = () => {
    const validRows = productMaterials.filter((item) => item.material_id && item.material_qty > 0);

    if (validRows.length === 0) {
      return 'กรุณาเพิ่มวัตถุดิบอย่างน้อย 1 รายการ';
    }

    const duplicates = new Set<string>();
    for (const item of validRows) {
      if (duplicates.has(item.material_id)) {
        return 'ห้ามเลือกวัตถุดิบซ้ำในสูตรสินค้า';
      }
      duplicates.add(item.material_id);
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const materialError = validateMaterials();
    if (materialError) {
      setError(materialError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filesToUpload = newFiles.map((f) => f.file!).filter(Boolean);
      const existingFileIds = existingFiles.filter((f) => f.product_file_id).map((f) => f.product_file_id!);
      const normalizedMaterials = productMaterials
        .filter((item) => item.material_id && item.material_qty > 0)
        .map((item) => ({
          material_id: item.material_id,
          material_qty: Number(item.material_qty),
        }));

      const descriptionJSON = convertDescriptionToJSON(formData.product_description);
      const descriptionString = JSON.stringify(descriptionJSON);

      await productModel.updateProduct({
        product_id: initialData.product_id,
        product_name: formData.product_name,
        product_description: descriptionString,
        product_price: parseFloat(formData.product_price),
        category_id: parseInt(formData.category_id, 10),
        color_id: parseInt(formData.color_id, 10),
        product_unit_id: parseInt(formData.product_unit_id, 10),
        product_materials: normalizedMaterials,
        files: filesToUpload,
        existing_files: existingFileIds,
      });

      newFiles.forEach((f) => {
        if (f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });

      setDialogType('success');
      setDialogMessage('อัปเดตข้อมูลสินค้าสำเร็จ!');
      setShowDialog(true);
    } catch (err) {
      setDialogType('error');
      setDialogMessage(parseErrorMessage(err));
      setShowDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    if (dialogType === 'success') {
      setNewFiles([]);
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  const totalFiles = existingFiles.length + newFiles.length;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-300/40 dark:bg-gray-950/60" onClick={onClose} />

        <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
          <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">แก้ไขสินค้า</h2>
            <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                ชื่อสินค้า <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.product_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, product_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="กรอกชื่อสินค้า"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  คำอธิบายสินค้า <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <span className="text-base">😀</span>
                  {showEmojiPicker ? 'ซ่อน Emoji' : 'เลือก Emoji'}
                </button>
              </div>

              {showEmojiPicker && (
                <div className="mb-3 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:border-blue-400/20 dark:from-gray-700 dark:to-gray-700">
                  <div className="flex flex-wrap gap-2 border-b border-blue-200 p-3 dark:border-gray-600">
                    {Object.keys(emojiCategories).map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedEmojiCategory(category)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          selectedEmojiCategory === category
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-blue-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 p-3">
                    {emojiCategories[selectedEmojiCategory as keyof typeof emojiCategories].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="rounded px-2 py-1 text-2xl transition-all hover:scale-110 hover:bg-white hover:shadow-md dark:hover:bg-gray-600"
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
                onChange={(e) => setFormData((prev) => ({ ...prev, product_description: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="กรอกคำอธิบายสินค้า..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                ราคา <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.product_price}
                onChange={(e) => setFormData((prev) => ({ ...prev, product_price: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="0.00"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <CustomSelect
                label="ประเภท"
                required
                value={formData.category_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
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
                onChange={(value) => setFormData((prev) => ({ ...prev, color_id: value }))}
                options={colors.map((color) => ({
                  value: color.color_id,
                  label: color.color_name,
                  color: color.color_hex,
                }))}
                placeholder="เลือกสี"
                showColor
              />

              <CustomSelect
                label="หน่วยสินค้า"
                required
                value={formData.product_unit_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, product_unit_id: value }))}
                options={productUnits.map((unit) => ({
                  value: unit.product_unit_id,
                  label: unit.product_unit_name,
                }))}
                placeholder="เลือกหน่วยสินค้า"
              />
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">สูตรวัตถุดิบ (Product Material)</h3>
                <button
                  type="button"
                  onClick={addMaterialRow}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700"
                >
                  + เพิ่มวัตถุดิบ
                </button>
              </div>

              <div className="space-y-3">
                {productMaterials.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600 md:grid-cols-12">
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">วัตถุดิบ #{index + 1}</label>
                      <select
                        required
                        value={item.material_id}
                        onChange={(e) => updateMaterialRow(item.id, 'material_id', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">เลือกวัตถุดิบ</option>
                        {getMaterialOptionsForRow(item.id).map((material) => (
                          <option key={material.material_id} value={material.material_id} disabled={material.disabled}>
                            {material.material_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">จำนวนที่ใช้ต่อสินค้า 1 ชิ้น</label>
                      <input
                        required
                        min={0.01}
                        step="0.01"
                        type="number"
                        value={item.material_qty}
                        onChange={(e) => updateMaterialRow(item.id, 'material_qty', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>

                    <div className="flex items-end md:col-span-2">
                      <button
                        type="button"
                        onClick={() => removeMaterialRow(item.id)}
                        disabled={productMaterials.length === 1}
                        className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {existingFiles.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">ไฟล์เดิม ({existingFiles.length})</label>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {existingFiles.map((file, index) => (
                    <div key={file.product_file_id || index} className="group relative">
                      <div className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
                        {file.product_file_category === 'image' ? (
                          <img
                            src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name}
                            alt={`Product file ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <video src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name} className="h-full w-full object-cover" controls />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExistingFile(index)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-lg transition-colors hover:bg-red-600"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                เพิ่มรูปภาพ/วีดีโอ ({totalFiles}/{MAX_FILES} ไฟล์)
              </label>
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-500 dark:border-gray-600 dark:hover:border-blue-400">
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileChange}
                  disabled={totalFiles >= MAX_FILES}
                  className="hidden"
                  id="product-file-update-upload"
                />
                <label htmlFor="product-file-update-upload" className={`cursor-pointer ${totalFiles >= MAX_FILES ? 'cursor-not-allowed opacity-50' : ''}`}>
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {totalFiles >= MAX_FILES ? 'ถึงจำนวนไฟล์สูงสุดแล้ว' : 'คลิกเพื่ออัปโหลดรูปภาพหรือวีดีโอเพิ่มเติม'}
                  </p>
                </label>
              </div>
            </div>

            {newFiles.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">ไฟล์ใหม่ ({newFiles.length})</label>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {newFiles.map((file, index) => (
                    <div key={index} className="group relative">
                      <div className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
                        {file.product_file_category === 'image' ? (
                          <img src={file.preview} alt={file.product_file_name} className="h-full w-full object-cover" />
                        ) : (
                          <video src={file.preview} className="h-full w-full object-cover" controls />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewFile(index)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-lg transition-colors hover:bg-red-600"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="mt-1 truncate text-xs text-gray-600 dark:text-gray-300">{file.product_file_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </form>

          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/50">
              <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-6 dark:bg-gray-800">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="font-medium text-gray-700 dark:text-gray-200">กำลังอัปเดตข้อมูล...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ActionResultDialog
        isOpen={showDialog}
        status={dialogType}
        action="update"
        message={dialogMessage}
        onClose={handleDialogClose}
      />
    </>
  );
}
