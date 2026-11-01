import Link from 'next/link';
import LoadErrorBanner from '@/components/LoadErrorBanner';

/** In place of a purchase-order page the employee may not use; the layout only checks `view`. */
export function NoPermissionNote({ action }: { action: string }) {
  return (
    <div className="ka-page-body">
      <div role="note" className="ka-banner">
        <span>
          คุณไม่มีสิทธิ์{action} ดูรายการได้ที่{' '}
          <Link href="/admin/purchase-orders" className="font-semibold">ใบสั่งซื้อ</Link>
        </span>
      </div>
    </div>
  );
}

export function PageLoading({ what }: { what: string }) {
  return (
    <div className="ka-page-body" aria-busy="true">
      <span className="ka-skel ka-skel--title" />
      <p className="sr-only">กำลังโหลด{what}</p>
    </div>
  );
}

export function PageLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="ka-page-body">
      <LoadErrorBanner message={message} onRetry={onRetry} />
      <Link href="/admin/purchase-orders" className="ka-panel__link">← กลับไปรายการใบสั่งซื้อ</Link>
    </div>
  );
}
