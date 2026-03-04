'use client';

import { useEffect, useState } from 'react';
import ProductModel from '@/models/product';
import { Product, ProductMaterial } from '@/types/product';

interface ProductDetailProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;

}

const normalizeMaterials = (product: Product): ProductMaterial[] => {
  return product.product_materials || product.productMaterials || [];
};

const productModel = new ProductModel();

type ProductDescriptionItem = {
  icon?: string;
  text?: string;
};

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
  const materials = normalizeMaterials(currentProduct);
  const descriptions = parseDescription(currentProduct.product_description);
  const fieldClassName =
    'rounded-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-300/40 dark:bg-gray-950/60" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">รายละเอียดสินค้า</h2>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-200">ข้อมูลสินค้า</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อสินค้า</p>
                <div className={fieldClassName}>{currentProduct.product_name || '-'}</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ราคา</p>
                <div className={fieldClassName}>{new Intl.NumberFormat('th-TH').format(currentProduct.product_price)} บาท</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ประเภท</p>
                <div className={fieldClassName}>{currentProduct.category?.category_name || '-'}</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">สี</p>
                <div className={fieldClassName}>{currentProduct.color?.color_name || '-'}</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">หน่วยสินค้า</p>
                <div className={fieldClassName}>{currentProduct.productUnit?.product_unit_name || '-'}</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">สถานะสต็อก</p>
                <div className={fieldClassName}>{currentProduct.stock?.stock_status || '-'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
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
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">สูตรวัตถุดิบ (Product Material)</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{materials.length} รายการ</span>
            </div>

            {materials.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">วัตถุดิบ</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">จำนวนต่อ 1 ชิ้น</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                    {materials.map((material, index) => (
                      <tr key={material.product_material_id || `${material.material_id}-${index}`}>
                        <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-100">
                          {material.material?.material_name || material.material_id}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-100">{material.material_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                ไม่พบข้อมูลวัตถุดิบ
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">ไฟล์สินค้า</h3>
            {currentProduct.files && currentProduct.files.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {currentProduct.files.map((file, index) => (
                  <div key={file.product_file_id || index} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
                    {file.product_file_category === 'image' ? (
                      <img
                        src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name}
                        alt={file.product_file_name}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <video
                        src={process.env.NEXT_PUBLIC_API_URL + file.product_file_name}
                        className="aspect-square w-full object-cover"
                        controls
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                ไม่มีไฟล์แนบ
              </div>
            )}
          </div>

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
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/50">
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
