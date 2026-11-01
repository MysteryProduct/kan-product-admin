import Link from 'next/link';
import LoadErrorBanner from '@/components/LoadErrorBanner';

const LIST_HREF = '/admin/purchase-receipt';

/** In place of a receipt page the employee may not use; the layout only checks `view`. */
export function NoPermissionNote({ action }: { action: string }) {
  return (
    <div className="ka-page-body">
      <div role="note" className="ka-banner">
        <span>
          คุณไม่มีสิทธิ์{action} ดูรายการได้ที่{' '}
          <Link href={LIST_HREF} className="font-semibold">ใบรับสินค้า</Link>
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
      <Link href={LIST_HREF} className="ka-panel__link">← กลับไปรายการใบรับสินค้า</Link>
    </div>
  );
}
