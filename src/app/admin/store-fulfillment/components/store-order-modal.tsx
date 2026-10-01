"use client";

import { useEffect, useState } from "react";
import LoadErrorBanner from "@/components/LoadErrorBanner";
import Modal from "@/components/Modal";
import { getApiErrorMessage } from "@/lib/api-error";
import StoreFulfillmentModel from "@/models/store-fulfillment";
import { StoreOrderWithParcels } from "@/types/store-fulfillment";
import StoreOrderFulfillment from "./store-order-fulfillment";

const storeFulfillmentModel = new StoreFulfillmentModel();

interface StoreOrderModalProps {
  storeOrderId: string;
  onClose: () => void;
  /** The order was changed here (parcel, pickup, cancellation, ...). */
  onChanged: () => void;
}

/** One store order's fulfillment cards in a modal, fetched by id when opened. */
export default function StoreOrderModal({
  storeOrderId,
  onClose,
  onChanged,
}: StoreOrderModalProps) {
  const [order, setOrder] = useState<StoreOrderWithParcels | null>(null);
  const [error, setError] = useState("");
  // Bumped to fetch the order again (retry, or after a change made here).
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    storeFulfillmentModel
      .getOrder(storeOrderId)
      .then((loaded) => {
        if (cancelled) return;
        setError("");
        setOrder(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [storeOrderId, reloads]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="รายละเอียดคำสั่งซื้อหน้าร้าน"
      size="xl"
    >
      {error && (
        <LoadErrorBanner
          message={error}
          onRetry={() => setReloads((count) => count + 1)}
        />
      )}
      {!order && !error && (
        <p className="text-[var(--ink-muted)]">กำลังโหลด...</p>
      )}
      {order && (
        <StoreOrderFulfillment
          order={order}
          onChanged={() => {
            onChanged();
            setReloads((count) => count + 1);
          }}
        />
      )}
    </Modal>
  );
}
