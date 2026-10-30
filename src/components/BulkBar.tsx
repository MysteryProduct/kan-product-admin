import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface BulkBarProps {
  /** How many rows are selected; the bar is not drawn at 0. */
  count: number;
  onClear: () => void;
  /** The commands for the selection, as `BulkAction` buttons. */
  children: ReactNode;
}

/** Appears above the table once a row is checked, with the commands that apply to all of them. */
export default function BulkBar({ count, onClear, children }: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div role="region" aria-label="คำสั่งสำหรับรายการที่เลือก" className="ka-bulk ka-motion-enter">
      <p className="ka-bulk__count numeric" aria-live="polite">
        เลือก {new Intl.NumberFormat('th-TH').format(count)} รายการ
      </p>
      <div className="ka-bulk__actions">{children}</div>
      <button type="button" className="ka-bulk__btn ka-bulk__btn--icon" aria-label="ยกเลิกการเลือกทั้งหมด" onClick={onClear}>
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** A command button on the dark bulk bar. Name what it does: "ลบ", "เปลี่ยนหมวดหมู่". */
export function BulkAction({ tone, className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'danger' }) {
  return <button {...rest} type={type} data-tone={tone} className={`ka-bulk__btn ${className}`} />;
}
