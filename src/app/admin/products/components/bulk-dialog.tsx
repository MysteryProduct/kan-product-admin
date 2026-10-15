'use client';

import { useRef, useState } from 'react';
import Modal from '@/components/Modal';
import ProductModel, { StorePolicyChange, StorePolicyState, VariantStatusValue } from '@/models/product';
import type { Product } from '@/types/product';
import {
  POLICY_LABELS,
  PreviewLine,
  STATUS_LABELS,
  categoryPreview,
  policyPreview,
  statusPreview,
  variantLabel,
  variantStatusOf,
  variantsOf,
} from '@/lib/product-bulk';

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

function errorText(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message) return message;
  return (error as { message?: string })?.message || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
}

/**
 * Edit, then review, then save, for one group command. Nothing is sent until
 * the review step is confirmed; a failed save keeps the choices and the
 * selection so it can be retried, and a second click while saving is ignored.
 */
export default function BulkDialog({ mode, products, policies, categories, onClose, onSaved }: BulkDialogProps) {
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [categoryId, setCategoryId] = useState('');
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

  return (
    <Modal
      isOpen
      onClose={guardedClose}
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      title={TITLES[mode]}
      description={`${products.length} สินค้าที่เลือกในหน้านี้`}
      size="lg"
      footer={
        step === 'edit' ? (
          <>
            <button type="button" className="ka-btn min-h-11 px-5" onClick={guardedClose}>
              ยกเลิก
            </button>
            <button
              type="button"
              className="ka-btn ka-btn--primary min-h-11 px-5"
              disabled={!ready}
              onClick={() => setStep('review')}
            >
              ตรวจสอบก่อนบันทึก
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ka-btn min-h-11 px-5" disabled={pending} onClick={() => setStep('edit')}>
              กลับไปแก้ไข
            </button>
            <button
              type="button"
              className="ka-btn ka-btn--primary min-h-11 px-5"
              aria-busy={pending}
              disabled={pending}
              onClick={() => void save()}
            >
              {pending ? 'กำลังบันทึก…' : error ? 'ลองบันทึกอีกครั้ง' : 'ยืนยันบันทึก'}
            </button>
          </>
        )
      }
    >
      {error && (
        <div role="alert" className="ka-banner ka-banner--danger ka-motion-enter mb-4">
          <div>
            <strong>บันทึกไม่สำเร็จ</strong>
            <p className="break-words">{error}</p>
            <p>ไม่มีรายการใดถูกเปลี่ยน ค่าที่เลือกไว้ยังอยู่ กดบันทึกอีกครั้งได้</p>
          </div>
        </div>
      )}

      {step === 'edit' && mode === 'category' && (
        <div className="ka-field">
          <label htmlFor="bulk-category" className="text-sm font-medium text-[var(--ink)]">
            หมวดหมู่ใหม่ของสินค้าที่เลือก
          </label>
          <select
            id="bulk-category"
            className="ka-input"
            value={categoryId}
            disabled={pending}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">เลือกหมวดหมู่</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <p className="text-[13px] text-[var(--ink-muted)]">
            เปลี่ยนเฉพาะหมวดหมู่ ราคา รูป สูตร และรหัสสินค้าไม่เปลี่ยน
          </p>
        </div>
      )}

      {step === 'edit' && mode === 'policy' && (
        <fieldset className="space-y-3">
          <legend className="text-sm text-[var(--ink-muted)]">
            เลือกเฉพาะสวิตช์ที่ต้องการเปลี่ยน สวิตช์ที่เลือก “ไม่เปลี่ยน” จะคงค่าเดิมของแต่ละสินค้า
          </legend>
          {POLICY_FIELDS.map((field) => (
            <div key={field} className="ka-field">
              <label htmlFor={`bulk-policy-${field}`} className="text-sm font-medium text-[var(--ink)]">
                {POLICY_LABELS[field]}
              </label>
              <select
                id={`bulk-policy-${field}`}
                className="ka-input"
                value={policyChoice[field]}
                onChange={(e) =>
                  setPolicyChoice((prev) => ({
                    ...prev,
                    [field]: e.target.value as PolicyChoice,
                  }))
                }
              >
                <option value="keep">ไม่เปลี่ยน</option>
                <option value="on">เปิด</option>
                <option value="off">ปิด</option>
              </select>
            </div>
          ))}
        </fieldset>
      )}

      {step === 'edit' && mode === 'status' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-muted)]">
            เลือกเฉพาะตัวเลือก (ขนาด/สี) ที่ต้องการเปลี่ยน ตัวเลือกอื่นของสินค้าเดียวกันและสวิตช์หน้าร้านไม่เปลี่ยนตาม
          </p>
          <div className="max-h-72 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {products.map((product) => (
              <fieldset
                key={product.product_id}
                className="rounded-[var(--radius-control)] border border-[var(--border)] p-3"
              >
                <legend className="px-1 text-sm font-semibold text-[var(--ink)] break-words">
                  {product.product_name}
                </legend>
                {variantsOf(product).length === 0 && (
                  <p className="text-sm text-[var(--ink-muted)]">สินค้านี้ไม่มีตัวเลือก</p>
                )}
                {variantsOf(product).map((variant) => {
                  const id = variant.product_variant_id;
                  if (!id) return null;
                  return (
                    <label key={id} className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="ka-check"
                        checked={variantIds.has(id)}
                        onChange={(e) => toggleVariant(id, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1 break-words">{variantLabel(variant)}</span>
                      <span className="text-[var(--ink-muted)]">{STATUS_LABELS[variantStatusOf(variant)]}</span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
          <fieldset className="ka-field">
            <legend className="text-sm font-medium text-[var(--ink)]">
              สถานะใหม่ของตัวเลือกที่เลือก ({variantIds.size} รายการ)
            </legend>
            <div className="flex flex-wrap gap-4">
              {(['inactive', 'active'] as const).map((value) => (
                <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bulk-variant-status"
                    checked={status === value}
                    onChange={() => setStatus(value)}
                  />
                  {STATUS_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink-muted)]">
            ตรวจสอบรายการที่จะเปลี่ยน ({lines.length} รายการ) ระบบจะบันทึกทั้งหมดพร้อมกัน
            หากรายการใดไม่ผ่านจะไม่มีรายการใดถูกเปลี่ยน
          </p>
          <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto overscroll-contain rounded-[var(--radius-control)] border border-[var(--border)]">
            {lines.map((line) => (
              <li
                key={line.key}
                className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 break-words">
                  <span className="font-medium text-[var(--ink)]">{line.title}</span>
                  {line.detail && <span className="text-[var(--ink-muted)]"> · {line.detail}</span>}
                </span>
                <span className="shrink-0 text-[var(--ink-muted)]">
                  {line.before} <span aria-hidden="true">→</span>
                  <span className="sr-only">เปลี่ยนเป็น</span>{' '}
                  <strong className="text-[var(--ink)]">{line.after}</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
