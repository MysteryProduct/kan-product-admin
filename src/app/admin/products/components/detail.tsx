'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import ProductModel, { StorePolicyState } from '@/models/product';
import { Product, ProductFile, ProductVariant } from '@/types/product';
import { formatBaht } from '@/components/charts/scale';
import { formatThaiDate } from '@/lib/date-format';
import { getStockStatus, STOCK_STATUS_LABELS } from './product-stock';

interface ProductDetailProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  /**
   * The product's store switches as the table read them. When the table has none for this
   * product (still loading, or the product left the page), the dialog reads them itself.
   */
  policy?: StorePolicyState;
  /** Colour hexes by colour name, for variants whose colour arrives without one. */
  colorHexes?: ReadonlyMap<string, string>;
  /** Each action is shown only when the caller passes it (the caller checks permission). */
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onEditPolicy?: (product: Product) => void;
}

type ProductDescriptionItem = {
  icon?: string;
  text?: string;
};

// The editor's limit on pictures and videos of the product itself (product-editor.tsx).
const MAX_PRODUCT_FILES = 7;

const STORE_SWITCHES: { key: 'published' | 'online_purchase' | 'contact_enabled'; label: string }[] = [
  { key: 'published', label: 'แสดงบนหน้าร้าน' },
  { key: 'online_purchase', label: 'ซื้อออนไลน์ได้' },
  { key: 'contact_enabled', label: 'ขอติดต่อกลับได้' },
];

const productModel = new ProductModel();
const qtyFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

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

const resolveVariants = (product: Product): ProductVariant[] =>
  (product.product_variants || product.productVariants || []) as ProductVariant[];

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

const fileUrl = (file: ProductFile) => process.env.NEXT_PUBLIC_API_URL + file.product_file_name;

// Stock rows exist only once a job order has closed, so no rows means nothing is in stock;
// `undefined` (rows not sent) shows no badge rather than a guess.
const remainOf = (variant: ProductVariant): number | null =>
  variant.stockProducts
    ? variant.stockProducts.reduce((sum, row) => sum + Number(row.stock_product_remain_qty || 0), 0)
    : null;

// What a customer meets in the store, as kan-product-store shows it: the catalog lists only
// published products (store-catalog.service.ts), and a sold-out listed product offers
// "สอบถามได้" with the contact form only while contact is on (product-card.tsx).
function storeNote(policy: StorePolicyState, soldOut: boolean): string {
  if (!policy.published) return 'ไม่แสดงบนหน้าร้าน ลูกค้าไม่เห็นสินค้านี้';
  if (!soldOut) return '';
  return policy.contact_enabled
    ? 'สินค้าหมด ลูกค้าเห็น “สอบถามได้” และส่งคำขอให้ร้านติดต่อกลับได้'
    : 'สินค้าหมด ลูกค้าซื้อหรือสอบถามออนไลน์ไม่ได้';
}

function FileView({ file, label }: { file: ProductFile; label: string }) {
  return file.product_file_category === 'image' ? (
    // eslint-disable-next-line @next/next/no-img-element -- uploads are served by the API host as they are
    <img src={fileUrl(file)} alt={label} loading="lazy" />
  ) : (
    <video src={fileUrl(file)} muted preload="metadata" aria-label={label} />
  );
}

function CupIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10l-1.5 16h-7zM17 8h2.5v5H17" />
    </svg>
  );
}

export default function ProductDetailModal({
  isOpen,
  onClose,
  product,
  policy,
  colorHexes,
  onEdit,
  onDelete,
  onEditPolicy,
}: ProductDetailProps) {
  const [detailData, setDetailData] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(0);
  const [ownPolicy, setOwnPolicy] = useState<{ id: string; policy?: StorePolicyState; failed?: boolean } | null>(null);
  const needOwnPolicy = isOpen && !!product && !policy;
  const productId = product?.product_id;

  useEffect(() => {
    if (!isOpen || !product?.product_id) {
      return;
    }

    const fetchProductDetail = async () => {
      try {
        setLoading(true);
        setPicked(0);
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

  useEffect(() => {
    if (!needOwnPolicy || !productId) return;
    let active = true;
    productModel
      .getStorePolicies([productId])
      .then((rows) => {
        if (active) setOwnPolicy({ id: productId, policy: rows.find((row) => row.product_id === productId), failed: false });
      })
      .catch(() => {
        if (active) setOwnPolicy({ id: productId, failed: true });
      });
    return () => {
      active = false;
    };
  }, [needOwnPolicy, productId]);

  if (!isOpen || !product) {
    return null;
  }

  // The detail read may still hold the previous product; use it only once it is this one.
  const currentProduct = detailData?.product_id === product.product_id ? detailData : product;
  const own = ownPolicy?.id === product.product_id ? ownPolicy : null;
  const storePolicy = policy ?? own?.policy;
  const policyFailed = !policy && (own?.failed || (own && !own.policy));
  const variants = resolveVariants(currentProduct);
  const descriptions = parseDescription(currentProduct.product_description || '').filter((item) => item.text?.trim());
  const { productFiles, variantFiles } = splitFilesByScope(currentProduct.files);
  const mainFile = productFiles[picked] ?? productFiles[0];
  const stock = getStockStatus(currentProduct);
  const stockTone = stock === 'in stock' ? 'success' : stock === 'out stock' ? 'danger' : 'neutral';
  const addedOn = currentProduct.adddate ? formatThaiDate(currentProduct.adddate, { fallback: '' }) : '';
  const prices = variants.map((variant) => Number(variant.product_variant_price || 0));
  const remains = variants.map(remainOf).filter((value): value is number => value !== null);
  const units = [...new Set(variants.map((variant) => variant.productUnit?.product_unit_name).filter(Boolean))];
  const subline = [
    currentProduct.category?.category_name,
    `${variants.length} แบบ`,
    addedOn && `เพิ่มเมื่อ ${addedOn}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentProduct.product_name || '-'}
      description={subline}
      closeLabel="ปิด"
      size="detail"
      className="ka-pm"
      media={
        <span className="ka-pm__thumb">
          {mainFile ? <FileView file={mainFile} label={`รูปหลักของ ${currentProduct.product_name}`} /> : <CupIcon />}
        </span>
      }
      eyebrow={
        <div className="ka-pm__eyebrow">
          {currentProduct.product_code && <span className="ka-pm__code">{currentProduct.product_code}</span>}
          <span className={`ka-badge ka-badge--${stockTone}`}>{STOCK_STATUS_LABELS[stock] ?? stock}</span>
        </div>
      }
      footer={
        <>
          {onDelete && (
            <button type="button" className="ka-btn ka-pm__danger" onClick={() => onDelete(currentProduct)}>
              ลบสินค้า
            </button>
          )}
          <button type="button" onClick={onClose} className="ka-btn">
            ปิด
          </button>
          {onEdit && (
            <button type="button" className="ka-btn ka-btn--primary" onClick={() => onEdit(currentProduct)}>
              <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 19l1-4L16 5l3 3L9 18z" />
              </svg>
              แก้ไขสินค้า
            </button>
          )}
        </>
      }
    >
      <div className="relative">
        <div className="ka-pm__stack" aria-busy={loading || undefined}>
          <div className="ka-pm__gal" role="group" aria-label="รูปสินค้า">
            {productFiles.map((file, index) => (
              <button
                key={file.product_file_id || index}
                type="button"
                className="ka-pm__tile"
                aria-pressed={file === mainFile}
                aria-label={`รูปที่ ${index + 1}`}
                onClick={() => setPicked(index)}
              >
                <FileView file={file} label="" />
                {file.product_file_category === 'video' && (
                  <span className="ka-pm__play" aria-hidden="true">
                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                )}
              </button>
            ))}
            {onEdit && productFiles.length < MAX_PRODUCT_FILES ? (
              <button
                type="button"
                className="ka-pm__tile ka-pm__tile--count"
                aria-label={`เพิ่มรูป มี ${productFiles.length} จาก ${MAX_PRODUCT_FILES} รูป`}
                onClick={() => onEdit(currentProduct)}
              >
                <span aria-hidden="true">เพิ่มรูป<br /><span className="ka-pm__num">{productFiles.length}/{MAX_PRODUCT_FILES}</span></span>
              </button>
            ) : (
              <span className="ka-pm__tile ka-pm__tile--count">
                <span aria-hidden="true" className="ka-pm__num">{productFiles.length}/{MAX_PRODUCT_FILES}</span>
                <span className="sr-only">มี {productFiles.length} จาก {MAX_PRODUCT_FILES} รูป</span>
              </span>
            )}
          </div>

          <dl className="ka-pm__kv">
            <div>
              <dt>ราคา</dt>
              <dd className="ka-pm__num">
                {prices.length === 0
                  ? '-'
                  : Math.min(...prices) === Math.max(...prices)
                    ? formatBaht(prices[0])
                    : `${formatBaht(Math.min(...prices))} – ${formatBaht(Math.max(...prices))}`}
              </dd>
            </div>
            <div>
              <dt>คงเหลือรวม</dt>
              <dd className="ka-pm__num">{remains.length ? `${qtyFormat.format(remains.reduce((a, b) => a + b, 0))} ชิ้น` : '-'}</dd>
            </div>
            <div>
              <dt>หน่วย</dt>
              <dd>{units.length ? units.join(', ') : '-'}</dd>
            </div>
          </dl>

          <section className="ka-pm__sec" aria-labelledby="pm-desc">
            <h3 id="pm-desc" className="ka-pm__h3">คำอธิบาย</h3>
            {descriptions.length > 0 ? (
              descriptions.map((item, index) => (
                <p key={index} className="ka-pm__desc">{item.text}</p>
              ))
            ) : (
              <p className="ka-pm__desc text-[var(--ink-muted)]">ยังไม่มีคำอธิบาย</p>
            )}
          </section>

          <section className="ka-pm__sec" aria-labelledby="pm-store">
            <div className="ka-pm__sech">
              <h3 id="pm-store" className="ka-pm__h3">หน้าร้านออนไลน์</h3>
              {onEditPolicy && (
                <button type="button" className="ka-pm__link" onClick={() => onEditPolicy(currentProduct)}>
                  ตั้งค่า
                </button>
              )}
            </div>
            {storePolicy ? (
              <ul className="ka-pm__store">
                {STORE_SWITCHES.map((item) =>
                  storePolicy[item.key] ? (
                    <li key={item.key} className="is-on">
                      <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                      {item.label}
                    </li>
                  ) : (
                    <li key={item.key} className="is-off">
                      {item.label} <b>ปิด</b>
                    </li>
                  ),
                )}
              </ul>
            ) : policyFailed ? (
              <p className="ka-pm__cap">ยังโหลดการตั้งค่าหน้าร้านไม่ได้</p>
            ) : (
              <span className="ka-skel" style={{ width: 320, maxWidth: '100%', height: 32 }} role="status" aria-label="กำลังโหลดการตั้งค่าหน้าร้าน" />
            )}
            {storePolicy && storeNote(storePolicy, stock === 'out stock') && (
              <div className="ka-pm__note">
                <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4l9 16H3zM12 10v4M12 17h.01" />
                </svg>
                <span>{storeNote(storePolicy, stock === 'out stock')}</span>
              </div>
            )}
          </section>

          <section className="ka-pm__sec" aria-labelledby="pm-vars">
            <div className="ka-pm__sech">
              <h3 id="pm-vars" className="ka-pm__h3">แบบสินค้า</h3>
              <span className="ka-pm__cap">{variants.length} แบบ</span>
            </div>
            {variants.length > 0 ? (
              <ul className="ka-pm__vars">
                {variants.map((variant, index) => {
                  const key = variant.product_variant_id ? String(variant.product_variant_id) : `variant-${index}`;
                  const materials = variant.product_materials || variant.productMaterials || [];
                  const files = variant.product_variant_id ? variantFiles[String(variant.product_variant_id)] || [] : [];
                  const colorName = variant.color?.color_name;
                  const hex = variant.color?.color_hex || (colorName ? colorHexes?.get(colorName) : undefined);
                  const unit = variant.productUnit?.product_unit_name || 'ชิ้น';
                  const remain = remainOf(variant);
                  const name = [`แบบที่ ${index + 1}`, colorName, variant.size?.size_name].filter(Boolean).join(' · ');

                  return (
                    <li key={key} className="ka-pm__var">
                      <div className="ka-pm__vr">
                        <span
                          className="ka-pm__sw"
                          style={hex ? { background: hex } : undefined}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="ka-pm__vname">{name}</div>
                          <div className="ka-pm__cap">
                            หน่วย {variant.productUnit?.product_unit_name || '-'} · รูปเฉพาะแบบ {files.length}
                          </div>
                        </div>
                        <div className="ka-pm__price">{formatBaht(Number(variant.product_variant_price || 0))}</div>
                        {remain !== null && (
                          <span className={`ka-badge ka-badge--${remain > 0 ? 'success' : 'danger'}`}>
                            คงเหลือ <span className="ka-pm__num">{qtyFormat.format(remain)}</span>
                          </span>
                        )}
                      </div>
                      {files.length > 0 && (
                        <div className="ka-pm__vfiles" role="group" aria-label={`รูปเฉพาะ${name}`}>
                          {files.map((file, fileIndex) => (
                            <span key={file.product_file_id || fileIndex}>
                              <FileView file={file} label={`รูปที่ ${fileIndex + 1} ของ${name}`} />
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="ka-pm__vm">
                        {materials.length > 0 ? (
                          <table className="ka-pm__mt">
                            <thead>
                              <tr>
                                <th scope="col">วัตถุดิบต่อ 1 {unit}</th>
                                <th scope="col" className="is-r">จำนวน</th>
                              </tr>
                            </thead>
                            <tbody>
                              {materials.map((material, materialIndex) => (
                                <tr key={material.product_material_id || `${material.material_id}-${materialIndex}`}>
                                  <td>{material.material?.material_name || material.material?.material_code || '-'}</td>
                                  <td className="is-r">{qtyFormat.format(Number(material.material_qty || 0))} ชิ้น</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="ka-pm__cap m-0">ยังไม่ได้กำหนดวัตถุดิบ</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ka-pm__empty">ยังไม่มีแบบสินค้า</p>
            )}
          </section>
        </div>

        {loading && (
          <div className="ka-pm__loading" role="status">
            <span>
              <span className="ka-pm__spin" aria-hidden="true" />
              กำลังโหลดรายละเอียดสินค้า…
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
