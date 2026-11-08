'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import MaterialModel from '@/models/material';
import type { Material } from '@/types/material';
import PurchaseOrderFormPage from '../components/po-form';
import { NoPermissionNote, PageLoadError, PageLoading } from '../components/page-states';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';

const materialModel = new MaterialModel();

/** Reads the material by id, so one outside the form's first 100 options still shows on the line. */
function SeededPurchaseOrder({ materialId }: { materialId: string }) {
  const [loaded, setLoaded] = useState<{ material?: Material; error?: string }>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    materialModel.getMaterialById(materialId)
      .then((material) => active && setLoaded({ material }))
      .catch((error: unknown) => active && setLoaded({ error: error instanceof Error ? error.message : 'โหลดวัตถุดิบไม่สำเร็จ' }));
    return () => { active = false; };
  }, [materialId, attempt]);

  if (loaded.error) {
    return <PageLoadError message={loaded.error} onRetry={() => { setLoaded({}); setAttempt((value) => value + 1); }} />;
  }
  if (!loaded.material) return <PageLoading what="วัตถุดิบ" />;
  return <PurchaseOrderFormPage key={materialId} mode="create" seedMaterial={loaded.material} />;
}

/** "สร้างใบสั่งซื้อ"; `?copy={id}` starts from that order ("สั่งซ้ำ"), `?material={id}` from that material. */
function NewPurchaseOrder() {
  const params = useSearchParams();
  const copyId = params?.get('copy');
  const materialId = params?.get('material');
  const { order, error, reload } = usePurchaseOrder(copyId);

  if (!copyId && materialId) return <SeededPurchaseOrder materialId={materialId} />;
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
