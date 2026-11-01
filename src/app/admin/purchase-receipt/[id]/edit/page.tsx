'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import DocumentCode from '@/components/DocumentCode';
import ReceiptFormPage from '../../components/receipt-form';
import { NoPermissionNote, PageLoadError, PageLoading } from '../../components/page-states';
import { usePurchaseReceipt } from '../../hooks/usePurchaseReceipt';
import { receiptStatusLabel } from '../../lib/pr-display';

export default function EditPurchaseReceiptPage() {
  const id = useParams<{ id: string }>()?.id;
  const { can, isLoaded } = usePermissions();
  const canEdit = can('purchase_receipt', 'edit');
  const { receipt, order, error, reload } = usePurchaseReceipt(canEdit ? id : null);

  if (isLoaded && !canEdit) return <NoPermissionNote action="แก้ไขใบรับสินค้า" />;
  if (error) return <PageLoadError message={error} onRetry={reload} />;
  if (!receipt) return <PageLoading what="ใบรับสินค้า" />;
  // The API edits a receipt only while it waits for approval.
  if (receipt.purchase_receipt_status !== 'pending') {
    return (
      <div className="ka-page-body">
        <div role="note" className="ka-banner">
          <span>
            ใบรับสินค้า <DocumentCode code={receipt.purchase_receipt_code} legacyCode={receipt.legacy_code} /> อยู่สถานะ “
            {receiptStatusLabel(receipt.purchase_receipt_status)}” แก้ไขได้เฉพาะใบที่รออนุมัติ{' '}
            <Link href={`/admin/purchase-receipt/${receipt.purchase_receipt_id}`} className="font-semibold">ดูรายละเอียด</Link>
          </span>
        </div>
      </div>
    );
  }
  if (!order) return <PageLoadError message="โหลดใบสั่งซื้อของใบรับนี้ไม่สำเร็จ จึงยังแก้จำนวนไม่ได้" onRetry={reload} />;
  return <ReceiptFormPage key={receipt.purchase_receipt_id} mode="edit" order={order} receipt={receipt} />;
}
