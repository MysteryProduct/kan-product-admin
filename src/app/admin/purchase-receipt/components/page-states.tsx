import Link from 'next/link';
import DocumentCode from '@/components/DocumentCode';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import type { PurchaseOrder } from '@/types/purchase-order';
import { statusLabel } from '../../purchase-orders/lib/po-display';

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

/**
 * In place of the form when the API would refuse the order: a new receipt needs an approved or partly
 * received order, and an edit is refused once the order waits for approval again or was cancelled.
 */
export function OrderNotReceivable({ order, backHref, backLabel }: { order: PurchaseOrder; backHref: string; backLabel: string }) {
  return (
    <div className="ka-page-body">
      <div role="note" className="ka-banner ka-banner--warning">
        <span>
          ใบสั่งซื้อ <DocumentCode code={order.purchase_order_code} legacyCode={order.legacy_code} /> อยู่สถานะ “
          {statusLabel(order.purchase_order_status)}” รับสินค้าได้เฉพาะใบสั่งซื้อที่อนุมัติแล้วหรือรับบางส่วน{' '}
          <Link href={backHref} className="font-semibold">{backLabel}</Link>
        </span>
      </div>
    </div>
  );
}
