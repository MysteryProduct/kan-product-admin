'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import SaleOrderDetail from '../components/so-detail';
import { PageLoadError, PageLoading } from '../components/page-states';
import { useSaleOrder } from '../hooks/useSaleOrder';

function SaleOrderDetailPage() {
  const id = useParams<{ id: string }>()?.id;
  const openReturn = useSearchParams()?.get('return') === '1';
  const { order, error, reload } = useSaleOrder(id);

  if (error && !order) return <PageLoadError message={error} onRetry={reload} />;
  if (!order) return <PageLoading what="ใบสั่งขาย" />;
  return <SaleOrderDetail saleOrder={order} onChanged={reload} openReturn={openReturn} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SaleOrderDetailPage />
    </Suspense>
  );
}
