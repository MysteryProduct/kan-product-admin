'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import PurchaseOrderFormPage from '../components/po-form';
import { NoPermissionNote, PageLoadError, PageLoading } from '../components/page-states';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';

/** "สร้างใบสั่งซื้อ"; with `?copy={id}` it starts from that order ("สั่งซ้ำ"). */
function NewPurchaseOrder() {
  const copyId = useSearchParams()?.get('copy');
  const { order, error, reload } = usePurchaseOrder(copyId);

  if (!copyId) return <PurchaseOrderFormPage mode="create" />;
  if (error) return <PageLoadError message={error} onRetry={reload} />;
  if (!order) return <PageLoading what="ใบสั่งซื้อต้นฉบับ" />;
  return <PurchaseOrderFormPage key={copyId} mode="create" source={order} />;
}

export default function NewPurchaseOrderPage() {
  const { can, isLoaded } = usePermissions();
  if (isLoaded && !can('purchase_orders', 'add')) return <NoPermissionNote action="สร้างใบสั่งซื้อ" />;
  return (
    <Suspense fallback={null}>
      <NewPurchaseOrder />
    </Suspense>
  );
}
