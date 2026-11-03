'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import DocumentCode from '@/components/DocumentCode';
import SaleOrderFormPage from '../../components/so-form';
import { NoPermissionNote, PageLoadError, PageLoading } from '../../components/page-states';
import { useSaleOrder } from '../../hooks/useSaleOrder';
import { allows, statusLabel } from '../../lib/so-display';

export default function EditSaleOrderPage() {
  const id = useParams<{ id: string }>()?.id;
  const { can, isLoaded } = usePermissions();
  const canEdit = can('sale_orders', 'edit');
  const { order, error, reload } = useSaleOrder(canEdit ? id : null);

  if (isLoaded && !canEdit) return <NoPermissionNote action="แก้ไขใบสั่งขาย" />;
  if (error) return <PageLoadError message={error} onRetry={reload} />;
  if (!order) return <PageLoading what="ใบสั่งขาย" />;
  // The API edits an order before it is approved; custom orders are changed through their own flow.
  if (!allows.edit(order)) {
    return (
      <div className="ka-page-body">
        <div role="note" className="ka-banner">
          <span>
            ใบสั่งขาย <DocumentCode code={order.sale_order_code} legacyCode={order.legacy_code} /> อยู่สถานะ “
            {statusLabel(order.sale_order_status)}” แก้ไขได้เฉพาะใบที่รออนุมัติและไม่ใช่งานผลิต Custom{' '}
            <Link href={`/admin/sale-orders/${order.sale_order_id}`} className="font-semibold">ดูรายละเอียด</Link>
          </span>
        </div>
      </div>
    );
  }
  return <SaleOrderFormPage key={order.sale_order_id} mode="edit" source={order} />;
}
