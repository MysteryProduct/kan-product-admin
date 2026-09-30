'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import ProductModel from '@/models/product';
import { Product, ProductFile, ProductVariant } from '@/types/product';

interface ProductDetailProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

type ProductDescriptionItem = {
  icon?: string;
  text?: string;
};

const productModel = new ProductModel();

const parseDescription = (rawDescription: string): ProductDescriptionItem[] => {
  try {
    const parsed = JSON.parse(rawDescription);
    if (Array.isArray(parsed)) {
      return parsed as ProductDescriptionItem[];
    }
  } catch {
    return rawDescription
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({ icon: '', text: line }));
  }

  return [];
};

const resolveVariants = (product: Product): ProductVariant[] => {
  const variants = (product.product_variants || product.productVariants || []) as ProductVariant[];
  if (variants.length > 0) {
    return variants;
  }

  return [];
};

const splitFilesByScope = (files: ProductFile[] | undefined) => {
  const productFiles = (files || []).filter((file) => !file.product_variant_id);
  const variantFiles: Record<string, ProductFile[]> = {};

  (files || []).forEach((file) => {
    if (!file.product_variant_id) {
      return;
    }

    const key = String(file.product_variant_id);
    if (!variantFiles[key]) {
      variantFiles[key] = [];
    }
    variantFiles[key].push(file);
  });

  return { productFiles, variantFiles };
};

export default function ProductDetailModal({ isOpen, onClose, product }: ProductDetailProps) {
  const [detailData, setDetailData] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !product?.product_id) {
      return;
    }

    const fetchProductDetail = async () => {
      try {
        setLoading(true);
        const response = await productModel.getProductById(product.product_id);
        setDetailData(response);
      } catch (error) {
        console.error('Failed to fetch product detail:', error);
        setDetailData(product);
      } finally {
        setLoading(false);
      }
    };

    void fetchProductDetail();
  }, [isOpen, product]);

  if (!isOpen || !product) {
    return null;
  }

  const currentProduct = detailData || product;
  const variants = resolveVariants(currentProduct);
  const descriptions = parseDescription(currentProduct.product_description);
  const { productFiles, variantFiles } = splitFilesByScope(currentProduct.files);

  const variantFileCountMap: Record<string, number> = {};
  Object.entries(variantFiles).forEach(([variantId, files]) => {
    variantFileCountMap[variantId] = files.length;
  });

  const fieldClassName =
    'rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-sm text-[var(--ink)]';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="รายละเอียดสินค้าแบบ ER"
      size="xl"
      footer={
        <button type="button" onClick={onClose} className="ka-btn">
          ปิด
        </button>
      }
    >
      <div className="relative">
        <div className="space-y-6">
          <section className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="mb-4 text-sm font-semibold text-[var(--ink)]">Product หลัก</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--ink)]">ชื่อสินค้า</p>
                <div className={fieldClassName}>{currentProduct.product_name || '-'}</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--ink)]">ประเภท</p>
                <div className={fieldClassName}>{currentProduct.category?.category_name || '-'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">คำอธิบายสินค้า</h3>
            <div className="rounded-lg border border-[var(--border-control)] bg-[var(--bg-muted)] px-4 py-3">
              {descriptions.length > 0 ? (
                <ul className="space-y-2 text-sm text-[var(--ink)]">
                  {descriptions.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-0.5">{item.icon || '•'}</span>
                      <span>{item.text || '-'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--ink-muted)]">-</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--ink)]">Product Variants</h3>
              <span className="text-sm text-[var(--ink-muted)]">{variants.length} variants</span>
            </div>

            {variants.length > 0 ? (
              <div className="space-y-4">
                {variants.map((variant, index) => {
                  const variantId = variant.product_variant_id ? String(variant.product_variant_id) : `unknown-${index}`;
                  const materials = variant.product_materials || variant.productMaterials || [];

                  return (
                    <div key={variantId} className="rounded-lg border border-[var(--border)] p-3">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-muted)]">
                        <span className="rounded bg-[var(--bg-muted)] px-2 py-1">Variant #{index + 1}</span>
                        <span className="rounded bg-[var(--brand-soft)] px-2 py-1 text-[var(--brand-ink)]">ID: {variant.product_variant_id || '-'}</span>
                        <span className="rounded bg-[var(--success-soft)] px-2 py-1 text-[var(--success)]">ไฟล์: {variantFileCountMap[String(variant.product_variant_id || '')] || 0}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className={fieldClassName}>ราคา: {new Intl.NumberFormat('th-TH').format(variant.product_variant_price || 0)} บาท</div>
                        <div className={fieldClassName}>Size: {variant.size?.size_name || variant.size_id || '-'}</div>
                        <div className={fieldClassName}>Color: {variant.color?.color_name || variant.color_id || '-'}</div>
                        <div className={fieldClassName}>Unit: {variant.productUnit?.product_unit_name || variant.product_unit_id || '-'}</div>
                      </div>

                      <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
                        <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Product Material ของ Variant นี้</p>
                        {materials.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-[var(--border)]">
                              <thead className="bg-[var(--bg-muted)]">
                                <tr>
                                  <th className="px-3 py-2 text-left text-[13px] font-semibold text-[var(--ink-muted)]">วัตถุดิบ</th>
                                  <th className="px-3 py-2 text-left text-[13px] font-semibold text-[var(--ink-muted)]">จำนวน</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {materials.map((material, materialIndex) => (
                                  <tr key={material.product_material_id || `${material.material_id}-${materialIndex}`}>
                                    <td className="px-3 py-2 text-sm text-[var(--ink)]">{material.material?.material_name || material.material_id}</td>
                                    <td className="px-3 py-2 text-sm text-[var(--ink)]">{material.material_qty}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--ink-muted)]">ไม่มี Product Material</p>
                        )}
                      </div>

                      {variant.product_variant_id && (variantFiles[String(variant.product_variant_id)] || []).length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">ไฟล์ของ Variant</p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {(variantFiles[String(variant.product_variant_id)] || []).map((file, fileIndex) => (
                              <div key={`${variantId}-file-${fileIndex}`} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]">
                                {file.product_file_category === 'image' ? (
                                  <img
                                    src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name}
                                    alt={file.product_file_name}
                                    className="h-24 w-full object-cover"
                                  />
                                ) : (
                                  <video
                                    src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name}
                                    className="h-24 w-full object-cover"
                                    controls
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-control)] px-4 py-4 text-sm text-[var(--ink-muted)]">
                ไม่พบข้อมูล Variant
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">ไฟล์ Product หลัก</h3>
            {productFiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {productFiles.map((file, index) => (
                  <div key={file.product_file_id || index} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]">
                    {file.product_file_category === 'image' ? (
                      <img
                        src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name}
                        alt={file.product_file_name}
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <video
                        src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name}
                        className="h-24 w-full object-cover"
                        controls
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border-control)] px-4 py-4 text-sm text-[var(--ink-muted)]">
                ไม่มีไฟล์ Product หลัก
              </div>
            )}
          </section>
        </div>

        {loading && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-24 rounded-lg bg-[var(--scrim)]">
            <div className="flex flex-col items-center gap-4 rounded-lg bg-[var(--bg-surface)] p-6">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--action)] border-t-transparent" />
              <p className="font-medium text-[var(--ink)]">กำลังโหลดรายละเอียดสินค้า...</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
