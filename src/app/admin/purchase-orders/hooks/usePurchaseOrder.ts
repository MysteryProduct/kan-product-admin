'use client';

import { useCallback, useEffect, useState } from 'react';
import PurchaseOrderModel from '@/models/purchase-order';
import { loadErrorText } from '@/components/LoadErrorBanner';
import type { PurchaseOrder } from '@/types/purchase-order';

const purchaseOrderModel = new PurchaseOrderModel();

/** Loads one purchase order; `reload` refetches it in place after an action. */
export function usePurchaseOrder(id: string | null | undefined) {
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    purchaseOrderModel
      .getPurchaseOrderById(id)
      .then((loaded) => {
        if (!active) return;
        if (loaded?.purchase_order_id) setOrder(loaded);
        else setError('ไม่พบใบสั่งซื้อนี้ อาจถูกลบไปแล้ว');
      })
      .catch((failure: unknown) => {
        if (active) setError(loadErrorText('ใบสั่งซื้อ', failure));
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const reload = useCallback(() => {
    setError(null);
    setAttempt((count) => count + 1);
  }, []);
  return { order, error, reload };
}
