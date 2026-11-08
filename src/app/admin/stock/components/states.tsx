import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/** Rows that hold the place of a list while it loads (States sheet). */
export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="srows" role="status" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: rows }, (_, index) => (
        <div className="srow" key={index}>
          <span className="sk t ka-skel" />
          <span className="sk a ka-skel" />
          <span className="sk b ka-skel" />
          <span className="sk c ka-skel" />
        </div>
      ))}
    </div>
  );
}

/** A failed read: never a zero or an empty list (G6). */
export function LoadFailed({ title, detail, onRetry }: { title: string; detail: string; onRetry: () => void }) {
  return (
    <div className="ban dnb" role="alert">
      <Icon name="warn" />
      <span className="grow"><strong>{title}</strong> {detail}</span>
      <button type="button" className="ka-btn" onClick={onRetry}>ลองใหม่</button>
    </div>
  );
}

export function EmptyState({ icon, title, lead, children }: { icon: IconName; title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="eic"><Icon name={icon} /></span>
      <h3>{title}</h3>
      {lead && <p className="cap lead">{lead}</p>}
      {children}
    </div>
  );
}

export function NoAccess() {
  return (
    <section className="card">
      <EmptyState icon="lock" title="คุณไม่มีสิทธิ์ดูสต็อกส่วนนี้" lead="ติดต่อผู้ดูแลเพื่อขอสิทธิ์ดูสต็อกวัตถุดิบหรือสินค้า" />
    </section>
  );
}
