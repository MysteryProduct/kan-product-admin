'use client';

import { useParams } from 'next/navigation';
import PurchaseOrderDetail from '../components/po-detail';
import { PageLoadError, PageLoading } from '../components/page-states';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';

export default function PurchaseOrderDetailPage() {
  const id = useParams<{ id: string }>()?.id;
  const { order, error, reload } = usePurchaseOrder(id);

  if (error && !order) return <PageLoadError message={error} onRetry={reload} />;
  if (!order) return <PageLoading what="ใบสั่งซื้อ" />;
  return <PurchaseOrderDetail purchaseOrder={order} onChanged={reload} />;
}
