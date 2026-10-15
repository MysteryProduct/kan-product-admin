'use client';

import type { BulkMode } from './bulk-dialog';

const COMMANDS: { mode: BulkMode; label: string }[] = [
  { mode: 'category', label: 'เปลี่ยนหมวดหมู่' },
  { mode: 'policy', label: 'ตั้งค่าหน้าร้าน' },
  { mode: 'status', label: 'เปลี่ยนสถานะตัวเลือก' },
];

/**
 * Appears when the first row is selected. It is mounted with the app's
 * one-region fade and its count changes in place; focus is never moved here.
 */
export default function BulkBar({
  count,
  disabled,
  onCommand,
  onClear,
}: {
  count: number;
  disabled: boolean;
  onCommand: (mode: BulkMode) => void;
  onClear: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="คำสั่งสำหรับสินค้าที่เลือก"
      className="ka-motion-enter flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-soft)] px-3 py-2 text-[var(--brand-ink)]"
    >
      <p role="status" aria-live="polite" className="mr-auto min-w-0 text-sm font-semibold">
        เลือกแล้ว {count} รายการ (เฉพาะหน้านี้)
      </p>
      {COMMANDS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className="ka-btn ka-btn--sm"
          disabled={disabled}
          onClick={() => onCommand(mode)}
        >
          {label}
        </button>
      ))}
      <button type="button" className="ka-btn ka-btn--sm ka-btn--ghost" disabled={disabled} onClick={onClear}>
        ล้างการเลือก
      </button>
    </div>
  );
}
