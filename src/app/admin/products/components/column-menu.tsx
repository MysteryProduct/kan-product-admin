'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface ColumnChoice {
  key: string;
  label: string;
  /** A column the menu lists as always shown (code, name and the row commands). */
  required?: boolean;
  /** Why a required column cannot be hidden; defaults to "แสดงเสมอ". */
  note?: string;
}

/**
 * Show/hide columns. The menu closes on Escape or an outside click and returns
 * focus to its button; the choice is applied immediately and by the parent,
 * which also stores it.
 */
export default function ColumnMenu({
  columns,
  hidden,
  onToggle,
  onReset,
  saved,
}: {
  columns: ColumnChoice[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string, visible: boolean) => void;
  onReset: () => void;
  /** False when the browser refused to store the choice. */
  saved: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="ka-btn whitespace-nowrap"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        คอลัมน์{hidden.size > 0 ? ` (ซ่อน ${hidden.size})` : ''}
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="เลือกคอลัมน์ที่แสดง"
          className="ka-motion-enter absolute right-0 z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-raise)]"
        >
          <ul>
            {columns.map((column) => (
              <li key={column.key}>
                <label className="ka-option cursor-pointer justify-start text-sm">
                  <input
                    type="checkbox"
                    className="ka-check"
                    checked={column.required || !hidden.has(column.key)}
                    disabled={column.required}
                    onChange={(e) => onToggle(column.key, e.target.checked)}
                  />
                  <span className="min-w-0 break-words">{column.label}</span>
                  {column.required && <span className="ka-option__meta">{column.note ?? 'แสดงเสมอ'}</span>}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-[var(--border)] px-2 pt-2">
            <button type="button" className="ka-btn ka-btn--sm" onClick={onReset} disabled={hidden.size === 0}>
              คืนค่าเริ่มต้น
            </button>
            {!saved && (
              <span role="status" className="text-[13px] text-[var(--ink-muted)]">
                ใช้ได้เฉพาะครั้งนี้
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
