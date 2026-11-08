'use client';

import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import StockModel, { type StockKind } from '@/models/stock';
import StoreLotModel from '@/models/store-lot';

const stockModel = new StockModel();
const storeLotModel = new StoreLotModel();
const REFRESH_MS = 5 * 60 * 1000;
const REFRESH_EVENT = 'ka-stock-pending-changed';

export interface StockPending {
  lots: number;
  adjustments: number;
  counts: number;
  total: number;
  /** Tabs belong to one kind, so they read this instead of the sums above. */
  byKind: Record<StockKind, { adjustments: number; counts: number }>;
}

/** The menu and the stock page hold their own counts; this makes both read again. */
export function refreshStockPending() {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

/**
 * Work waiting in the stock menu, limited to what this employee may see (M1).
 * Any failed read leaves the count out: a partial sum would be a wrong number.
 */
export function useStockPending(): StockPending | undefined {
  const { can, isLoaded } = usePermissions();
  const [pending, setPending] = useState<StockPending>();
  const canLots = can('store_fulfillment', 'view');
  const canMaterial = can('stock_material', 'view');
  const canProduct = can('stock_product', 'view');
  // `add` alone reads the rounds being counted through the sheets, and no adjustments (TASK-0364 Q11).
  const addMaterial = can('stock_material', 'add');
  const addProduct = can('stock_product', 'add');

  useEffect(() => {
    if (!isLoaded || (!canLots && !canMaterial && !canProduct && !addMaterial && !addProduct)) return;
    let cancelled = false;
    const kinds: StockKind[] = [...(canMaterial ? ['material' as const] : []), ...(canProduct ? ['product' as const] : [])];
    const countKinds: [StockKind, boolean][] = [
      ...(canMaterial || addMaterial ? [['material', canMaterial] as [StockKind, boolean]] : []),
      ...(canProduct || addProduct ? [['product', canProduct] as [StockKind, boolean]] : []),
    ];
    const load = async () => {
      try {
        const byKind = { material: { adjustments: 0, counts: 0 }, product: { adjustments: 0, counts: 0 } };
        const [lots] = await Promise.all([
          canLots ? storeLotModel.getStoreLots(1, 1, 'unreleased').then((res) => res.meta.total) : 0,
          ...kinds.map(async (kind) => {
            byKind[kind].adjustments = await stockModel.countAdjustments(kind, 'pending');
          }),
          ...countKinds.map(async ([kind, canView]) => {
            const [counting, reviewing] = await Promise.all([
              stockModel.countRounds(kind, 'counting', canView),
              canView ? stockModel.countRounds(kind, 'reviewing') : 0,
            ]);
            byKind[kind].counts = counting + reviewing;
          }),
        ]);
        const adjustments = byKind.material.adjustments + byKind.product.adjustments;
        const counts = byKind.material.counts + byKind.product.counts;
        if (!cancelled) setPending({ lots, adjustments, counts, total: lots + adjustments + counts, byKind });
      } catch {
        if (!cancelled) setPending(undefined);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const refresh = () => void load();
    window.addEventListener(REFRESH_EVENT, refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(REFRESH_EVENT, refresh);
    };
  }, [isLoaded, canLots, canMaterial, canProduct, addMaterial, addProduct]);

  return pending;
}
