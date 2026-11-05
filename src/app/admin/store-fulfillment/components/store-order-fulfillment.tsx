"use client";

import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { STORE_ORDER_STATUS_TONE } from "@/lib/status-tones";
import { formatThaiDateTime } from "@/lib/date-format";
import { STORE_CUSTOMER_TYPE_LABELS, STORE_ORDER_STATUS_LABELS } from "@/lib/store-order-list";
import { storeOrderSteps } from "@/lib/store-order-steps";
import { StoreOrderListStatus, StoreOrderWithParcels } from "@/types/store-fulfillment";
import CreateParcelModal from "./create-parcel-modal";
import ParcelCard from "./parcel-card";
import PickupCard, { PickupFollowUpCards, usePickupAction } from "./pickup-card";
import CancellationCard from "./cancellation-card";
import DeliveryConversionCard from "./delivery-conversion-card";
import TaxInvoiceCard from "./tax-invoice-card";
import ReturnCard from "./return-card";
import SfIcon, { type SfIconName } from "./sf-icon";
import "../store-fulfillment.css";

// The same words as the order list, which keeps them (TASK-0088).
export const statusLabels: Record<string, string> = STORE_ORDER_STATUS_LABELS;

const STEP_ICON: Record<string, SfIconName> = {
  done: "tick",
  now: "truck",
  warn: "clock",
  idle: "tick",
};

interface StoreOrderFulfillmentProps {
  order: StoreOrderWithParcels;
  /** Something about the order changed (parcel saved, cancellation decided, ...); reload it. */
  onChanged: () => void;
  /** Inside the Dashboard's modal, whose title is the page's heading. */
  embedded?: boolean;
}

/**
 * The fulfillment view of one store order: where it stands, items, parcels,
 * pickup, cancellation, returns, tax invoice and delivery conversion. Shared by
 * the fulfillment page and the dashboard's store-order modal so both show and
 * change the same thing.
 */
export default function StoreOrderFulfillment({
  order,
  onChanged,
  embedded = false,
}: StoreOrderFulfillmentProps) {
  const { can } = usePermissions();
  const canAdd = can("store_fulfillment", "add");
  const canEdit = can("store_fulfillment", "edit");
  const [showCreateParcel, setShowCreateParcel] = useState(false);
  const pickupAction = usePickupAction(onChanged);

  const hasRemaining = order.items.some((line) => line.remainingUnshipped > 0);
  // A pending or approved cancellation holds fulfillment, so the API would
  // refuse a new parcel anyway; the button is hidden rather than left to fail.
  const cancellationHolds =
    order.cancellation?.status === "pending" ||
    order.cancellation?.status === "approved";
  const canCreateParcel =
    canAdd &&
    order.status === "paid" &&
    order.fulfillmentMethod === "delivery" &&
    !cancellationHolds;
  // TASK-0037: no cash on delivery, so the API refuses a parcel while
  // shipping is still owed; staff are told why instead of meeting the error.
  const unpaidShipping = order.shippingCharges.find(
    (charge) =>
      charge.status === "awaiting_payment" ||
      charge.status === "pending_review",
  );

  const isDelivery = order.fulfillmentMethod === "delivery";
  const Heading = embedded ? "h2" : "h1";
  const purchased = order.items.reduce((sum, line) => sum + line.purchasedQty, 0);
  const shipped = order.items.reduce((sum, line) => sum + line.shippedQty, 0);
  const address = order.defaultAddress;
  const liveParcels = order.parcels.filter((parcel) => parcel.status !== "voided");
  const voidedCount = order.parcels.length - liveParcels.length;

  return (
    <>
      <div className="ka-sf-order">
        <section className="ka-sf-card ka-sf-hero">
          <div className="ka-sf-hero__top">
            <div className="min-w-0">
              <p className="ka-sf-sub">คำสั่งซื้อ</p>
              <Heading className="ka-sf-code ka-sf-num">{order.saleOrderCode}</Heading>
              <div className="ka-sf-row ka-sf-row--wrap mt-1.5">
                <StatusBadge tone={STORE_ORDER_STATUS_TONE[order.status as StoreOrderListStatus]}>
                  {statusLabels[order.status] ?? order.status}
                </StatusBadge>
                <span className="ka-sf-method">
                  <SfIcon name={isDelivery ? "truck" : "store"} small />
                  {isDelivery ? "จัดส่ง" : "รับที่ร้าน"}
                </span>
                {order.cancellation?.status === "pending" && (
                  <StatusBadge tone="warning" live>
                    รอพิจารณาคำขอยกเลิก
                  </StatusBadge>
                )}
              </div>
              <p className="ka-sf-sub ka-sf-num mt-1.5">
                {order.customerName ?? "-"} · {order.customerPhone ?? "-"} ·{" "}
                {STORE_CUSTOMER_TYPE_LABELS[order.customerType] ?? "-"}
                <br />
                สั่งเมื่อ {order.createdAt ? formatThaiDateTime(order.createdAt) : "-"} · ยอดรวม{" "}
                {typeof order.total === "number"
                  ? `฿${order.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "-"}
              </p>
            </div>
            {canCreateParcel && (
              <div className="ka-sf-hero__action">
                <button
                  type="button"
                  onClick={() => setShowCreateParcel(true)}
                  disabled={!hasRemaining || !!unpaidShipping}
                  className="ka-btn ka-btn--primary"
                >
                  <SfIcon name="plus" small />
                  บันทึกพัสดุใหม่
                </button>
                {unpaidShipping && (
                  <p className="ka-sf-warn">
                    รอลูกค้าชำระค่าจัดส่ง {unpaidShipping.amount} บาท จึงจะบันทึกพัสดุได้
                  </p>
                )}
              </div>
            )}
          </div>
          <ol className="ka-sf-steps">
            {storeOrderSteps(order).map((step) => (
              <li key={step.label} className={`ka-sf-step ka-sf-step--${step.state}`}>
                <span className="ka-sf-step__dot">
                  <SfIcon name={STEP_ICON[step.state]} small />
                </span>
                <span className="ka-sf-step__label">{step.label}</span>
                <span className="ka-sf-cap">{step.sub}</span>
              </li>
            ))}
          </ol>
        </section>

        {order.cancellation?.status === "pending" && (
          <p className="ka-sf-ban ka-sf-tone--warning" role="status">
            <SfIcon name="warn" />
            ระหว่างรอพิจารณา ระบบพักการบันทึกพัสดุ การจัดส่ง และการส่งมอบไว้ก่อน
          </p>
        )}

        <div className="ka-sf-grid">
          <div className="ka-sf-stack">
            {order.cancellation && (
              <CancellationCard
                cancellation={order.cancellation}
                canEdit={canEdit}
                onChanged={() => onChanged()}
              />
            )}

            {order.fulfillmentMethod === "pickup" && order.pickup && (
              <PickupCard
                storeOrderId={order.storeOrderId}
                pickup={order.pickup}
                orderPaid={order.status === "paid"}
                canEdit={canEdit}
                action={pickupAction}
              />
            )}

            <section className="ka-sf-card ka-sf-card--clip">
              <div className="ka-sf-card__head">
                <h2>สินค้าในคำสั่งซื้อ</h2>
                <span className="ka-sf-cap">
                  ลงพัสดุแล้ว {shipped} จาก {purchased} ชิ้น
                </span>
              </div>
              <div className="ka-sf-tw">
                <table className="ka-sf-items">
                  <thead>
                    <tr>
                      <th>สินค้า</th>
                      <th style={{ width: 150 }}>ความคืบหน้า</th>
                      <th className="ka-sf-r">ซื้อ</th>
                      <th className="ka-sf-r">ลงพัสดุแล้ว</th>
                      <th className="ka-sf-r">คงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((line) => (
                      <tr key={line.saleOrderListId}>
                        <td>{line.productName}</td>
                        <td className="ka-sf-meter-cell">
                          <div
                            className={`ka-sf-meter ${line.remainingUnshipped === 0 ? "ka-sf-meter--done" : ""}`}
                            role="img"
                            aria-label={`ลงพัสดุแล้ว ${line.shippedQty} จาก ${line.purchasedQty}`}
                          >
                            <i
                              style={{
                                width: `${line.purchasedQty > 0 ? Math.min(100, (line.shippedQty / line.purchasedQty) * 100) : 0}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="ka-sf-r" data-label="ซื้อ">{line.purchasedQty}</td>
                        <td className="ka-sf-r" data-label="ลงพัสดุแล้ว">{line.shippedQty}</td>
                        <td className="ka-sf-r font-semibold" data-label="คงเหลือ">{line.remainingUnshipped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {(isDelivery || order.parcels.length > 0) && (
              <section className="ka-sf-card ka-sf-card--clip">
                <div className="ka-sf-card__head">
                  <h2>พัสดุ</h2>
                  {order.parcels.length > 0 && (
                    <span className="ka-sf-cap">
                      {liveParcels.length} พัสดุ{voidedCount > 0 ? ` · ยกเลิก ${voidedCount}` : ""}
                    </span>
                  )}
                </div>
                {order.parcels.length === 0 && (
                  <p className="ka-sf-empty-note">ยังไม่มีพัสดุสำหรับคำสั่งซื้อนี้</p>
                )}
                {[...liveParcels, ...order.parcels.filter((parcel) => parcel.status === "voided")].map((parcel) => (
                  <ParcelCard
                    key={parcel.parcelId}
                    parcel={parcel}
                    canEdit={canEdit}
                    onChanged={() => onChanged()}
                  />
                ))}
              </section>
            )}

            {order.returns && (
              <ReturnCard
                storeOrderId={order.storeOrderId}
                orderStatus={order.status}
                returns={order.returns}
                canEdit={canEdit}
                onChanged={() => onChanged()}
              />
            )}
          </div>

          <div className={`ka-sf-aside ${isDelivery ? "ka-sf-aside--sticky" : ""}`}>
            {isDelivery && address?.addressLine1 && (
              <section className="ka-sf-card ka-sf-card__pad">
                <div className="ka-sf-row" style={{ gap: 8 }}>
                  <SfIcon name="pin" />
                  <h3>ที่อยู่จัดส่ง</h3>
                </div>
                <div>
                  <p className="m-0 font-semibold">{address.recipientName ?? "-"}</p>
                  <p className="ka-sf-num m-0">{address.recipientPhone ?? "-"}</p>
                  <p className="ka-sf-sub">
                    {[address.addressLine1, address.addressLine2, address.district, address.province, address.postalCode]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>
              </section>
            )}
            {order.fulfillmentMethod === "pickup" && order.pickup && (
              <PickupFollowUpCards
                storeOrderId={order.storeOrderId}
                pickup={order.pickup}
                orderPaid={order.status === "paid"}
                canEdit={canEdit}
                action={pickupAction}
              />
            )}
            <DeliveryConversionCard
              order={order}
              canEdit={canEdit}
              cancellationHolds={cancellationHolds}
              onChanged={() => onChanged()}
            />
            {order.taxInvoice && <TaxInvoiceCard request={order.taxInvoice} />}
          </div>
        </div>
      </div>
      {showCreateParcel && (
        <CreateParcelModal
          isOpen={showCreateParcel}
          onClose={() => setShowCreateParcel(false)}
          onSuccess={() => onChanged()}
          storeOrderId={order.storeOrderId}
          lines={order.items}
          defaultAddress={order.defaultAddress}
        />
      )}
    </>
  );
}
