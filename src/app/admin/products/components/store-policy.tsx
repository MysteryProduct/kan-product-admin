'use client';
import { useState } from 'react';
import axios from '@/lib/axios';
import type { StorePolicyState } from '@/models/product';

type Policy = Pick<StorePolicyState, 'published' | 'online_purchase' | 'contact_enabled'>;
const labels: [keyof Policy, string][] = [
  ['published', 'แสดงบนหน้าร้าน'],
  ['online_purchase', 'อนุญาตซื้อออนไลน์'],
  ['contact_enabled', 'อนุญาตติดต่อกลับ'],
];

/**
 * One product's store switches. The value is read once per table page by the
 * parent (`GET /product/store-policy/batch`) and passed in, so a row never
 * issues its own read; `policy` is undefined while that read is pending or
 * failed, and the switches are then not shown rather than shown as off.
 */
export default function StorePolicy({
  id,
  editable,
  policy,
  failed,
  onRetry,
  onChanged,
}: {
  id: string;
  editable: boolean;
  policy: Policy | undefined;
  failed: boolean;
  onRetry: () => void;
  onChanged: (policy: StorePolicyState) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function toggle(key: keyof Policy, value: boolean) {
    setPending(true);
    setMessage('');
    try {
      const r = await axios.patch<Policy>(`/product/${id}/store-policy`, {
        [key]: value,
      });
      onChanged({ product_id: id, ...r.data });
      setMessage('บันทึกแล้ว');
    } catch {
      setMessage('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setPending(false);
    }
  }
  return (
    <fieldset aria-busy={pending} className="relative min-w-48 space-y-2 text-sm">
      <legend className="sr-only">ช่องทางหน้าร้าน</legend>
      {policy ? (
        labels.map(([key, label]) => (
          <label key={key} className="flex min-h-11 items-center gap-2 text-[var(--ink)]">
            <input
              type="checkbox"
              className="ka-check"
              disabled={!editable || pending}
              checked={policy[key]}
              onChange={(e) => void toggle(key, e.target.checked)}
            />
            {label}
          </label>
        ))
      ) : failed ? (
        <div className="space-y-2">
          <p role="alert" className="text-[var(--danger)]">
            โหลดการตั้งค่าไม่สำเร็จ
          </p>
          <button type="button" className="ka-btn ka-btn--sm" onClick={onRetry}>
            ลองใหม่
          </button>
        </div>
      ) : (
        <span className="text-[var(--ink-muted)]">กำลังโหลดการตั้งค่า</span>
      )}
      <p role="status" aria-live="polite" className="ka-motion-state text-[var(--ink-muted)]">
        {pending ? 'กำลังบันทึก…' : policy ? message : ''}
      </p>
    </fieldset>
  );
}
