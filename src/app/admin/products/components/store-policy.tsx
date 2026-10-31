'use client';
import { useState } from 'react';
import axios from '@/lib/axios';
import type { StorePolicyState } from '@/models/product';

type Policy = Pick<StorePolicyState, 'published' | 'online_purchase' | 'contact_enabled'>;

// Three switches drawn as icon buttons; each has its Thai name and its state in text (aria), never only a colour.
const SWITCHES: { key: keyof Policy; label: string; path: string }[] = [
  { key: 'published', label: 'แสดงบนหน้าร้าน', path: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'online_purchase', label: 'ซื้อออนไลน์ได้', path: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { key: 'contact_enabled', label: 'ขอติดต่อกลับได้', path: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
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
  if (!policy) {
    return failed ? (
      <span className="flex flex-wrap items-center gap-2 text-[13px]">
        <span role="alert" className="text-[var(--danger)]">โหลดไม่สำเร็จ</span>
        <button type="button" className="ka-btn ka-btn--sm" onClick={onRetry}>ลองใหม่</button>
      </span>
    ) : (
      <span className="ka-skel" style={{ width: 108, height: 32 }} aria-label="กำลังโหลดการตั้งค่า" />
    );
  }
  return (
    <span className="ka-tg" role="group" aria-label="ช่องทางหน้าร้าน" aria-busy={pending || undefined}>
      {SWITCHES.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={policy[item.key]}
          aria-label={`${item.label}${policy[item.key] ? '' : ' (ปิด)'}`}
          title={`${item.label}${policy[item.key] ? '' : ' (ปิด)'}`}
          disabled={!editable || pending}
          onClick={() => void toggle(item.key, !policy[item.key])}
        >
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={item.path} />
          </svg>
        </button>
      ))}
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? 'กำลังบันทึก' : message}
      </span>
    </span>
  );
}
