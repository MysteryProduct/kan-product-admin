'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import ReceiptFormPage, { OrderPicker } from '../components/receipt-form';
import { NoPermissionNote, PageLoadError, PageLoading } from '../components/page-states';
import { useOrderToReceive } from '../hooks/usePurchaseReceipt';

/** "รับสินค้า" for the order in `?po={id}`; without one the employee picks the order first. */
function NewReceipt() {
  const orderId = useSearchParams()?.get('po');
  const { order, error, reload } = useOrderToReceive(orderId);

  if (!orderId) return <OrderPicker />;
  if (error) return <PageLoadError message={error} onRetry={reload} />;
  if (!order) return <PageLoading what="ใบสั่งซื้อ" />;
  return <ReceiptFormPage key={order.purchase_order_id} mode="create" order={order} />;
}

export default function NewPurchaseReceiptPage() {
  const { can, isLoaded } = usePermissions();
  if (isLoaded && !can('purchase_receipt', 'add')) return <NoPermissionNote action="รับสินค้า" />;
  return (
    <Suspense fallback={null}>
      <NewReceipt />
    </Suspense>
  );
}
