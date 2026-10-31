import Link from 'next/link';

/**
 * Shown in place of the product editor when the employee may view products but not add or edit
 * them. The layout only checks `view` by route prefix, so the full-page editor checks the rest.
 */
export default function NoPermissionNote({ action }: { action: string }) {
  return (
    <div className="ka-page-body">
      <div role="note" className="ka-banner">
        <span>
          คุณไม่มีสิทธิ์{action} ดูรายการสินค้าได้ที่{' '}
          <Link href="/admin/products" className="font-semibold">รายการสินค้า</Link>
        </span>
      </div>
    </div>
  );
}
