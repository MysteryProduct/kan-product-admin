'use client';

import { useRef, useState } from 'react';
import Modal from '@/components/Modal';
import ProductModel from '@/models/product';
import type { Product } from '@/types/product';
import CustomSelect from '@/components/CustomSelect';

const productModel = new ProductModel();
const NAME_MAX = 255;

function errorText(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message) return message;
  return (error as { message?: string })?.message || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
}

/**
 * Name and category of one product. Only the fields that changed are sent, to
 * an endpoint that cannot replace variants, files or recipes, so the dialog
 * stays safe for products that stock, job orders or sale orders refer to.
 */
export default function QuickEdit({
  product,
  categories,
  onClose,
  onSaved,
  onEditVariants,
}: {
  product: Product;
  categories: { label: string; value: string }[];
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Opens the variant status command for this product alone. */
  onEditVariants: () => void;
}) {
  const initialCategory = product.category?.category_id != null ? String(product.category.category_id) : '';
  const [name, setName] = useState(product.product_name);
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const trimmed = name.trim();
  const nameChanged = trimmed !== product.product_name;
  const categoryChanged = categoryId !== initialCategory && categoryId !== '';
  const nameInvalid = trimmed.length === 0 || trimmed.length > NAME_MAX;
  const canSave = !pending && (nameChanged || categoryChanged) && !nameInvalid;

  async function save() {
    if (savingRef.current || !canSave) return;
    savingRef.current = true;
    setPending(true);
    setError('');
    try {
      await productModel.quickEdit(product.product_id, {
        ...(nameChanged && { product_name: trimmed }),
        ...(categoryChanged && { category_id: Number(categoryId) }),
      });
      onSaved(`แก้ไขสินค้า "${trimmed}" แล้ว`);
    } catch (e) {
      // What was typed stays in the form so the save can be retried.
      setError(errorText(e));
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  }

  const guardedClose = () => {
    if (!savingRef.current) onClose();
  };

  return (
    <Modal
      isOpen
      onClose={guardedClose}
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      title="แก้ไขด่วน"
      description={product.product_code ? `รหัสสินค้า ${product.product_code}` : undefined}
      size="md"
      footer={
        <>
          <button type="button" className="ka-btn min-h-11 px-5" onClick={guardedClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="ka-btn ka-btn--primary min-h-11 px-5"
            aria-busy={pending}
            disabled={!canSave}
            onClick={() => void save()}
          >
            {pending ? 'กำลังบันทึก…' : error ? 'ลองบันทึกอีกครั้ง' : 'บันทึก'}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error && (
          <div role="alert" className="ka-banner ka-banner--danger ka-motion-enter">
            <div>
              <strong>บันทึกไม่สำเร็จ</strong>
              <p className="break-words">{error}</p>
            </div>
          </div>
        )}
        <div className="ka-field" data-invalid={nameInvalid || undefined}>
          <label htmlFor="quick-edit-name" className="text-sm font-medium text-[var(--ink)]">
            ชื่อสินค้า
          </label>
          <input
            id="quick-edit-name"
            className="ka-input"
            value={name}
            maxLength={NAME_MAX}
            aria-invalid={nameInvalid}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
          />
          {nameInvalid && (
            <p className="text-[13px] text-[var(--danger)]">กรุณากรอกชื่อสินค้า (ไม่เกิน {NAME_MAX} ตัวอักษร)</p>
          )}
        </div>
        <div className="ka-field">
          <label htmlFor="quick-edit-category" className="text-sm font-medium text-[var(--ink)]">
            หมวดหมู่
          </label>
          <CustomSelect
            id="quick-edit-category"
            value={categoryId}
            onChange={(value) => setCategoryId(value)}
            options={categories.map((category) => ({ value: category.value, label: category.label }))}
            placeholder="เลือกหมวดหมู่"
            disabled={pending}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          <p className="text-[13px] text-[var(--ink-muted)]">
            แก้เฉพาะชื่อและหมวดหมู่ ตัวเลือก ราคา รูป และสูตรไม่เปลี่ยน
          </p>
          <button type="button" className="ka-btn ka-btn--sm" disabled={pending} onClick={onEditVariants}>
            เปลี่ยนสถานะตัวเลือก…
          </button>
        </div>
      </form>
    </Modal>
  );
}
