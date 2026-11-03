'use client';

import { useCallback, useEffect, useState } from 'react';
import SaleOrderModel from '@/models/sale-order';
import { loadErrorText } from '@/components/LoadErrorBanner';
import type { SaleOrder } from '@/types/sale-order';

const saleOrderModel = new SaleOrderModel();

/** Loads one sale order; `reload` refetches it in place after an action. */
export function useSaleOrder(id: string | null | undefined) {
  const [order, setOrder] = useState<SaleOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    saleOrderModel
      .getSaleOrderById(id)
      .then((loaded) => {
        if (!active) return;
        if (loaded?.sale_order_id) setOrder(loaded);
        else setError('ไม่พบใบสั่งขายนี้ อาจถูกลบไปแล้ว');
      })
      .catch((failure: unknown) => {
        if (active) setError(loadErrorText('ใบสั่งขาย', failure));
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
