'use client';

import { useEffect, useMemo, useState } from 'react';
import ProductModel from '@/models/product';
import CategoryModel from '@/models/category';
import ColorModel from '@/models/color';
import MaterialModel from '@/models/material';
import { ProductUnitModel } from '@/models/product-unit';
import SizeModel from '@/models/size';
import { Category } from '@/types/category';
import { Color } from '@/types/color';
import { Material } from '@/types/material';
import { Product, ProductFile, ProductVariant } from '@/types/product';
import { ProductUnit } from '@/types/product-unit';
import { Size } from '@/types/size';
import CustomSelect from '@/components/CustomSelect';
import ActionResultDialog from '@/components/ActionResultDialog';

interface UpdateProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData: Product;
}

interface VariantMaterialRow {
  id: string;
  material_id: string;
  material_qty: number;
}

interface VariantFormRow {
  key: string;
  product_variant_id?: string;
  product_variant_price: string;
  size_id: string;
  color_id: string;
  product_unit_id: string;
  product_variant_status: string;
  materials: VariantMaterialRow[];
}

const MAX_PRODUCT_FILES = 8;
const MAX_VARIANT_FILES = 6;
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = 'image/*,video/*';

const FORM_LABEL_CLASS = 'mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300';
const FORM_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';
const FORM_INPUT_COMPACT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

const productModel = new ProductModel();
const categoryModel = new CategoryModel();
const colorModel = new ColorModel();
const materialModel = new MaterialModel();
const productUnitModel = new ProductUnitModel();
const sizeModel = new SizeModel();

const createMaterialRow = (): VariantMaterialRow => ({
  id: crypto.randomUUID(),
  material_id: '',
  material_qty: 1,
});

const createVariantRow = (): VariantFormRow => ({
  key: crypto.randomUUID(),
  product_variant_price: '',
  size_id: '',
  color_id: '',
  product_unit_id: '',
  product_variant_status: 'active',
  materials: [createMaterialRow()],
});

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

const toProductFile = (file: File): ProductFile => ({
  product_file_name: file.name,
  product_file_category: file.type.startsWith('video/') ? 'video' : 'image',
  file,
  preview: URL.createObjectURL(file),
});

const validateFiles = (files: File[]) => {
  const invalidFiles = files.filter((file) => !file.type.startsWith('image/') && !file.type.startsWith('video/'));
  if (invalidFiles.length > 0) {
    return 'รองรับเฉพาะไฟล์รูปภาพและวีดีโอเท่านั้น';
  }

  const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE);
  if (oversizedFiles.length > 0) {
    return 'ไฟล์มีขนาดเกิน 30MB กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า';
  }

  return null;
};

const toVariantRows = (product: Product): VariantFormRow[] => {
  const variants = (product.product_variants || product.productVariants || []) as ProductVariant[];
  if (variants.length > 0) {
    return variants.map((variant) => ({
      key: variant.product_variant_id || crypto.randomUUID(),
      product_variant_id: variant.product_variant_id,
      product_variant_price: String(variant.product_variant_price ?? ''),
      size_id: String(variant.size?.size_id || variant.size_id || ''),
      color_id: String(variant.color?.color_id || variant.color_id || ''),
      product_unit_id: String(variant.productUnit?.product_unit_id || variant.product_unit_id || ''),
      product_variant_status: variant.product_variant_status || 'active',
      materials: (variant.product_materials || variant.productMaterials || []).map((material) => ({
        id: crypto.randomUUID(),
        material_id: material.material_id,
        material_qty: Number(material.material_qty) || 1,
      })),
    }));
  }

  return [
    {
      key: crypto.randomUUID(),
      product_variant_price: String(product.product_variant_price ?? ''),
      size_id: '',
      color_id: String(product.color?.color_id || ''),
      product_unit_id: String(product.productUnit?.product_unit_id || product.product_unit_id || ''),
      product_variant_status: 'active',
      materials: (product.product_materials || product.productMaterials || []).length
        ? (product.product_materials || product.productMaterials || []).map((material) => ({
            id: crypto.randomUUID(),
            material_id: material.material_id,
            material_qty: Number(material.material_qty) || 1,
          }))
        : [createMaterialRow()],
    },
  ];
};

const splitExistingFiles = (files: ProductFile[] | undefined) => {
  const existingProductFiles = (files || []).filter((file) => !file.product_variant_id);
  const existingVariantFiles: Record<string, ProductFile[]> = {};

  (files || []).forEach((file) => {
    if (!file.product_variant_id) {
      return;
    }

    const variantKey = String(file.product_variant_id);
    if (!existingVariantFiles[variantKey]) {
      existingVariantFiles[variantKey] = [];
    }
    existingVariantFiles[variantKey].push(file);
  });

  return { existingProductFiles, existingVariantFiles };
};

export default function UpdateProductForm({ isOpen, onClose, onSuccess, initialData }: UpdateProductFormProps) {
  const initialSplitFiles = splitExistingFiles(initialData.files);

  const [formData, setFormData] = useState({
    product_name: initialData.product_name,
    product_description: initialData.product_description,
    category_id: String(initialData.category?.category_id || ''),
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);

  const [variants, setVariants] = useState<VariantFormRow[]>(toVariantRows(initialData));

  const [existingProductFiles, setExistingProductFiles] = useState<ProductFile[]>(initialSplitFiles.existingProductFiles);
  const [existingVariantFiles, setExistingVariantFiles] = useState<Record<string, ProductFile[]>>(initialSplitFiles.existingVariantFiles);
  const [newProductFiles, setNewProductFiles] = useState<ProductFile[]>([]);
  const [newVariantFiles, setNewVariantFiles] = useState<Record<string, ProductFile[]>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'success' | 'error'>('success');
  const [dialogMessage, setDialogMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initSplit = splitExistingFiles(initialData.files);
    setFormData({
      product_name: initialData.product_name,
      product_description: initialData.product_description,
      category_id: String(initialData.category?.category_id || ''),
    });
    setVariants(toVariantRows(initialData));
    setExistingProductFiles(initSplit.existingProductFiles);
    setExistingVariantFiles(initSplit.existingVariantFiles);
    setNewProductFiles([]);
    setNewVariantFiles({});

    void fetchLookupData();
  }, [isOpen, initialData]);

  const fetchLookupData = async () => {
    try {
      const [categoryRes, colorRes, sizeRes, materialRes, unitRes] = await Promise.all([
        categoryModel.getCategories(1, 200),
        colorModel.getColors(1, 200),
        sizeModel.getSizes(1, 200),
        materialModel.getMaterials(1, 400),
        productUnitModel.getProductUnits(1, 100),
      ]);

      setCategories(categoryRes.data);
      setColors(colorRes.data);
      setSizes(sizeRes.data);
      setMaterials(materialRes.data);
      setProductUnits(unitRes.data);
    } catch (fetchError) {
      console.error('Failed to fetch lookup data:', fetchError);
    }
  };

  const selectedCategorySizes = useMemo(() => {
    const categoryId = Number(formData.category_id);
    if (!Number.isFinite(categoryId)) {
      return sizes;
    }

    const selectedCategory = categories.find((category) => category.category_id === categoryId);
    if (!selectedCategory?.size_ids || selectedCategory.size_ids.length === 0) {
      return sizes;
    }

    const allowedSizeIdSet = new Set(selectedCategory.size_ids);
    return sizes.filter((size) => allowedSizeIdSet.has(size.size_id));
  }, [categories, formData.category_id, sizes]);

  const addVariant = () => {
    setVariants((prev) => [...prev, createVariantRow()]);
  };

  const removeVariant = (variantKey: string) => {
    setVariants((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((variant) => variant.key !== variantKey);
    });

    setExistingVariantFiles((prev) => {
      const next = { ...prev };
      delete next[variantKey];
      return next;
    });

    setNewVariantFiles((prev) => {
      const files = prev[variantKey] || [];
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });

      const next = { ...prev };
      delete next[variantKey];
      return next;
    });
  };

  const updateVariant = (variantKey: string, field: keyof Omit<VariantFormRow, 'key' | 'product_variant_id' | 'materials'>, value: string) => {
    setVariants((prev) =>
      prev.map((variant) => {
        if (variant.key !== variantKey) {
          return variant;
        }

        return {
          ...variant,
          [field]: value,
        };
      })
    );
  };

  const addMaterial = (variantKey: string) => {
    setVariants((prev) =>
      prev.map((variant) => {
        if (variant.key !== variantKey) {
          return variant;
        }

        return {
          ...variant,
          materials: [...variant.materials, createMaterialRow()],
        };
      })
    );
  };

  const removeMaterial = (variantKey: string, materialRowId: string) => {
    setVariants((prev) =>
      prev.map((variant) => {
        if (variant.key !== variantKey) {
          return variant;
        }

        if (variant.materials.length <= 1) {
          return variant;
        }

        return {
          ...variant,
          materials: variant.materials.filter((material) => material.id !== materialRowId),
        };
      })
    );
  };

  const updateMaterial = (
    variantKey: string,
    materialRowId: string,
    field: keyof Omit<VariantMaterialRow, 'id'>,
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((variant) => {
        if (variant.key !== variantKey) {
          return variant;
        }

        return {
          ...variant,
          materials: variant.materials.map((material) => {
            if (material.id !== materialRowId) {
              return material;
            }

            return {
              ...material,
              [field]: field === 'material_qty' ? Number(value) : value,
            };
          }),
        };
      })
    );
  };

  const getMaterialOptionsForVariant = (variantKey: string, materialRowId: string) => {
    const targetVariant = variants.find((variant) => variant.key === variantKey);
    const selectedIds = new Set(
      (targetVariant?.materials || [])
        .filter((material) => material.id !== materialRowId && material.material_id)
        .map((material) => material.material_id)
    );

    return materials.map((material) => ({
      ...material,
      disabled: selectedIds.has(material.material_id),
    }));
  };

  const handleProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const fileValidationError = validateFiles(selectedFiles);

    if (fileValidationError) {
      setError(fileValidationError);
      return;
    }

    if (existingProductFiles.length + newProductFiles.length + selectedFiles.length > MAX_PRODUCT_FILES) {
      setError(`ไฟล์ระดับ Product ได้สูงสุด ${MAX_PRODUCT_FILES} ไฟล์`);
      return;
    }

    setNewProductFiles((prev) => [...prev, ...selectedFiles.map(toProductFile)]);
    setError(null);
  };

  const removeExistingProductFile = (index: number) => {
    setExistingProductFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const removeNewProductFile = (index: number) => {
    setNewProductFiles((prev) => {
      const next = [...prev];
      const target = next[index];
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      next.splice(index, 1);
      return next;
    });
  };

  const handleVariantFileChange = (variantKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const fileValidationError = validateFiles(selectedFiles);

    if (fileValidationError) {
      setError(fileValidationError);
      return;
    }

    setNewVariantFiles((prev) => {
      const current = prev[variantKey] || [];
      const existing = existingVariantFiles[variantKey] || [];
      if (existing.length + current.length + selectedFiles.length > MAX_VARIANT_FILES) {
        setError(`ไฟล์ระดับ Variant ได้สูงสุด ${MAX_VARIANT_FILES} ไฟล์ต่อ Variant`);
        return prev;
      }

      setError(null);
      return {
        ...prev,
        [variantKey]: [...current, ...selectedFiles.map(toProductFile)],
      };
    });
  };

  const removeExistingVariantFile = (variantKey: string, index: number) => {
    setExistingVariantFiles((prev) => {
      const current = [...(prev[variantKey] || [])];
      current.splice(index, 1);

      return {
        ...prev,
        [variantKey]: current,
      };
    });
  };

  const removeNewVariantFile = (variantKey: string, index: number) => {
    setNewVariantFiles((prev) => {
      const current = [...(prev[variantKey] || [])];
      const target = current[index];
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      current.splice(index, 1);

      return {
        ...prev,
        [variantKey]: current,
      };
    });
  };

  const validateVariants = () => {
    if (variants.length === 0) {
      return 'กรุณาเพิ่ม Variant อย่างน้อย 1 รายการ';
    }

    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const variant = variants[variantIndex];

      if (!variant.product_variant_price || Number(variant.product_variant_price) < 0) {
        return `กรุณาระบุราคาของ Variant #${variantIndex + 1}`;
      }

      if (!variant.size_id || !variant.color_id || !variant.product_unit_id) {
        return `กรุณากรอก Size, Color และ Product Unit ของ Variant #${variantIndex + 1} ให้ครบ`;
      }

      const validMaterials = variant.materials.filter((material) => material.material_id && material.material_qty > 0);
      if (validMaterials.length === 0) {
        return `Variant #${variantIndex + 1} ต้องมี Product Material อย่างน้อย 1 รายการ`;
      }

      const duplicateMaterialIds = new Set<string>();
      for (const material of validMaterials) {
        if (duplicateMaterialIds.has(material.material_id)) {
          return `Variant #${variantIndex + 1} ห้ามมีวัตถุดิบซ้ำ`;
        }
        duplicateMaterialIds.add(material.material_id);
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const variantValidationError = validateVariants();
    if (variantValidationError) {
      setError(variantValidationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedVariants = variants.map((variant) => ({
        product_variant_id: variant.product_variant_id,
        client_variant_key: variant.key,
        product_variant_price: Number(variant.product_variant_price),
        size_id: Number(variant.size_id),
        color_id: Number(variant.color_id),
        product_unit_id: Number(variant.product_unit_id),
        product_variant_status: variant.product_variant_status,
        product_materials: variant.materials
          .filter((material) => material.material_id && material.material_qty > 0)
          .map((material) => ({
            material_id: material.material_id,
            material_qty: Number(material.material_qty),
          })),
      }));

      const normalizedNewVariantFiles = Object.fromEntries(
        Object.entries(newVariantFiles)
          .map(([variantKey, files]) => [variantKey, files.map((file) => file.file!).filter(Boolean)])
          .filter(([, files]) => files.length > 0)
      );

      const existingVariantFileIds = Object.fromEntries(
        Object.entries(existingVariantFiles)
          .map(([variantKey, files]) => [
            variantKey,
            files.map((file) => file.product_file_id).filter((id): id is number => Boolean(id)),
          ])
          .filter(([, ids]) => ids.length > 0)
      );

      await productModel.updateProduct({
        product_id: initialData.product_id,
        product_name: formData.product_name,
        product_description: formData.product_description,
        category_id: Number(formData.category_id),
        product_variants: normalizedVariants,
        product_files: newProductFiles.map((file) => file.file!).filter(Boolean),
        variant_files: normalizedNewVariantFiles,
        existing_product_files: existingProductFiles
          .map((file) => file.product_file_id)
          .filter((id): id is number => Boolean(id)),
        existing_variant_files: existingVariantFileIds,
      });

      newProductFiles.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });

      Object.values(newVariantFiles).forEach((files) => {
        files.forEach((file) => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview);
          }
        });
      });

      setDialogType('success');
      setDialogMessage('อัปเดตสินค้าและ Variant สำเร็จ');
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
    if (dialogType !== 'success') {
      return;
    }

    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="absolute inset-0 bg-gray-900/40 dark:bg-black/70" onClick={onClose} />

        <div className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 dark:border-gray-700 dark:bg-gray-800/95">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-100">แก้ไขสินค้า</h2>
            <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            <section className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">รายละเอียดสินค้า</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={FORM_LABEL_CLASS}>
                    ชื่อสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, product_name: e.target.value }))}
                    className={FORM_INPUT_CLASS}
                    placeholder="กรอกชื่อสินค้า"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={FORM_LABEL_CLASS}>
                    คำอธิบายสินค้า <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.product_description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, product_description: e.target.value }))}
                    className={FORM_INPUT_CLASS}
                    placeholder="อธิบายสินค้า"
                  />
                </div>

                <CustomSelect
                  label="ประเภทสินค้า"
                  required
                  value={formData.category_id}
                  onChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
                  options={categories.map((category) => ({ value: category.category_id, label: category.category_name }))}
                  placeholder="เลือกประเภทสินค้า"
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100"></h3>
                <button
                  type="button"
                  onClick={addVariant}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  + เพิ่มสินค้า
                </button>
              </div>

              <div className="space-y-4">
                {variants.map((variant, variantIndex) => (
                  <div key={variant.key} className="rounded-xl border border-gray-200 p-4 dark:border-gray-600">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Variant #{variantIndex + 1}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{variant.product_variant_id ? `ID: ${variant.product_variant_id}` : 'ยังไม่บันทึก ID (Variant ใหม่)'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVariant(variant.key)}
                        disabled={variants.length === 1}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        ลบสินค้า
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className={FORM_LABEL_CLASS}>ราคา <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={variant.product_variant_price}
                          onChange={(e) => updateVariant(variant.key, 'product_variant_price', e.target.value)}
                          className={FORM_INPUT_COMPACT_CLASS}
                          placeholder="0.00"
                        />
                      </div>

                      <CustomSelect
                        label="ขนาด (Size)"
                        required
                        value={variant.size_id}
                        onChange={(value) => updateVariant(variant.key, 'size_id', value)}
                        options={selectedCategorySizes.map((size) => ({ value: size.size_id, label: size.size_name }))}
                        placeholder="เลือก Size"
                      />

                      <CustomSelect
                        label="สี (Color)"
                        required
                        value={variant.color_id}
                        onChange={(value) => updateVariant(variant.key, 'color_id', value)}
                        options={colors.map((color) => ({
                          value: color.color_id,
                          label: color.color_name,
                          color: color.color_hex,
                        }))}
                        placeholder="เลือก Color"
                        showColor
                      />

                      <CustomSelect
                        label="หน่วยสินค้า (Product Unit)"
                        required
                        value={variant.product_unit_id}
                        onChange={(value) => updateVariant(variant.key, 'product_unit_id', value)}
                        options={productUnits.map((unit) => ({ value: unit.product_unit_id, label: unit.product_unit_name }))}
                        placeholder="เลือก Unit"
                      />

                      <div>
                        <label className={FORM_LABEL_CLASS}>สถานะสินค้า</label>
                        <select
                          value={variant.product_variant_status}
                          onChange={(e) => updateVariant(variant.key, 'product_variant_status', e.target.value)}
                          className={FORM_INPUT_COMPACT_CLASS}
                        >
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">วัตถุดิบของสินค้า</p>
                        <button
                          type="button"
                          onClick={() => addMaterial(variant.key)}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          + เพิ่มวัตถุดิบ
                        </button>
                      </div>

                      <div className="space-y-2">
                        {variant.materials.map((materialRow, materialIndex) => (
                          <div key={materialRow.id} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-2 md:grid-cols-12 dark:border-gray-600">
                            <div className="md:col-span-6">
                              <CustomSelect
                                label={`วัสดุ #${materialIndex + 1}`}
                                required
                                value={materialRow.material_id}
                                onChange={(value) => updateMaterial(variant.key, materialRow.id, 'material_id', value)}
                                options={getMaterialOptionsForVariant(variant.key, materialRow.id).map((material) => ({
                                  value: material.material_id,
                                  label: material.material_name,
                                  disabled: material.disabled,
                                }))}
                                placeholder="เลือกวัตถุดิบ"
                              />
                            </div>

                            <div className="md:col-span-4">
                              <label className={FORM_LABEL_CLASS}>จำนวนที่ใช้</label>
                              <input
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={materialRow.material_qty}
                                onChange={(e) => updateMaterial(variant.key, materialRow.id, 'material_qty', e.target.value)}
                                className={FORM_INPUT_COMPACT_CLASS}
                              />
                            </div>

                            <div className="flex items-end md:col-span-2">
                              <button
                                type="button"
                                onClick={() => removeMaterial(variant.key, materialRow.id)}
                                disabled={variant.materials.length === 1}
                                className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/10"
                              >
                                ลบ
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
                      <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">ไฟล์ของสินค้า (optional)</p>

                      {(existingVariantFiles[variant.key] || []).length > 0 && (
                        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                          {(existingVariantFiles[variant.key] || []).map((file, fileIndex) => (
                            <div key={`existing-${variant.key}-${fileIndex}`} className="relative rounded-lg border border-gray-200 p-1 dark:border-gray-600">
                              {file.product_file_category === 'image' ? (
                                <img src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name} alt={file.product_file_name} className="h-24 w-full rounded object-cover" />
                              ) : (
                                <video src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name} className="h-24 w-full rounded object-cover" controls />
                              )}
                              <button
                                type="button"
                                onClick={() => removeExistingVariantFile(variant.key, fileIndex)}
                                className="absolute right-1 top-1 rounded bg-red-500 px-1 text-[10px] text-white"
                              >
                                x
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <input
                        id={`variant-update-file-${variant.key}`}
                        type="file"
                        multiple
                        accept={ACCEPTED_FILE_TYPES}
                        onChange={(e) => handleVariantFileChange(variant.key, e)}
                        className="hidden"
                      />
                      <label
                        htmlFor={`variant-update-file-${variant.key}`}
                        className="inline-flex cursor-pointer rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        + เพิ่มไฟล์สินค้า
                      </label>

                      {(newVariantFiles[variant.key] || []).length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                          {(newVariantFiles[variant.key] || []).map((file, fileIndex) => (
                            <div key={`new-${variant.key}-${fileIndex}`} className="relative rounded-lg border border-gray-200 p-1 dark:border-gray-600">
                              {file.product_file_category === 'image' ? (
                                <img src={file.preview} alt={file.product_file_name} className="h-24 w-full rounded object-cover" />
                              ) : (
                                <video src={file.preview} className="h-24 w-full rounded object-cover" controls />
                              )}
                              <button
                                type="button"
                                onClick={() => removeNewVariantFile(variant.key, fileIndex)}
                                className="absolute right-1 top-1 rounded bg-red-500 px-1 text-[10px] text-white"
                              >
                                x
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">ไฟล์ Product หลัก </h3>

              {existingProductFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {existingProductFiles.map((file, index) => (
                    <div key={`existing-product-${index}`} className="relative rounded-lg border border-gray-200 p-1 dark:border-gray-600">
                      {file.product_file_category === 'image' ? (
                        <img src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name} alt={file.product_file_name} className="h-24 w-full rounded object-cover" />
                      ) : (
                        <video src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name} className="h-24 w-full rounded object-cover" controls />
                      )}
                      <button
                        type="button"
                        onClick={() => removeExistingProductFile(index)}
                        className="absolute right-1 top-1 rounded bg-red-500 px-1 text-[10px] text-white"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center transition-colors hover:border-blue-500 dark:border-gray-600 dark:hover:border-blue-400">
                <input
                  id="product-main-update-file-upload"
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleProductFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="product-main-update-file-upload"
                  className="inline-flex cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  เพิ่มไฟล์ Product หลัก
                </label>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">สูงสุด {MAX_PRODUCT_FILES} ไฟล์</p>
              </div>

              {newProductFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {newProductFiles.map((file, index) => (
                    <div key={`new-product-${index}`} className="relative rounded-lg border border-gray-200 p-1 dark:border-gray-600">
                      {file.product_file_category === 'image' ? (
                        <img src={file.preview} alt={file.product_file_name} className="h-24 w-full rounded object-cover" />
                      ) : (
                        <video src={file.preview} className="h-24 w-full rounded object-cover" controls />
                      )}
                      <button
                        type="button"
                        onClick={() => removeNewProductFile(index)}
                        className="absolute right-1 top-1 rounded bg-red-500 px-1 text-[10px] text-white"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </form>
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
