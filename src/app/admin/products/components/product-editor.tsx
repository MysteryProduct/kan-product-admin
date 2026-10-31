'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import axios from '@/lib/axios';
import ProductModel, { type StorePolicyState } from '@/models/product';
import CategoryModel from '@/models/category';
import ColorModel from '@/models/color';
import MaterialModel from '@/models/material';
import { ProductUnitModel } from '@/models/product-unit';
import SizeModel from '@/models/size';
import type { Category } from '@/types/category';
import type { Color } from '@/types/color';
import type { Material } from '@/types/material';
import type { Product, ProductFile, ProductVariant } from '@/types/product';
import type { ProductUnit } from '@/types/product-unit';
import type { Size } from '@/types/size';
import Button from '@/components/Button';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadErrorBanner, { failedLabels, loadErrorText, partialLoadText } from '@/components/LoadErrorBanner';
import { useToast } from '@/components/Toast';
import CustomSelect from '@/components/CustomSelect';

interface MaterialRow {
  id: string;
  material_id: string;
  material_qty: string;
}

interface VariantRow {
  key: string;
  product_variant_id?: string;
  size_id: string;
  color_id: string;
  product_unit_id: string;
  product_variant_price: string;
  product_variant_status: 'active' | 'inactive';
  materials: MaterialRow[];
}

type Policy = Omit<StorePolicyState, 'product_id'>;

const MAX_PRODUCT_FILES = 7;
const MAX_VARIANT_FILES = 5;
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = 'image/*,video/*';

const productModel = new ProductModel();
const categoryModel = new CategoryModel();
const colorModel = new ColorModel();
const materialModel = new MaterialModel();
const productUnitModel = new ProductUnitModel();
const sizeModel = new SizeModel();

const newMaterialRow = (): MaterialRow => ({ id: crypto.randomUUID(), material_id: '', material_qty: '1' });
const newVariantRow = (unit = ''): VariantRow => ({
  key: crypto.randomUUID(),
  size_id: '',
  color_id: '',
  product_unit_id: unit,
  product_variant_price: '',
  product_variant_status: 'active',
  materials: [newMaterialRow()],
});

const toVariantRows = (product: Product): VariantRow[] => {
  const variants = (product.product_variants || product.productVariants || []) as ProductVariant[];
  if (variants.length === 0) return [newVariantRow(String(product.productUnit?.product_unit_id ?? ''))];
  return variants.map((variant) => ({
    key: variant.product_variant_id || crypto.randomUUID(),
    product_variant_id: variant.product_variant_id,
    size_id: String(variant.size?.size_id || variant.size_id || ''),
    color_id: String(variant.color?.color_id || variant.color_id || ''),
    product_unit_id: String(variant.productUnit?.product_unit_id || variant.product_unit_id || ''),
    product_variant_price: variant.product_variant_price === undefined || variant.product_variant_price === null ? '' : String(variant.product_variant_price),
    product_variant_status: variant.product_variant_status === 'inactive' ? 'inactive' : 'active',
    materials: (variant.product_materials || variant.productMaterials || []).length
      ? (variant.product_materials || variant.productMaterials || []).map((material) => ({
          id: crypto.randomUUID(),
          material_id: material.material_id,
          material_qty: String(material.material_qty ?? 1),
        }))
      : [newMaterialRow()],
  }));
};

const splitFiles = (files: ProductFile[] | undefined) => {
  const product: ProductFile[] = [];
  const variant: Record<string, ProductFile[]> = {};
  for (const file of files || []) {
    if (!file.product_variant_id) product.push(file);
    else (variant[String(file.product_variant_id)] ??= []).push(file);
  }
  return { product, variant };
};

const toUpload = (file: File): ProductFile => ({
  product_file_name: file.name,
  product_file_category: file.type.startsWith('video/') ? 'video' : 'image',
  file,
  preview: URL.createObjectURL(file),
});

const fileProblem = (files: File[]) => {
  if (files.some((file) => !file.type.startsWith('image/') && !file.type.startsWith('video/'))) return 'รองรับเฉพาะไฟล์รูปภาพและวิดีโอ';
  if (files.some((file) => file.size > MAX_FILE_SIZE)) return 'ไฟล์ต้องมีขนาดไม่เกิน 30MB';
  return null;
};

const serverMessage = (error: unknown) => {
  const response = (error as { response?: { data?: { message?: string | string[] } }; message?: string }).response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message) return message;
  return (error as { message?: string }).message || 'บันทึกไม่สำเร็จ';
};

const fileUrl = (file: ProductFile) => file.preview ?? `${process.env.NEXT_PUBLIC_API_URL ?? ''}${file.product_file_name}`;

interface ProductEditorProps {
  mode: 'create' | 'edit';
  product?: Product;
  policy?: Policy;
}

/**
 * The product form as a page: product details and one card per variant on the left; the store
 * switches, the pictures and a readiness list on the right; a save bar that stays at the bottom.
 * Validation marks the field and keeps what was typed; a failed save keeps everything too.
 */
export default function ProductEditor({ mode, product, policy: initialPolicy }: ProductEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const initialFiles = useMemo(() => splitFiles(product?.files), [product]);

  const [name, setName] = useState(product?.product_name ?? '');
  const [description, setDescription] = useState(product?.product_description ?? '');
  const [categoryId, setCategoryId] = useState(String(product?.category?.category_id ?? ''));
  const [defaultUnit, setDefaultUnit] = useState(String(product?.productUnit?.product_unit_id ?? ''));
  const [variants, setVariants] = useState<VariantRow[]>(() => (product ? toVariantRows(product) : [newVariantRow()]));
  const [existingProductFiles, setExistingProductFiles] = useState<ProductFile[]>(initialFiles.product);
  const [existingVariantFiles, setExistingVariantFiles] = useState<Record<string, ProductFile[]>>(initialFiles.variant);
  const [newProductFiles, setNewProductFiles] = useState<ProductFile[]>([]);
  const [newVariantFiles, setNewVariantFiles] = useState<Record<string, ProductFile[]>>({});
  const [policy, setPolicy] = useState<Policy>(initialPolicy ?? { published: true, online_purchase: true, contact_enabled: true });

  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const results = await Promise.allSettled([
        categoryModel.getAllCategories(),
        colorModel.getAllColors(),
        sizeModel.getAllSizes(),
        materialModel.getMaterials(1, 400),
        productUnitModel.getAllProductUnits(),
      ]);
      if (!active) return;
      const [categoryRes, colorRes, sizeRes, materialRes, unitRes] = results;
      if (categoryRes.status === 'fulfilled') setCategories(categoryRes.value.data);
      if (colorRes.status === 'fulfilled') setColors(colorRes.value.data);
      if (sizeRes.status === 'fulfilled') setSizes(sizeRes.value.data);
      if (materialRes.status === 'fulfilled') setMaterials(materialRes.value.data);
      if (unitRes.status === 'fulfilled') setUnits(unitRes.value.data);
      const failed = failedLabels(results, ['ประเภทสินค้า', 'สี', 'ขนาด', 'วัตถุดิบ', 'หน่วยสินค้า']);
      setLookupError(failed.length > 0 ? partialLoadText(failed) : null);
    })().catch((error: unknown) => {
      if (active) setLookupError(loadErrorText('รายการตัวเลือก', error));
    });
    return () => {
      active = false;
    };
  }, []);

  // Leaving the browser tab with unsaved edits asks first; leaving through the app's own cancel asks below.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setDirty(true);
    setter(value);
  };

  const categorySizes = useMemo(() => {
    const category = categories.find((item) => String(item.category_id) === categoryId);
    if (!category?.size_ids?.length) return sizes;
    const allowed = new Set(category.size_ids);
    return sizes.filter((size) => allowed.has(size.size_id));
  }, [categories, categoryId, sizes]);

  const sizeName = (id: string) => sizes.find((size) => String(size.size_id) === id)?.size_name;
  const colorName = (id: string) => colors.find((color) => String(color.color_id) === id)?.color_name;
  const materialLabel = (material: Material) =>
    `${material.material_code ? `${material.material_code} · ` : ''}${material.material_name}${material.size?.size_name || material.color?.color_name ? ` (${[material.size?.size_name, material.color?.color_name].filter(Boolean).join(', ')})` : ''}`;

  const setVariant = (key: string, patch: Partial<VariantRow>) => {
    setDirty(true);
    setVariants((prev) => prev.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)));
  };
  const setMaterialRow = (key: string, rowId: string, patch: Partial<MaterialRow>) => {
    setDirty(true);
    setVariants((prev) =>
      prev.map((variant) =>
        variant.key === key
          ? { ...variant, materials: variant.materials.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) }
          : variant,
      ),
    );
  };
  const addVariant = () => {
    setDirty(true);
    setVariants((prev) => [...prev, newVariantRow(defaultUnit)]);
  };
  const copyVariant = (key: string) => {
    setDirty(true);
    setVariants((prev) => {
      const source = prev.find((variant) => variant.key === key);
      if (!source) return prev;
      const copy: VariantRow = {
        ...source,
        key: crypto.randomUUID(),
        product_variant_id: undefined,
        color_id: '',
        materials: source.materials.map((row) => ({ ...row, id: crypto.randomUUID() })),
      };
      const index = prev.indexOf(source);
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  };
  const removeVariant = (key: string) => {
    setDirty(true);
    setVariants((prev) => (prev.length > 1 ? prev.filter((variant) => variant.key !== key) : prev));
    setNewVariantFiles((prev) => {
      (prev[key] || []).forEach((file) => file.preview && URL.revokeObjectURL(file.preview));
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setExistingVariantFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const pickFiles = (files: FileList | null, onOk: (uploads: ProductFile[]) => void, room: number, errorKey: string) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const problem = fileProblem(list) ?? (list.length > room ? `เพิ่มได้อีก ${room} ไฟล์` : null);
    if (problem) {
      setErrors((prev) => ({ ...prev, [errorKey]: problem }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[errorKey];
      return next;
    });
    setDirty(true);
    onOk(list.map(toUpload));
  };

  const productFileCount = existingProductFiles.length + newProductFiles.length;

  // What is still missing, shown in the readiness card and as field errors on save.
  const checks = {
    name: name.trim().length > 0,
    description: description.trim().length > 0,
    category: categoryId !== '',
    variants:
      variants.length > 0 &&
      variants.every(
        (variant) =>
          variant.size_id && variant.color_id && variant.product_unit_id && variant.product_variant_price !== '' && Number(variant.product_variant_price) >= 0,
      ),
    materials: variants.every((variant) => variant.materials.some((row) => row.material_id && Number(row.material_qty) > 0)),
    pictures: productFileCount > 0,
  };
  const readyCount = [checks.name, checks.description, checks.category, checks.variants && checks.materials].filter(Boolean).length;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!checks.name) next.name = 'กรอกชื่อสินค้า';
    if (!checks.description) next.description = 'กรอกคำอธิบาย ลูกค้าเห็นข้อความนี้บนหน้าร้าน';
    if (!checks.category) next.category = 'เลือกประเภทสินค้า';
    variants.forEach((variant, index) => {
      const at = `v${variant.key}`;
      if (!variant.size_id) next[`${at}.size`] = 'เลือกขนาด';
      if (!variant.color_id) next[`${at}.color`] = 'เลือกสี';
      if (!variant.product_unit_id) next[`${at}.unit`] = 'เลือกหน่วยนับ';
      if (variant.product_variant_price === '' || Number(variant.product_variant_price) < 0) next[`${at}.price`] = 'กรอกราคาเป็นตัวเลข 0 ขึ้นไป';
      const rows = variant.materials.filter((row) => row.material_id);
      if (rows.length === 0) next[`${at}.materials`] = `แบบที่ ${index + 1} ต้องมีวัตถุดิบอย่างน้อย 1 รายการ`;
      else if (rows.some((row) => !Number.isInteger(Number(row.material_qty)) || Number(row.material_qty) <= 0)) next[`${at}.materials`] = 'จำนวนวัตถุดิบต่อชิ้นต้องเป็นจำนวนเต็มตั้งแต่ 1';
      else if (new Set(rows.map((row) => row.material_id)).size !== rows.length) next[`${at}.materials`] = 'มีวัตถุดิบซ้ำในแบบเดียวกัน';
      const duplicate = variants.find((other) => other !== variant && other.size_id === variant.size_id && other.color_id === variant.color_id && variant.size_id && variant.color_id);
      if (duplicate) next[`${at}.color`] = 'ขนาดและสีนี้ซ้ำกับแบบอื่น';
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async (publish: boolean) => {
    setSaveError(null);
    if (!validate()) {
      setSaveError('ยังกรอกไม่ครบ ตรวจช่องที่มีข้อความสีแดง ข้อมูลที่กรอกยังอยู่');
      return;
    }
    setSaving(true);
    try {
      const payloadVariants = variants.map((variant) => ({
        ...(variant.product_variant_id ? { product_variant_id: variant.product_variant_id } : {}),
        client_variant_key: variant.key,
        product_variant_price: Number(variant.product_variant_price),
        size_id: Number(variant.size_id),
        color_id: Number(variant.color_id),
        product_unit_id: Number(variant.product_unit_id),
        product_variant_status: variant.product_variant_status,
        product_materials: variant.materials
          .filter((row) => row.material_id)
          .map((row) => ({ material_id: row.material_id, material_qty: Number(row.material_qty) })),
      }));
      const uploads = Object.fromEntries(
        Object.entries(newVariantFiles)
          .map(([key, files]) => [key, files.map((file) => file.file).filter((file): file is File => Boolean(file))])
          .filter(([, files]) => (files as File[]).length > 0),
      ) as Record<string, File[]>;
      const base = {
        product_name: name.trim(),
        product_description: description.trim(),
        category_id: Number(categoryId),
        product_variants: payloadVariants,
        product_files: newProductFiles.map((file) => file.file).filter((file): file is File => Boolean(file)),
        variant_files: uploads,
      };
      let saved: Product;
      if (mode === 'edit' && product) {
        saved = await productModel.updateProduct({
          ...base,
          product_id: product.product_id,
          existing_product_files: existingProductFiles.map((file) => file.product_file_id).filter((id): id is number => Boolean(id)),
          existing_variant_files: Object.fromEntries(
            Object.entries(existingVariantFiles)
              .map(([key, files]) => [key, files.map((file) => file.product_file_id).filter((id): id is number => Boolean(id))])
              .filter(([, ids]) => (ids as number[]).length > 0),
          ) as Record<string, number[]>,
        });
      } else {
        saved = await productModel.createProduct(base);
      }
      const id = saved?.product_id ?? product?.product_id;
      const wanted: Policy = { ...policy, published: publish };
      let policyNote = '';
      if (id) {
        try {
          await axios.patch(`/product/${id}/store-policy`, wanted);
        } catch {
          policyNote = ' แต่ตั้งค่าหน้าร้านไม่สำเร็จ ตั้งได้จากรายการสินค้า';
        }
      }
      [...newProductFiles, ...Object.values(newVariantFiles).flat()].forEach((file) => file.preview && URL.revokeObjectURL(file.preview));
      setDirty(false);
      toast({
        message: `${publish ? 'เปิดขายแล้ว' : 'บันทึกฉบับร่างแล้ว'} “${name.trim()}”${publish ? ' แสดงบนหน้าร้านแล้ว' : ' ยังไม่แสดงบนหน้าร้าน'}${policyNote}`,
        tone: policyNote ? 'info' : 'success',
      });
      router.push('/admin/products');
    } catch (error) {
      setSaveError(`บันทึกไม่สำเร็จ ${serverMessage(error)} ข้อมูลที่กรอกยังอยู่ ลองอีกครั้ง`);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (dirty) setLeaving(true);
    else router.push('/admin/products');
  };

  const field = (key: string) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });
  const FieldError = ({ id }: { id: string }) =>
    errors[id] ? (
      <span id={`${id}-error`} className="ka-error" role="alert">
        {errors[id]}
      </span>
    ) : null;

  const title = mode === 'edit' ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า';

  return (
    <form
      className="ka-page-body ka-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void save(true);
      }}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          void save(true);
        }
      }}
    >
      <div className="ka-ph">
        <div>
          <h1 className="ka-ph__title">{title}</h1>
          <p className="ka-ph__lead">
            {mode === 'edit' && product?.product_code ? `${product.product_code} · ` : ''}
            กรอกข้อมูลหลัก แล้วเพิ่มแบบ (สี/ขนาด) ที่ขายจริง
          </p>
        </div>
        <Link href="/admin/products" className="ka-panel__link">
          ← กลับไปรายการสินค้า
        </Link>
      </div>

      <LoadErrorBanner message={lookupError} className="mb-4" />
      {saveError && (
        <div role="alert" className="ka-banner ka-banner--danger mb-4">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          </svg>
          <span>{saveError}</span>
        </div>
      )}

      <div className="ka-editor__layout">
        <div className="grid gap-6">
          <section className="ka-card" aria-labelledby="product-info">
            <div className="ka-card__head">
              <h2 id="product-info" className="ka-card__title">ข้อมูลสินค้า</h2>
            </div>
            <div className="ka-card__body grid gap-4">
              <div className="ka-field">
                <label htmlFor="product-name" className="ka-label">
                  ชื่อสินค้า <span className="ka-req">*</span>
                </label>
                <input id="product-name" className="ka-input" value={name} maxLength={255} onChange={(event) => touch(setName)(event.target.value)} {...field('name')} />
                <FieldError id="name" />
              </div>
              <div className="ka-field">
                <label htmlFor="product-description" className="ka-label">
                  คำอธิบาย <span className="ka-req">*</span>
                </label>
                <textarea
                  id="product-description"
                  className="ka-input ka-textarea"
                  placeholder="วัสดุ ขนาด จุดเด่น ที่ลูกค้าควรรู้"
                  value={description}
                  onChange={(event) => touch(setDescription)(event.target.value)}
                  {...field('description')}
                />
                <FieldError id="description" />
              </div>
              <div className="ka-editor__g2">
                <div className="ka-field">
                  <label htmlFor="product-category" className="ka-label">
                    ประเภทสินค้า <span className="ka-req">*</span>
                  </label>
                  <CustomSelect
                    id="product-category"
                    value={categoryId}
                    onChange={(value) => touch(setCategoryId)(value)}
                    options={categories.map((category) => ({ value: category.category_id, label: category.category_name }))}
                    placeholder="เลือกประเภทสินค้า"
                    {...field('category')}
                  />
                  <FieldError id="category" />
                </div>
                <div className="ka-field">
                  <label htmlFor="product-unit" className="ka-label">หน่วยนับ</label>
                  <CustomSelect
                    id="product-unit"
                    value={defaultUnit}
                    onChange={(value) => {
                      const unit = value;
                      touch(setDefaultUnit)(unit);
                      // Fills every variant that has no unit yet; a unit already chosen on a variant stays.
                      setVariants((prev) => prev.map((variant) => (variant.product_unit_id ? variant : { ...variant, product_unit_id: unit })));
                    }}
                    options={units.map((unit) => ({ value: unit.product_unit_id, label: unit.product_unit_name }))}
                    placeholder="เลือกหน่วยนับ"
                  />
                  <span className="ka-help">ใช้กับทุกแบบ เปลี่ยนรายแบบได้</span>
                </div>
              </div>
            </div>
          </section>

          <section className="ka-card" aria-labelledby="product-variants">
            <div className="ka-card__head">
              <div>
                <h2 id="product-variants" className="ka-card__title">แบบสินค้า</h2>
                <p className="ka-todo__cap">หนึ่งกล่องต่อสี/ขนาดที่ขาย · {variants.length} แบบ</p>
              </div>
              <Button onClick={addVariant}>
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                เพิ่มแบบ
              </Button>
            </div>
            <div className="ka-card__body grid gap-4">
              {variants.map((variant, index) => {
                const at = `v${variant.key}`;
                const summary = [sizeName(variant.size_id), colorName(variant.color_id)].filter(Boolean).join(' · ');
                const files = [...(existingVariantFiles[variant.product_variant_id ?? variant.key] || []), ...(newVariantFiles[variant.key] || [])];
                return (
                  <article key={variant.key} className="ka-variant" aria-label={`แบบที่ ${index + 1}`}>
                    <div className="ka-variant__head">
                      <span className="font-semibold">แบบที่ {index + 1}</span>
                      <span className="ka-todo__cap">{summary || 'ยังไม่ครบ'}</span>
                      <span className="ka-table-tools__spacer" />
                      <Button variant="ghost" size="sm" icon aria-label={`ทำสำเนาแบบที่ ${index + 1}`} title="ทำสำเนา" onClick={() => copyVariant(variant.key)}>
                        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </Button>
                      <Button variant="ghost" size="sm" icon aria-label={`ลบแบบที่ ${index + 1}`} title="ลบแบบนี้" disabled={variants.length === 1} onClick={() => removeVariant(variant.key)}>
                        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </Button>
                    </div>
                    <div className="ka-variant__body">
                      <div className="ka-editor__vg">
                        <div className="ka-field">
                          <label htmlFor={`${at}-size`} className="ka-label">ขนาด <span className="ka-req">*</span></label>
                          <CustomSelect
                            id={`${at}-size`}
                            value={variant.size_id}
                            onChange={(value) => setVariant(variant.key, { size_id: value })}
                            options={categorySizes.map((size) => ({ value: size.size_id, label: size.size_name }))}
                            placeholder="เลือกขนาด"
                            {...field(`${at}.size`)}
                          />
                          <FieldError id={`${at}.size`} />
                        </div>
                        <div className="ka-field">
                          <label htmlFor={`${at}-color`} className="ka-label">สี <span className="ka-req">*</span></label>
                          <CustomSelect
                            id={`${at}-color`}
                            value={variant.color_id}
                            onChange={(value) => setVariant(variant.key, { color_id: value })}
                            options={colors.map((color) => ({ value: color.color_id, label: color.color_name }))}
                            placeholder="เลือกสี"
                            {...field(`${at}.color`)}
                          />
                          <FieldError id={`${at}.color`} />
                        </div>
                        <div className="ka-field">
                          <label htmlFor={`${at}-price`} className="ka-label">ราคา (บาท) <span className="ka-req">*</span></label>
                          <input
                            id={`${at}-price`}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            className="ka-input numeric text-right"
                            placeholder="0.00"
                            value={variant.product_variant_price}
                            onChange={(event) => setVariant(variant.key, { product_variant_price: event.target.value })}
                            {...field(`${at}.price`)}
                          />
                          <FieldError id={`${at}.price`} />
                        </div>
                        <div className="ka-field">
                          <label htmlFor={`${at}-status`} className="ka-label">สถานะ</label>
                          <CustomSelect
                            id={`${at}-status`}
                            value={variant.product_variant_status}
                            onChange={(value) => setVariant(variant.key, { product_variant_status: value as VariantRow['product_variant_status'] })}
                            options={[
                              { value: "active", label: 'เปิดขาย' },
                              { value: "inactive", label: 'ปิดขาย' },
                            ]}
                          />
                        </div>
                        <div className="ka-field">
                          <label htmlFor={`${at}-unit`} className="ka-label">หน่วยนับ <span className="ka-req">*</span></label>
                          <CustomSelect
                            id={`${at}-unit`}
                            value={variant.product_unit_id}
                            onChange={(value) => setVariant(variant.key, { product_unit_id: value })}
                            options={units.map((unit) => ({ value: unit.product_unit_id, label: unit.product_unit_name }))}
                            placeholder="เลือกหน่วยนับ"
                            {...field(`${at}.unit`)}
                          />
                          <FieldError id={`${at}.unit`} />
                        </div>
                      </div>

                      <div className="ka-variant__materials">
                        <div className="flex items-center justify-between gap-2">
                          <span className="ka-label">วัตถุดิบต่อ 1 ชิ้น</span>
                          <Button variant="ghost" size="sm" onClick={() => setVariant(variant.key, { materials: [...variant.materials, newMaterialRow()] })}>
                            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            เพิ่ม
                          </Button>
                        </div>
                        {variant.materials.map((row, rowIndex) => {
                          const taken = new Set(variant.materials.filter((other) => other.id !== row.id && other.material_id).map((other) => other.material_id));
                          return (
                            <div key={row.id} className="ka-mrow">
                              <CustomSelect
                                aria-label={`วัตถุดิบ ${rowIndex + 1}`}
                                value={row.material_id}
                                onChange={(value) => setMaterialRow(variant.key, row.id, { material_id: value })}
                                options={materials.map((material) => ({ value: material.material_id, label: materialLabel(material), disabled: taken.has(material.material_id) }))}
                                placeholder="เลือกวัตถุดิบ"
                              />
                              <input
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                className="ka-input numeric text-right"
                                aria-label={`จำนวนวัตถุดิบ ${rowIndex + 1} ต่อชิ้น`}
                                value={row.material_qty}
                                onChange={(event) => setMaterialRow(variant.key, row.id, { material_qty: event.target.value })}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                icon
                                aria-label={`ลบวัตถุดิบ ${rowIndex + 1}`}
                                disabled={variant.materials.length === 1}
                                onClick={() => setVariant(variant.key, { materials: variant.materials.filter((other) => other.id !== row.id) })}
                              >
                                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </Button>
                            </div>
                          );
                        })}
                        <FieldError id={`${at}.materials`} />
                      </div>

                      <div className="ka-variant__files">
                        <div className="flex items-center justify-between gap-2">
                          <span className="ka-label">รูปของแบบนี้</span>
                          <span className="ka-todo__cap numeric">{files.length}/{MAX_VARIANT_FILES}</span>
                        </div>
                        <div className="ka-files">
                          {files.map((file, fileIndex) => (
                            <figure key={`${file.product_file_id ?? 'new'}-${fileIndex}`} className="ka-files__item">
                              {file.product_file_category === 'image' ? (
                                // eslint-disable-next-line @next/next/no-img-element -- the API serves uploads outside the image loader
                                <img src={fileUrl(file)} alt="" />
                              ) : (
                                <video src={fileUrl(file)} muted />
                              )}
                              <button
                                type="button"
                                className="ka-files__remove"
                                aria-label={`ลบไฟล์ ${file.product_file_name}`}
                                onClick={() => {
                                  setDirty(true);
                                  if (file.product_file_id) {
                                    setExistingVariantFiles((prev) => ({ ...prev, [variant.product_variant_id ?? variant.key]: (prev[variant.product_variant_id ?? variant.key] || []).filter((item) => item !== file) }));
                                  } else {
                                    if (file.preview) URL.revokeObjectURL(file.preview);
                                    setNewVariantFiles((prev) => ({ ...prev, [variant.key]: (prev[variant.key] || []).filter((item) => item !== file) }));
                                  }
                                }}
                              >
                                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </figure>
                          ))}
                          {files.length < MAX_VARIANT_FILES && (
                            <label className="ka-files__add">
                              <input
                                type="file"
                                multiple
                                accept={ACCEPTED_FILE_TYPES}
                                className="sr-only"
                                onChange={(event) => {
                                  pickFiles(event.target.files, (uploads) => setNewVariantFiles((prev) => ({ ...prev, [variant.key]: [...(prev[variant.key] || []), ...uploads] })), MAX_VARIANT_FILES - files.length, `${at}.files`);
                                  event.target.value = '';
                                }}
                              />
                              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                              <span>เพิ่มรูป</span>
                            </label>
                          )}
                        </div>
                        <FieldError id={`${at}.files`} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="ka-editor__aside">
          <section className="ka-card" aria-labelledby="product-store">
            <div className="ka-card__head">
              <h2 id="product-store" className="ka-card__title">หน้าร้านออนไลน์</h2>
            </div>
            <div className="ka-card__body py-2">
              {(
                [
                  ['published', 'แสดงบนหน้าร้าน', 'ลูกค้าเห็นสินค้านี้'],
                  ['online_purchase', 'ซื้อออนไลน์ได้', 'มีปุ่มเพิ่มลงตะกร้า'],
                  ['contact_enabled', 'ขอติดต่อกลับได้', 'เมื่อสินค้าหมด'],
                ] as [keyof Policy, string, string][]
              ).map(([key, label, hint]) => (
                <div key={key} className="ka-switch-row">
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="ka-todo__cap">{hint}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={policy[key]}
                    aria-label={label}
                    className="ka-switch"
                    onClick={() => {
                      setDirty(true);
                      setPolicy((prev) => ({ ...prev, [key]: !prev[key] }));
                    }}
                  >
                    <span className="ka-switch__knob" />
                  </button>
                </div>
              ))}
              <p className="ka-todo__cap pt-2">“บันทึกและเปิดขาย” เปิดแสดงบนหน้าร้านให้; “บันทึกฉบับร่าง” ซ่อนไว้ก่อน</p>
            </div>
          </section>

          <section className="ka-card" aria-labelledby="product-pictures">
            <div className="ka-card__head">
              <h2 id="product-pictures" className="ka-card__title">รูปสินค้า</h2>
              <span className="ka-todo__cap numeric">{productFileCount}/{MAX_PRODUCT_FILES}</span>
            </div>
            <div className="ka-card__body grid gap-3">
              <div className="ka-files">
                {[...existingProductFiles, ...newProductFiles].map((file, fileIndex) => (
                  <figure key={`${file.product_file_id ?? 'new'}-${fileIndex}`} className="ka-files__item">
                    {file.product_file_category === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the API serves uploads outside the image loader
                      <img src={fileUrl(file)} alt="" />
                    ) : (
                      <video src={fileUrl(file)} muted />
                    )}
                    {fileIndex === 0 && <figcaption className="ka-files__main">รูปหลัก</figcaption>}
                    <button
                      type="button"
                      className="ka-files__remove"
                      aria-label={`ลบไฟล์ ${file.product_file_name}`}
                      onClick={() => {
                        setDirty(true);
                        if (file.product_file_id) setExistingProductFiles((prev) => prev.filter((item) => item !== file));
                        else {
                          if (file.preview) URL.revokeObjectURL(file.preview);
                          setNewProductFiles((prev) => prev.filter((item) => item !== file));
                        }
                      }}
                    >
                      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </figure>
                ))}
              </div>
              {productFileCount < MAX_PRODUCT_FILES && (
                <label
                  className="ka-drop"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    pickFiles(event.dataTransfer.files, (uploads) => setNewProductFiles((prev) => [...prev, ...uploads]), MAX_PRODUCT_FILES - productFileCount, 'files');
                  }}
                >
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    className="sr-only"
                    onChange={(event) => {
                      pickFiles(event.target.files, (uploads) => setNewProductFiles((prev) => [...prev, ...uploads]), MAX_PRODUCT_FILES - productFileCount, 'files');
                      event.target.value = '';
                    }}
                  />
                  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="font-semibold">ลากรูปมาวาง หรือ <span className="ka-panel__link">เลือกไฟล์</span></span>
                  <span className="ka-todo__cap">JPG, PNG, WebP หรือวิดีโอ · สูงสุด {MAX_PRODUCT_FILES} ไฟล์ · รูปแรกเป็นรูปหลัก</span>
                </label>
              )}
              <FieldError id="files" />
            </div>
          </section>

          <section className="ka-card" aria-labelledby="product-ready">
            <div className="ka-card__head">
              <h2 id="product-ready" className="ka-card__title">ความพร้อม</h2>
              <span className="ka-todo__cap numeric">{readyCount} จาก 4</span>
            </div>
            <ul className="ka-card__body ka-ready">
              <li data-state={checks.name ? 'ok' : 'todo'}>{checks.name ? 'ชื่อสินค้า' : <a href="#product-name">ยังไม่มีชื่อสินค้า</a>}</li>
              <li data-state={checks.description ? 'ok' : 'todo'}>{checks.description ? 'คำอธิบาย' : <a href="#product-description">ยังไม่มีคำอธิบาย</a>}</li>
              <li data-state={checks.category ? 'ok' : 'todo'}>{checks.category ? 'ประเภทสินค้า' : <a href="#product-category">ยังไม่ได้เลือกประเภท</a>}</li>
              <li data-state={checks.variants && checks.materials ? 'ok' : 'todo'}>
                {checks.variants && checks.materials ? `มี ${variants.length} แบบ พร้อมวัตถุดิบ` : <a href="#product-variants">แบบสินค้ายังกรอกไม่ครบ</a>}
              </li>
              <li data-state={checks.pictures ? 'ok' : 'optional'}>{checks.pictures ? 'รูปสินค้า' : 'ยังไม่มีรูปสินค้า (ไม่บังคับ)'}</li>
            </ul>
          </section>
        </aside>
      </div>

      <div className="ka-savebar">
        <span className="ka-todo__cap ka-savebar__hint" role="status">{saving ? 'กำลังบันทึก…' : dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'ยังไม่ได้บันทึก'}</span>
        <span className="ka-table-tools__spacer" />
        <Button variant="ghost" onClick={cancel} disabled={saving}>ยกเลิก</Button>
        <Button onClick={() => void save(false)} disabled={saving}>บันทึกฉบับร่าง</Button>
        <Button variant="action" type="submit" loading={saving}>บันทึกและเปิดขาย</Button>
      </div>

      <ConfirmDialog
        isOpen={leaving}
        title="ยังไม่ได้บันทึกการแก้ไข"
        message={`ถ้าออกตอนนี้ ข้อมูล${name.trim() ? ` “${name.trim()}”` : ''} ที่กรอกไว้จะหายไป`}
        confirmLabel="ทิ้งการแก้ไข"
        cancelLabel="แก้ไขต่อ"
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setDirty(false);
          router.push('/admin/products');
        }}
      />
    </form>
  );
}
