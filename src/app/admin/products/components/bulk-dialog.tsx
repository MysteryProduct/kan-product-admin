'use client';

import { KeyboardEvent, useRef, useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/Modal';
import ProductModel, { StorePolicyChange, StorePolicyState, VariantStatusValue } from '@/models/product';
import type { Product, ProductVariant } from '@/types/product';
import {
  POLICY_LABELS,
  PreviewLine,
  STATUS_LABELS,
  categoryPreview,
  policyPreview,
  statusPreview,
  variantStatusOf,
  variantsOf,
} from '@/lib/product-bulk';
import { usePermissions } from '@/hooks/usePermissions';

const productModel = new ProductModel();

export type BulkMode = 'category' | 'policy' | 'status';

export interface BulkDialogProps {
  mode: BulkMode;
  products: Product[];
  policies: ReadonlyMap<string, StorePolicyState>;
  categories: { label: string; value: string }[];
  onClose: () => void;
  /** Called once the API has confirmed the change; the caller refreshes and clears its selection. */
  onSaved: (message: string) => void;
}

type PolicyChoice = 'keep' | 'on' | 'off';
const POLICY_FIELDS = Object.keys(POLICY_LABELS) as (keyof StorePolicyChange)[];
const TITLES: Record<BulkMode, string> = {
  category: 'เปลี่ยนหมวดหมู่สินค้า',
  policy: 'ตั้งค่าหน้าร้านออนไลน์',
  status: 'เปลี่ยนสถานะตัวเลือกสินค้า',
};
// The artboard's names and hints for the store switches; the review lines keep POLICY_LABELS'
// wording out of the shared helper, so it is mapped back here.
const POLICY_TEXT: Record<keyof StorePolicyChange, { label: string; hint: string }> = {
  published: { label: 'แสดงบนหน้าร้าน', hint: 'ลูกค้าเห็นสินค้านี้' },
  online_purchase: { label: 'ซื้อออนไลน์ได้', hint: 'มีปุ่มเพิ่มลงตะกร้า' },
  contact_enabled: { label: 'ขอติดต่อกลับได้', hint: 'เมื่อสินค้าหมด' },
};
const POLICY_LABEL_TEXT = new Map(POLICY_FIELDS.map((field) => [POLICY_LABELS[field], POLICY_TEXT[field].label]));
const STATUS_VALUES = Object.keys(STATUS_LABELS) as VariantStatusValue[];
const CATEGORY_SEARCH_FROM = 7;

function errorText(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message) return message;
  return (error as { message?: string })?.message || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
}

/** Where the selected products stand on one switch: "เปิด", "ปิด" or "ต่างกัน (เปิด x · ปิด y)". */
function currentPolicyText(
  products: Product[],
  policies: ReadonlyMap<string, StorePolicyState>,
  field: keyof StorePolicyChange,
): string {
  let on = 0;
  let off = 0;
  let unknown = 0;
  for (const product of products) {
    const policy = policies.get(product.product_id);
    if (!policy) unknown += 1;
    else if (policy[field]) on += 1;
    else off += 1;
  }
  if (unknown === products.length) return 'ไม่ทราบค่า';
  if (unknown === 0 && off === 0) return 'เปิด';
  if (unknown === 0 && on === 0) return 'ปิด';
  return `ต่างกัน (${[on && `เปิด ${on}`, off && `ปิด ${off}`, unknown && `ไม่ทราบ ${unknown}`].filter(Boolean).join(' · ')})`;
}

/** Moves a roving radio selection with the arrow keys; returns the next index or null. */
function arrowStep(event: KeyboardEvent, index: number, count: number, axis: 'x' | 'y'): number | null {
  const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
  const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
  if (event.key === back || (axis === 'x' && event.key === 'ArrowUp')) return (index - 1 + count) % count;
  if (event.key === forward || (axis === 'x' && event.key === 'ArrowDown')) return (index + 1) % count;
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return count - 1;
  return null;
}

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  tone?: 'on' | 'off';
}

/** Three-way (or two-way) switch: a radiogroup whose checked button is the one Tab stop. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="ka-pm__seg" role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          data-tone={option.tone}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const next = arrowStep(event, index, options.length, 'x');
            if (next === null) return;
            event.preventDefault();
            onChange(options[next].value);
            refs.current[next]?.focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const POLICY_OPTIONS: SegmentOption<PolicyChoice>[] = [
  { value: 'keep', label: 'ไม่เปลี่ยน' },
  { value: 'on', label: 'เปิด', tone: 'on' },
  { value: 'off', label: 'ปิด', tone: 'off' },
];
const STATUS_OPTIONS: SegmentOption<VariantStatusValue>[] = STATUS_VALUES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
  tone: value === 'active' ? 'on' : 'off',
}));

const variantName = (product: Product, variant: ProductVariant) =>
  [product.product_name, variant.color?.color_name, variant.size?.size_name].filter(Boolean).join(' · ');

/**
 * Edit, then review, then save, for one group command. Nothing is sent until
 * the review step is confirmed; a failed save keeps the choices and the
 * selection so it can be retried, and a second click while saving is ignored.
 */
export default function BulkDialog({ mode, products, policies, categories, onClose, onSaved }: BulkDialogProps) {
  const { can } = usePermissions();
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [categoryId, setCategoryId] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [policyChoice, setPolicyChoice] = useState<Record<keyof StorePolicyChange, PolicyChoice>>({
    published: 'keep',
    online_purchase: 'keep',
    contact_enabled: 'keep',
  });
  const [variantIds, setVariantIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<VariantStatusValue>('inactive');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const categoryRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const policyChange: StorePolicyChange = {};
  for (const field of POLICY_FIELDS) {
    if (policyChoice[field] !== 'keep') policyChange[field] = policyChoice[field] === 'on';
  }
  const categoryName = categories.find((c) => c.value === categoryId)?.label ?? '';

  const lines: PreviewLine[] =
    mode === 'category'
      ? categoryPreview(products, categoryName)
      : mode === 'policy'
        ? policyPreview(products, policies, policyChange)
        : statusPreview(products, variantIds, status);
  const ready =
    mode === 'category'
      ? categoryId !== ''
      : mode === 'policy'
        ? Object.keys(policyChange).length > 0
        : variantIds.size > 0;

  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    setError('');
    try {
      const ids = products.map((p) => p.product_id);
      if (mode === 'category') await productModel.bulkUpdateCategory(ids, Number(categoryId));
      else if (mode === 'policy') await productModel.bulkUpdateStorePolicy(ids, policyChange);
      else await productModel.bulkUpdateVariantStatus([...variantIds], status);
      onSaved(
        mode === 'status'
          ? `เปลี่ยนสถานะตัวเลือกสินค้า ${variantIds.size} รายการเป็น${STATUS_LABELS[status]}แล้ว`
          : `บันทึกการเปลี่ยนแปลงให้สินค้า ${products.length} รายการแล้ว`,
      );
    } catch (e) {
      // The choices and the selection stay, so the same save can simply be retried.
      setError(errorText(e));
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  }

  const guardedClose = () => {
    if (!savingRef.current) onClose();
  };

  const toggleVariant = (id: string, checked: boolean) =>
    setVariantIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  // Category: the selected products' current categories, and the one they share if any.
  const currentCategories = [...new Set(products.map((p) => p.category?.category_name || '-'))];
  const sharedCategoryIds = new Set(products.map((p) => (p.category ? String(p.category.category_id) : '')));
  const sharedCategoryId = sharedCategoryIds.size === 1 ? [...sharedCategoryIds][0] : '';
  const shownCategories =
    categories.length >= CATEGORY_SEARCH_FROM && categoryQuery.trim()
      ? categories.filter((c) => c.label.toLowerCase().includes(categoryQuery.trim().toLowerCase()))
      : categories;
  const pickableCategories = shownCategories.filter((c) => c.value !== sharedCategoryId);
  const categoryTabStop = pickableCategories.some((c) => c.value === categoryId)
    ? categoryId
    : pickableCategories[0]?.value;

  const changeCount = Object.keys(policyChange).length;
  const policySummary = POLICY_FIELDS.filter((field) => policyChoice[field] !== 'keep')
    .map((field) => `${POLICY_TEXT[field].label} → ${policyChoice[field] === 'on' ? 'เปิด' : 'ปิด'}`)
    .join(' · ');

  const description =
    mode === 'category'
      ? products.length === 1
        ? `${products[0].product_name} · หมวดปัจจุบัน: ${currentCategories[0]}`
        : `${products.length} สินค้า · หมวดปัจจุบัน: ${currentCategories.join(', ')}`
      : `ใช้กับสินค้าที่เลือก ${products.length} รายการ`;

  const editHint =
    mode === 'policy'
      ? changeCount > 0
        ? `เปลี่ยน ${changeCount} ค่า`
        : 'ยังไม่มีอะไรเปลี่ยน'
      : mode === 'status'
        ? variantIds.size > 0
          ? `เลือก ${variantIds.size} แบบ`
          : 'ยังไม่ได้เลือกแบบ'
        : '';

  const confirmLabel = pending
    ? 'กำลังบันทึก…'
    : error
      ? 'ลองบันทึกอีกครั้ง'
      : mode === 'category'
        ? `ย้ายไป “${categoryName}”`
        : `ยืนยันบันทึก ${lines.length} รายการ`;

  return (
    <Modal
      isOpen
      onClose={guardedClose}
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      title={TITLES[mode]}
      description={description}
      closeLabel="ปิด"
      size="standard"
      className="ka-pm"
      footer={
        step === 'edit' ? (
          <>
            {editHint && <span className="ka-pm__hint" aria-live="polite">{editHint}</span>}
            <button type="button" className="ka-btn" onClick={guardedClose}>
              ยกเลิก
            </button>
            <button
              type="button"
              className="ka-btn ka-btn--primary"
              disabled={!ready}
              onClick={() => setStep('review')}
            >
              ตรวจสอบก่อนบันทึก
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ka-btn" disabled={pending} onClick={() => setStep('edit')}>
              กลับไปแก้ไข
            </button>
            <button
              type="button"
              className="ka-btn ka-btn--primary"
              disabled={pending}
              onClick={() => void save()}
            >
              <span className="ka-pm__btn-text">{confirmLabel}</span>
            </button>
          </>
        )
      }
    >
      <div className="ka-pm__stack" aria-busy={pending || undefined}>
        {error && (
          <div role="alert" className="ka-banner ka-banner--danger ka-motion-enter">
            <div>
              <strong>บันทึกไม่สำเร็จ</strong>
              <p className="break-words">{error}</p>
              <p>ไม่มีรายการใดถูกเปลี่ยน ค่าที่เลือกไว้ยังอยู่ กดบันทึกอีกครั้งได้</p>
            </div>
          </div>
        )}

        {step === 'edit' && mode === 'policy' && (
          <>
            <div className="ka-pm__rows">
              {POLICY_FIELDS.map((field) => (
                <div key={field} className="ka-pm__prow">
                  <div>
                    <div className="ka-pm__pname">{POLICY_TEXT[field].label}</div>
                    <div className="ka-pm__cap">
                      {POLICY_TEXT[field].hint} · ตอนนี้: {currentPolicyText(products, policies, field)}
                    </div>
                  </div>
                  <Segmented
                    label={POLICY_TEXT[field].label}
                    value={policyChoice[field]}
                    options={POLICY_OPTIONS}
                    onChange={(value) => setPolicyChoice((prev) => ({ ...prev, [field]: value }))}
                  />
                </div>
              ))}
            </div>
            {changeCount > 0 && (
              <div className="ka-pm__summary">
                <b>จะเปลี่ยน:</b> {policySummary}
              </div>
            )}
          </>
        )}

        {step === 'edit' && mode === 'category' && (
          <>
            {categories.length >= CATEGORY_SEARCH_FROM && (
              <label className="ka-pm__search">
                <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
                </svg>
                <span className="sr-only">ค้นหาหมวดหมู่</span>
                <input
                  type="search"
                  value={categoryQuery}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                  placeholder="ค้นหาหมวดหมู่"
                />
              </label>
            )}
            <div className="ka-pm__cats" role="radiogroup" aria-label="หมวดหมู่ใหม่">
              {shownCategories.map((category) => {
                const current = category.value === sharedCategoryId;
                const checked = category.value === categoryId;
                return (
                  <button
                    key={category.value}
                    ref={(node) => {
                      if (node) categoryRefs.current.set(category.value, node);
                      else categoryRefs.current.delete(category.value);
                    }}
                    type="button"
                    role="radio"
                    className="ka-pm__cat"
                    aria-checked={checked}
                    aria-disabled={current || undefined}
                    tabIndex={category.value === categoryTabStop ? 0 : -1}
                    onClick={() => {
                      if (!current) setCategoryId(category.value);
                    }}
                    onKeyDown={(event) => {
                      const index = pickableCategories.findIndex((c) => c.value === category.value);
                      const next = arrowStep(event, Math.max(index, 0), pickableCategories.length, 'y');
                      if (next === null || pickableCategories.length === 0) return;
                      event.preventDefault();
                      const target = pickableCategories[next];
                      setCategoryId(target.value);
                      categoryRefs.current.get(target.value)?.focus();
                    }}
                  >
                    <span className="ka-pm__rd" aria-hidden="true" />
                    <span className="min-w-0 break-words">{category.label}</span>
                    {current && <span className="ka-pm__cat-meta">หมวดปัจจุบัน</span>}
                  </button>
                );
              })}
              {shownCategories.length === 0 && <p className="ka-pm__cap">ไม่พบหมวดหมู่ “{categoryQuery.trim()}”</p>}
            </div>
            {can('categories', 'add') && (
              <Link href="/admin/categories" className="ka-pm__new">
                <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                สร้างหมวดหมู่ใหม่
              </Link>
            )}
            {categoryId && (
              <div className="ka-pm__summary ka-pm__flow">
                <span className="ka-pm__from">{currentCategories.join(', ')}</span>
                <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <span className="sr-only">เปลี่ยนเป็น</span>
                <span className="ka-pm__to">{categoryName}</span>
              </div>
            )}
            <p className="ka-pm__cap m-0">เปลี่ยนเฉพาะหมวดหมู่ ราคา รูป สูตร และรหัสสินค้าคงเดิม</p>
          </>
        )}

        {step === 'edit' && mode === 'status' && (
          <>
            <ul className="ka-pm__vlist" aria-label="แบบสินค้าที่จะเปลี่ยนสถานะ">
              {products.map((product) => {
                const variants = variantsOf(product).filter((variant) => variant.product_variant_id);
                if (variants.length === 0) {
                  return (
                    <li key={product.product_id} className="ka-pm__vnone">
                      {product.product_name}: ไม่มีแบบสินค้า
                    </li>
                  );
                }
                return variants.map((variant) => {
                  const id = variant.product_variant_id as string;
                  const current = variantStatusOf(variant);
                  return (
                    <li key={id}>
                      <label>
                        <input
                          type="checkbox"
                          className="ka-check"
                          checked={variantIds.has(id)}
                          onChange={(e) => toggleVariant(id, e.target.checked)}
                        />
                        <span
                          className="ka-pm__sw ka-pm__sw--sm"
                          style={variant.color?.color_hex ? { background: variant.color.color_hex } : undefined}
                          aria-hidden="true"
                        />
                        <span className="ka-pm__vtext">{variantName(product, variant)}</span>
                        <span className={`ka-badge ka-badge--${current === 'active' ? 'success' : 'neutral'}`}>
                          {STATUS_LABELS[current]}
                        </span>
                      </label>
                    </li>
                  );
                });
              })}
            </ul>
            <div className="ka-pm__prow">
              <div>
                <div className="ka-pm__pname">สถานะใหม่</div>
                <div className="ka-pm__cap">ใช้กับแบบที่เลือก {variantIds.size} แบบ แบบอื่นและหน้าร้านไม่เปลี่ยนตาม</div>
              </div>
              <Segmented label="สถานะใหม่" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <p className="ka-pm__cap m-0">
              ตรวจสอบ {lines.length} รายการ ระบบจะบันทึกทั้งหมดพร้อมกัน หากรายการใดไม่ผ่านจะไม่มีรายการใดถูกเปลี่ยน
            </p>
            <ul className="ka-pm__lines">
              {lines.map((line) => {
                const detail = line.detail ? POLICY_LABEL_TEXT.get(line.detail) ?? line.detail : '';
                return (
                  <li key={line.key}>
                    <span className="ka-pm__lt">
                      {line.title}
                      {detail && ` · ${detail}`}:
                    </span>
                    <span className="ka-pm__lv">
                      {line.before} <span aria-hidden="true">→</span>
                      <span className="sr-only">เปลี่ยนเป็น</span> <strong>{line.after}</strong>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
