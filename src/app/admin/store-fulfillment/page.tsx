"use client";

import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import StoreFulfillmentModel from "@/models/store-fulfillment";
import { StoreOrderWithParcels } from "@/types/store-fulfillment";
import { getApiErrorMessage } from "@/lib/api-error";
import StoreOrderFulfillment from "./components/store-order-fulfillment";
import StoreOrderList from "./components/store-order-list";
import TaxInvoiceRequestList from "./components/tax-invoice-request-list";

const storeFulfillmentModel = new StoreFulfillmentModel();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function StoreFulfillmentPage() {
  const { can } = usePermissions();
  const canView = can("store_fulfillment", "view");

  const [storeOrderIdInput, setStoreOrderIdInput] = useState("");
  const [order, setOrder] = useState<StoreOrderWithParcels | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Bumped when the opened order was changed, so the list shows its new status.
  const [listVersion, setListVersion] = useState(0);

  async function search(id?: string) {
    const targetId = (id ?? storeOrderIdInput).trim();
    if (!uuidPattern.test(targetId)) {
      setError("รูปแบบเลขคำสั่งซื้อไม่ถูกต้อง");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setOrder(await storeFulfillmentModel.getOrder(targetId));
    } catch (err) {
      setOrder(null);
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // A row of either list below opens its order at the top of the page.
  function openOrder(storeOrderId: string) {
    setStoreOrderIdInput(storeOrderId);
    void search(storeOrderId);
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
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 md:p-6">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            จัดส่งพัสดุ
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
            className="flex gap-2"
          >
            <input
              value={storeOrderIdInput}
              onChange={(e) => setStoreOrderIdInput(e.target.value)}
              placeholder="เลขคำสั่งซื้อ (store order id)"
              className="ka-input min-h-11 w-80 max-w-full"
            />
            <button
              type="submit"
              disabled={loading}
              className="ka-btn ka-btn--primary min-h-11"
            >
              {loading ? "กำลังค้นหา..." : "ค้นหา"}
            </button>
          </form>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[var(--color-error)]">
          {error}
        </p>
      )}

      {order && (
        <div className="mt-4">
          <StoreOrderFulfillment
            order={order}
            onChanged={() => {
              void search(order.storeOrderId);
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
