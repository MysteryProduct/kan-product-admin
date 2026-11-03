'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import SaleOrderFormPage from '../components/so-form';
import { NoPermissionNote } from '../components/page-states';

/** "สร้างใบสั่งขาย"; with `?ready=a,b` it starts from those ready-to-sell goods. */
function NewSaleOrder() {
  const ready = useSearchParams()?.get('ready') ?? '';
  const readyIds = useMemo(() => ready.split(',').map((id) => id.trim()).filter(Boolean), [ready]);
  return <SaleOrderFormPage key={ready} mode="create" readyIds={readyIds} />;
}

export default function NewSaleOrderPage() {
  const { can, isLoaded } = usePermissions();
  if (isLoaded && !can('sale_orders', 'add')) return <NoPermissionNote action="สร้างใบสั่งขาย" />;
  return (
    <Suspense fallback={null}>
      <NewSaleOrder />
    </Suspense>
  );
}
