'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import DocumentCode from '@/components/DocumentCode';
import PurchaseOrderFormPage from '../../components/po-form';
import { NoPermissionNote, PageLoadError, PageLoading } from '../../components/page-states';
import { usePurchaseOrder } from '../../hooks/usePurchaseOrder';
import { statusLabel } from '../../lib/po-display';

// The API edits drafts and orders waiting for approval; once approved an order is fixed.
const EDITABLE = ['draft', 'pending'];

export default function EditPurchaseOrderPage() {
  const id = useParams<{ id: string }>()?.id;
  const { can, isLoaded } = usePermissions();
  const canEdit = can('purchase_orders', 'edit');
  const { order, error, reload } = usePurchaseOrder(canEdit ? id : null);

  if (isLoaded && !canEdit) return <NoPermissionNote action="แก้ไขใบสั่งซื้อ" />;
  if (error) return <PageLoadError message={error} onRetry={reload} />;
  if (!order) return <PageLoading what="ใบสั่งซื้อ" />;
  if (!EDITABLE.includes(order.purchase_order_status)) {
    return (
      <div className="ka-page-body">
        <div role="note" className="ka-banner">
          <span>
            ใบสั่งซื้อ <DocumentCode code={order.purchase_order_code} legacyCode={order.legacy_code} /> อยู่สถานะ “
            {statusLabel(order.purchase_order_status)}” แก้ไขได้เฉพาะใบที่รออนุมัติหรือเป็นฉบับร่าง{' '}
            <Link href={`/admin/purchase-orders/${order.purchase_order_id}`} className="font-semibold">ดูรายละเอียด</Link>
          </span>
        </div>
      </div>
    );
  }
  return <PurchaseOrderFormPage key={order.purchase_order_id} mode="edit" source={order} />;
}
