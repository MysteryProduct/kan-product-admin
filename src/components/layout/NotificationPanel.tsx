'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import Popover from '@/components/Popover';
import DashboardModel from '@/models/dashboard';
import { pendingNotices } from '@/components/dashboard/PendingWork';
import type { DashboardSummary } from '@/types/dashboard';

const dashboardModel = new DashboardModel();
const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

const ICONS = {
  urgent: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  work: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  stock: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z',
};

/**
 * The bell: what needs attention now, from the Dashboard summary (waiting work and materials that
 * ran out). There is no notification feed in the API, so there are no read marks or times.
 */
export default function NotificationPanel({ urgent }: { urgent: number }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setFailed(false);
      dashboardModel.getSummary().then(setSummary).catch(() => setFailed(true));
    }
  };

  const notices = pendingNotices(summary?.pending_work);
  const materials = summary?.stock_out?.materials;
  const empty = summary !== null && notices.length === 0 && !materials?.count;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={urgent > 0 ? `การแจ้งเตือน ด่วน ${count(urgent)} รายการ` : 'การแจ้งเตือน'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="ka-btn ka-btn--ghost ka-btn--icon ka-bell"
      >
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4" />
        </svg>
        {urgent > 0 && <span className="ka-bell__dot" aria-hidden="true" />}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} title="การแจ้งเตือน" align="end" width={380}>
        <div className="ka-notes">
          <p className="ka-notes__title">การแจ้งเตือน</p>
          {failed && <p className="ka-notes__empty">โหลดการแจ้งเตือนไม่สำเร็จ ลองเปิดใหม่อีกครั้ง</p>}
          {!failed && summary === null && <p className="ka-notes__empty" role="status">กำลังโหลด…</p>}
          {empty && <p className="ka-notes__empty">ไม่มีงานที่รออยู่</p>}
          {notices.map((notice) => (
            <Link key={notice.key} href={notice.href} className="ka-note" data-tone={notice.urgent ? 'danger' : 'warning'} onClick={() => setOpen(false)}>
              <span className="ka-note__icon" aria-hidden="true">
                <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={notice.urgent ? ICONS.urgent : ICONS.work} /></svg>
              </span>
              <span className="min-w-0">
                <b>{notice.title}</b>
                <span className="ka-note__sub numeric">{notice.urgent ? 'ต้องตรวจสอบ' : 'รอดำเนินการ'} {count(notice.count)} รายการ · {notice.hint}</span>
              </span>
            </Link>
          ))}
          {materials && materials.count > 0 && (
            <Link href="/admin/materials" className="ka-note" data-tone="warning" onClick={() => setOpen(false)}>
              <span className="ka-note__icon" aria-hidden="true">
                <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={ICONS.stock} /></svg>
              </span>
              <span className="min-w-0">
                <b>วัตถุดิบหมด {count(materials.count)} รายการ</b>
                <span className="ka-note__sub">{materials.items.slice(0, 3).map((item) => item.material_name).join(', ')}</span>
              </span>
            </Link>
          )}
        </div>
      </Popover>
    </>
  );
}
