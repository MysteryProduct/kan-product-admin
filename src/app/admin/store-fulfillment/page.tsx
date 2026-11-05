"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoadErrorBanner from "@/components/LoadErrorBanner";
import { refreshPendingWork, usePendingWork } from "@/hooks/usePendingWork";
import { usePermissions } from "@/hooks/usePermissions";
import StoreFulfillmentModel from "@/models/store-fulfillment";
import { StoreOrderQueue, StoreOrderWithParcels } from "@/types/store-fulfillment";
import { getApiErrorMessage } from "@/lib/api-error";
import SfIcon from "./components/sf-icon";
import StoreOrderFulfillment from "./components/store-order-fulfillment";
import StoreOrderList from "./components/store-order-list";
import TaxInvoiceRequestList from "./components/tax-invoice-request-list";
import WorkTiles from "./components/work-tiles";
import "./store-fulfillment.css";

const storeFulfillmentModel = new StoreFulfillmentModel();
const PAGE_PATH = "/admin/store-fulfillment";

type Tab = "orders" | "tax";

function StoreFulfillmentContent() {
  const { can } = usePermissions();
  const canView = can("store_fulfillment", "view");
  const router = useRouter();
  // Staff find an order in the list by its code and phone; the id only travels
  // from a row to this address (ADR-0001). The address is what is open, so a
  // reload and the browser's back button keep working.
  const orderId = useSearchParams().get("orderId");

  const [loaded, setLoaded] = useState<StoreOrderWithParcels | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  // Bumped to read the open order again, or to retry it.
  const [reloads, setReloads] = useState(0);
  // Bumped when the opened order was changed, so the list and the counts follow.
  const [listVersion, setListVersion] = useState(0);
  const [tab, setTab] = useState<Tab>("orders");
  const [queue, setQueue] = useState<StoreOrderQueue | "">("");
  const [totals, setTotals] = useState<{ orders?: number; tax?: number }>({});
  const work = usePendingWork(canView);
  // The page scrolls inside the admin layout's <main>, not the window.
  const listScroll = useRef(0);

  // Back on the list nothing stays loaded, so reopening an order never shows
  // what was read last time with its buttons live.
  if (!orderId && (loaded || failure)) {
    setLoaded(null);
    setFailure(null);
  }

  useEffect(() => {
    const scroller = document.querySelector("main");
    scroller?.scrollTo({ top: orderId ? 0 : listScroll.current });
  }, [orderId]);

  useEffect(() => {
    if (!canView || !orderId) return;
    // Only the newest request may change the page: a slower earlier answer
    // must not replace the order that was chosen last.
    let active = true;
    storeFulfillmentModel
      .getOrder(orderId)
      .then((next) => {
        if (!active) return;
        setLoaded(next);
        setFailure(null);
      })
      .catch((err) => {
        if (!active) return;
        setLoaded(null);
        setFailure({ id: orderId, message: getApiErrorMessage(err) });
      });
    return () => {
      active = false;
    };
  }, [canView, orderId, reloads]);

  // The order shown before this one is never left up, so staff cannot act on the wrong one.
  const order = loaded && loaded.storeOrderId === orderId ? loaded : null;
  const error = failure && failure.id === orderId ? failure.message : "";

  function openOrder(storeOrderId: string) {
    listScroll.current = document.querySelector("main")?.scrollTop ?? 0;
    router.push(`${PAGE_PATH}?orderId=${encodeURIComponent(storeOrderId)}`, { scroll: false });
  }

  if (!canView) {
    return (
      <div className="ka-sf">
        <div className="ka-sf-card ka-sf-empty">
          <span className="ka-sf-empty__icon">
            <SfIcon name="lock" />
          </span>
          <h3>คุณไม่มีสิทธิ์เข้าถึงการจัดส่งพัสดุ</h3>
          <p className="ka-sf-sub">กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ka-sf">
      {orderId && (
        <div className="ka-sf-view">
          <div className="ka-sf-backrow">
            <button type="button" className="ka-sf-back" onClick={() => router.push(PAGE_PATH, { scroll: false })}>
              <SfIcon name="left" small />
              กลับไปรายการคำสั่งซื้อ
            </button>
          </div>
          {error && (
            <LoadErrorBanner
              message={`โหลดคำสั่งซื้อไม่สำเร็จ: ${error}`}
              onRetry={() => setReloads((count) => count + 1)}
            />
          )}
          {!order && !error && (
            <div className="ka-sf-card ka-sf-skel" role="status" aria-label="กำลังโหลดคำสั่งซื้อ">
              <span className="ka-skel ka-skel--title" />
              <span className="ka-skel" />
            </div>
          )}
          {order && (
            <StoreOrderFulfillment
              order={order}
              onChanged={() => {
                setReloads((count) => count + 1);
                setListVersion((version) => version + 1);
                refreshPendingWork();
              }}
            />
          )}
        </div>
      )}

      {/* Stays mounted behind an open order, so going back finds the same filters and page. */}
      <div className="ka-sf-view" hidden={!!orderId}>
        <div>
          <h1>จัดส่งพัสดุ</h1>
          <p className="ka-sf-sub">คำสั่งซื้อจากหน้าร้านออนไลน์ งานแพ็กส่ง นัดรับ และเรื่องที่รอตัดสินใจ</p>
        </div>
        <WorkTiles
          work={work}
          selected={queue}
          onSelect={(next) => {
            setQueue(next);
            setTab("orders");
          }}
        />
        <section className="ka-sf-card ka-sf-card--clip">
          <div className="ka-tabs ka-sf-tabs" role="group" aria-label="มุมมอง">
            <button type="button" aria-current={tab === "orders" ? "true" : undefined} onClick={() => setTab("orders")}>
              คำสั่งซื้อ
              {totals.orders !== undefined && <span>{totals.orders}</span>}
            </button>
            <button type="button" aria-current={tab === "tax" ? "true" : undefined} onClick={() => setTab("tax")}>
              คำขอใบกำกับภาษี
              {totals.tax !== undefined && <span>{totals.tax}</span>}
            </button>
          </div>
          <div hidden={tab !== "orders"}>
            <StoreOrderList
              onOpen={openOrder}
              refreshKey={listVersion}
              queue={queue}
              onClearQueue={() => setQueue("")}
              onTotal={(orders) => setTotals((current) => ({ ...current, orders }))}
            />
          </div>
          <div hidden={tab !== "tax"}>
            <TaxInvoiceRequestList
              onOpen={openOrder}
              refreshKey={listVersion}
              onTotal={(tax) => setTotals((current) => ({ ...current, tax }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export default function StoreFulfillmentPage() {
  return (
    <Suspense fallback={null}>
      <StoreFulfillmentContent />
    </Suspense>
  );
}
