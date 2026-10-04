"use client";

import { useRef, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import StoreFulfillmentModel from "@/models/store-fulfillment";
import { StoreOrderWithParcels } from "@/types/store-fulfillment";
import { getApiErrorMessage } from "@/lib/api-error";
import StoreOrderFulfillment from "./components/store-order-fulfillment";
import StoreOrderList from "./components/store-order-list";
import TaxInvoiceRequestList from "./components/tax-invoice-request-list";

const storeFulfillmentModel = new StoreFulfillmentModel();

export default function StoreFulfillmentPage() {
  const { can } = usePermissions();
  const canView = can("store_fulfillment", "view");

  const [order, setOrder] = useState<StoreOrderWithParcels | null>(null);
  const [error, setError] = useState("");
  // True while a row just chosen is being fetched; the order shown before it
  // is cleared so staff never act on the wrong one.
  const [opening, setOpening] = useState(false);
  // Only the newest request may change the page: a slower earlier answer must
  // not replace the order that was chosen last.
  const latestRequest = useRef(0);
  // The order the page is meant to show. A reload that an earlier card asks
  // for after its own save must not bring that order back over a newer choice.
  const chosenOrderId = useRef<string | null>(null);
  // Bumped when the opened order was changed, so the list shows its new status.
  const [listVersion, setListVersion] = useState(0);

  // Staff find an order in the list below by its code and phone; the id only
  // travels from a row to this call (ADR-0001).
  async function loadOrder(storeOrderId: string) {
    const request = ++latestRequest.current;
    setError("");
    try {
      const loaded = await storeFulfillmentModel.getOrder(storeOrderId);
      if (request === latestRequest.current) setOrder(loaded);
    } catch (err) {
      if (request !== latestRequest.current) return;
      setOrder(null);
      setError(getApiErrorMessage(err));
    } finally {
      if (request === latestRequest.current) setOpening(false);
    }
  }

  // A row of either list below opens its order at the top of the page.
  function openOrder(storeOrderId: string) {
    chosenOrderId.current = storeOrderId;
    setOrder(null);
    setOpening(true);
    void loadOrder(storeOrderId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!canView) {
    return (
      <div className="min-h-full bg-[var(--bg-page)] p-4 sm:p-6">
        <p className="text-[var(--color-text-secondary)]">
          คุณไม่มีสิทธิ์เข้าถึงการจัดส่งพัสดุ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
      <div className="ka-card overflow-hidden">
        <div className="border-b border-[var(--border)] p-3 sm:p-4 md:p-6">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            จัดส่งพัสดุ
          </h1>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[var(--color-error)]">
          {error}
        </p>
      )}

      {opening && (
        <p
          role="status"
          className="mt-4 text-[var(--color-text-secondary)]"
        >
          กำลังโหลดคำสั่งซื้อ...
        </p>
      )}

      {order && (
        <div className="mt-4">
          <StoreOrderFulfillment
            order={order}
            onChanged={() => {
              if (chosenOrderId.current === order.storeOrderId) {
                void loadOrder(order.storeOrderId);
              }
              setListVersion((version) => version + 1);
            }}
          />
        </div>
      )}

      <StoreOrderList onOpen={openOrder} refreshKey={listVersion} />
      <TaxInvoiceRequestList onOpen={openOrder} />
    </div>
  );
}
