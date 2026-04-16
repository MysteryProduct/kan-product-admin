'use client';

import { useEffect, useState } from 'react';
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
    'rounded-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-gray-900/40 dark:bg-black/70" onClick={onClose} />

      <div className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 dark:border-gray-700 dark:bg-gray-800/95">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-100">รายละเอียดสินค้าแบบ ER</h2>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-200">Product หลัก</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อสินค้า</p>
                <div className={fieldClassName}>{currentProduct.product_name || '-'}</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ประเภท</p>
                <div className={fieldClassName}>{currentProduct.category?.category_name || '-'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">คำอธิบายสินค้า</h3>
            <div className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 dark:border-gray-600 dark:bg-gray-700">
              {descriptions.length > 0 ? (
                <ul className="space-y-2 text-sm text-gray-800 dark:text-gray-100">
                  {descriptions.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-0.5">{item.icon || '•'}</span>
                      <span>{item.text || '-'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">-</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Product Variants</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">{variants.length} variants</span>
            </div>

            {variants.length > 0 ? (
              <div className="space-y-4">
                {variants.map((variant, index) => {
                  const variantId = variant.product_variant_id ? String(variant.product_variant_id) : `unknown-${index}`;
                  const materials = variant.product_materials || variant.productMaterials || [];

                  return (
                    <div key={variantId} className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-700">Variant #{index + 1}</span>
                        <span className="rounded bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">ID: {variant.product_variant_id || '-'}</span>
                        <span className="rounded bg-green-50 px-2 py-1 text-green-700 dark:bg-green-500/20 dark:text-green-200">ไฟล์: {variantFileCountMap[String(variant.product_variant_id || '')] || 0}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className={fieldClassName}>ราคา: {new Intl.NumberFormat('th-TH').format(variant.product_variant_price || 0)} บาท</div>
                        <div className={fieldClassName}>Size: {variant.size?.size_name || variant.size_id || '-'}</div>
                        <div className={fieldClassName}>Color: {variant.color?.color_name || variant.color_id || '-'}</div>
                        <div className={fieldClassName}>Unit: {variant.productUnit?.product_unit_name || variant.product_unit_id || '-'}</div>
                      </div>

                      <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                        <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Product Material ของ Variant นี้</p>
                        {materials.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">วัตถุดิบ</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">จำนวน</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {materials.map((material, materialIndex) => (
                                  <tr key={material.product_material_id || `${material.material_id}-${materialIndex}`}>
                                    <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-100">{material.material?.material_name || material.material_id}</td>
                                    <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-100">{material.material_qty}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มี Product Material</p>
                        )}
                      </div>

                      {variant.product_variant_id && (variantFiles[String(variant.product_variant_id)] || []).length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">ไฟล์ของ Variant</p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {(variantFiles[String(variant.product_variant_id)] || []).map((file, fileIndex) => (
                              <div key={`${variantId}-file-${fileIndex}`} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
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
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                ไม่พบข้อมูล Variant
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">ไฟล์ Product หลัก</h3>
            {productFiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {productFiles.map((file, index) => (
                  <div key={file.product_file_id || index} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
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
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                ไม่มีไฟล์ Product หลัก
              </div>
            )}
          </section>

          <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              ปิด
            </button>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/50">
            <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <p className="font-medium text-gray-700 dark:text-gray-200">กำลังโหลดรายละเอียดสินค้า...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
