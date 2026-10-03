"use client";

import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { STORE_ORDER_STATUS_LABELS } from "@/lib/store-order-list";
import { StoreOrderWithParcels } from "@/types/store-fulfillment";
import CreateParcelModal from "./create-parcel-modal";
import ParcelCard from "./parcel-card";
import PickupCard from "./pickup-card";
import CancellationCard from "./cancellation-card";
import DeliveryConversionCard from "./delivery-conversion-card";
import TaxInvoiceCard from "./tax-invoice-card";
import ReturnCard from "./return-card";

// The same words as the order list, which keeps them (TASK-0088).
export const statusLabels: Record<string, string> = STORE_ORDER_STATUS_LABELS;

interface StoreOrderFulfillmentProps {
  order: StoreOrderWithParcels;
  /** Something about the order changed (parcel saved, cancellation decided, ...); reload it. */
  onChanged: () => void;
}

/**
 * The fulfillment cards of one store order: items, tax invoice, cancellation,
 * delivery conversion, pickup and parcels. Shared by the fulfillment page and
 * the dashboard's store-order modal so both show and change the same thing.
 */
export default function StoreOrderFulfillment({
  order,
  onChanged,
}: StoreOrderFulfillmentProps) {
  const { can } = usePermissions();
  const canAdd = can("store_fulfillment", "add");
  const canEdit = can("store_fulfillment", "edit");
  const [showCreateParcel, setShowCreateParcel] = useState(false);

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

  return (
    <>
      <div className="grid gap-4">
        <div className="ka-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                คำสั่งซื้อ #{order.storeOrderId}
              </p>
              <p className="font-medium">
                {order.fulfillmentMethod === "delivery"
                  ? "จัดส่ง"
                  : "รับที่ร้าน"}{" "}
                · {statusLabels[order.status] ?? order.status}
              </p>
            </div>
            {canCreateParcel && (
              <button
                type="button"
                onClick={() => setShowCreateParcel(true)}
                disabled={!hasRemaining || !!unpaidShipping}
                className="ka-btn ka-btn--primary min-h-11"
              >
                บันทึกพัสดุใหม่
              </button>
            )}
          </div>
          {canCreateParcel && unpaidShipping && (
            <p className="mt-2 text-sm text-[var(--warning)]">
              รอลูกค้าชำระค่าจัดส่ง {unpaidShipping.amount} บาท
              จึงจะบันทึกพัสดุได้
            </p>
          )}

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                <th className="py-2">สินค้า</th>
                <th className="py-2 text-right">ซื้อ</th>
                <th className="py-2 text-right">ส่งแล้ว</th>
                <th className="py-2 text-right">คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((line) => (
                <tr
                  key={line.saleOrderListId}
                  className="border-b border-[var(--border)]"
                >
                  <td className="py-2">{line.productName}</td>
                  <td className="py-2 text-right">{line.purchasedQty}</td>
                  <td className="py-2 text-right">{line.shippedQty}</td>
                  <td className="py-2 text-right">{line.remainingUnshipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {order.taxInvoice && <TaxInvoiceCard request={order.taxInvoice} />}

        {order.cancellation && (
          <CancellationCard
            cancellation={order.cancellation}
            canEdit={canEdit}
            onChanged={() => onChanged()}
          />
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

        <DeliveryConversionCard
          order={order}
          canEdit={canEdit}
          cancellationHolds={cancellationHolds}
          onChanged={() => onChanged()}
        />

        {order.fulfillmentMethod === "pickup" && order.pickup && (
          <PickupCard
            storeOrderId={order.storeOrderId}
            pickup={order.pickup}
            orderPaid={order.status === "paid"}
            canEdit={canEdit}
            onChanged={() => onChanged()}
          />
        )}

        <div className="grid gap-3">
          {order.fulfillmentMethod === "delivery" &&
            order.parcels.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                ยังไม่มีพัสดุสำหรับคำสั่งซื้อนี้
              </p>
            )}
          {order.parcels.map((parcel) => (
            <ParcelCard
              key={parcel.parcelId}
              parcel={parcel}
              canEdit={canEdit}
              onChanged={() => onChanged()}
            />
          ))}
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
