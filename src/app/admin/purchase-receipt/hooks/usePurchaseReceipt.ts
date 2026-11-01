'use client';

import { useCallback, useEffect, useState } from 'react';
import PurchaseOrderModel from '@/models/purchase-order';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import { loadErrorText } from '@/components/LoadErrorBanner';
import type { PurchaseOrder } from '@/types/purchase-order';
import type { Receipt } from '../lib/pr-display';

const purchaseOrderModel = new PurchaseOrderModel();
const purchaseReceiptModel = new PurchaseReceiptModel();

/**
 * Loads one receipt and the order it was received against: the order carries every line's ordered
 * quantity, what is still to receive, the material and the unit. `reload` refetches both in place.
 */
export function usePurchaseReceipt(id: string | null | undefined) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    purchaseReceiptModel
      .getPurchaseReceiptById(id)
      .then(async (loaded) => {
        if (!active) return;
        if (!loaded?.purchase_receipt_id) {
          setError('ไม่พบใบรับสินค้านี้ อาจถูกลบไปแล้ว');
          return;
        }
        // The order is context; the receipt still shows if it cannot be loaded.
        const linked = await purchaseOrderModel.getPurchaseOrderById(loaded.purchase_order_id).catch(() => null);
        if (!active) return;
        setReceipt(loaded as Receipt);
        setOrder(linked?.purchase_order_id ? linked : null);
      })
      .catch((failure: unknown) => {
        if (active) setError(loadErrorText('ใบรับสินค้า', failure));
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const reload = useCallback(() => {
    setError(null);
    setAttempt((count) => count + 1);
  }, []);
  return { receipt, order, error, reload };
}

/** Loads the order a new receipt is for. */
export function useOrderToReceive(id: string | null | undefined) {
  // Kept with the id it was loaded for, so picking another order never shows the previous one.
  const [loaded, setLoaded] = useState<{ id: string; order: PurchaseOrder } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    purchaseOrderModel
      .getPurchaseOrderById(id)
      .then((found) => {
        if (!active) return;
        if (found?.purchase_order_id) setLoaded({ id, order: found });
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
  return { order: loaded && loaded.id === id ? loaded.order : null, error, reload };
}
