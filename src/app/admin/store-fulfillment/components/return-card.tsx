"use client";
import { useState } from "react";
import { useNow } from "@/hooks/useNow";
import StoreFulfillmentModel from "@/models/store-fulfillment";
import { StoreReturnReason, StoreReturns } from "@/types/store-fulfillment";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatThaiDate } from "@/lib/date-format";
import ConfirmDialog from "@/components/ConfirmDialog";
import { RefundPanel } from "./cancellation-card";
import CustomSelect from '@/components/CustomSelect';

const storeFulfillmentModel = new StoreFulfillmentModel();

// R11 as the owner set it on 2026-10-02.
const RETURN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const reasonLabels: Record<StoreReturnReason, string> = {
  defective: "สินค้าชำรุด",
  incomplete: "สินค้าไม่สมบูรณ์",
  wrong_item: "สินค้าไม่ตรงตามที่สั่ง",
};

type Draft = Record<string, { quantity: number; restock: boolean }>;

const baht = (value: number) =>
  value.toLocaleString("th-TH", { minimumFractionDigits: 2 });

/**
 * TASK-0109: goods a customer returns after receiving them. The customer
 * arranges it with the shop (R11); staff record what came back here, and the
 * refund then follows the same path as a cancellation refund.
 */
export default function ReturnCard({
  storeOrderId,
  orderStatus,
  returns,
  canEdit,
  onChanged,
}: {
  storeOrderId: string;
  orderStatus: string;
  returns: StoreReturns;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const returnable = returns.lines.filter((line) => line.returnableQty > 0);
  const [draft, setDraft] = useState<Draft>({});
  const [reason, setReason] = useState<StoreReturnReason | "">("");
  const [note, setNote] = useState("");
  // One reference per submission, so a repeat finds the same return.
  const [reference, setReference] = useState(() => crypto.randomUUID());
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Follows the clock, so the days since receipt and the return window follow the date.
  const now = useNow();

  const chosen = returnable
    .map((line) => ({ line, entry: draft[line.saleOrderListId] }))
    .filter(({ entry }) => entry && entry.quantity > 0);
  const total = chosen.reduce(
    (sum, { line, entry }) => sum + line.unitPrice * entry.quantity,
    0,
  );
  const canSubmit = chosen.length > 0 && reason !== "" && !pending;

  const setLine = (
    id: string,
    change: Partial<{ quantity: number; restock: boolean }>,
  ) =>
    setDraft((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? { quantity: 0, restock: false }),
        ...change,
      },
    }));

  const setQuantity = (line: StoreReturns["lines"][number], value: number) =>
    setLine(line.saleOrderListId, {
      quantity: Math.min(line.returnableQty, Math.max(0, Math.floor(value) || 0)),
    });

  async function submit() {
    if (!reason) return;
    setPending(true);
    setError("");
    try {
      await storeFulfillmentModel.createReturn(storeOrderId, {
        return_reference: reference,
        reason,
        note: note.trim() || undefined,
        items: chosen.map(({ line, entry }) => ({
          sale_order_list_id: line.saleOrderListId,
          quantity: entry.quantity,
          restock: entry.restock,
        })),
      });
      setDraft({});
      setReason("");
      setNote("");
      setReference(crypto.randomUUID());
      onChanged();
    } catch (err) {
      // What was entered stays, so staff can correct it and try again.
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const received = returns.receivedDates.map((entry) => ({
    ...entry,
    days: Math.floor((now - new Date(entry.date).getTime()) / DAY_MS),
  }));
  const allPastWindow =
    received.length > 0 && received.every((entry) => entry.days > RETURN_DAYS);

  if (received.length === 0 && returns.returns.length === 0) return null;

  return (
    <section className="ka-sf-card ka-sf-card__pad">
      <h2>การคืนสินค้าหลังได้รับ</h2>

      {received.length > 0 && (
        <ul className="ka-sf-sub m-0 grid list-none gap-1 p-0">
          {received.map((entry, index) => (
            <li key={index}>
              {entry.source === "pickup" ? "ลูกค้ารับที่ร้าน" : "ส่งพัสดุ"}{" "}
              {formatThaiDate(entry.date)} · ผ่านมา {entry.days} วัน
            </li>
          ))}
        </ul>
      )}
      {allPastWindow && (
        <p className="ka-sf-warn">
          ผ่านมาเกิน {RETURN_DAYS} วันแล้ว พิจารณาตามนโยบายคืนสินค้าก่อนรับคืน
          (ระบบรู้เพียงวันส่งพัสดุ ไม่รู้วันที่พัสดุถึงมือลูกค้า)
        </p>
      )}

      {returns.returns.map((record) => (
        <div
          key={record.returnId}
          className="ka-sf-divider ka-sf-form" style={{ gap: 8 }}
        >
          <p className="m-0 font-semibold">
            รับคืนเมื่อ {formatThaiDate(record.createdAt)} ·{" "}
            {reasonLabels[record.reason]}
          </p>
          <ul className="ka-sf-sub m-0 grid list-none gap-1 p-0">
            {record.items.map((item, index) => (
              <li key={index}>
                {item.productName} × {item.quantity} ·{" "}
                {item.restocked ? "นำกลับเข้าสต็อกแล้ว" : "ไม่นำกลับเข้าสต็อก"}
              </li>
            ))}
          </ul>
          {record.note && (
            <p className="ka-sf-sub">
              หมายเหตุ: {record.note}
            </p>
          )}
          {record.refund ? (
            <RefundPanel
              title="การคืนเงินค่าสินค้าที่คืน"
              refund={record.refund}
              account={null}
              canEdit={canEdit}
              onChanged={onChanged}
            />
          ) : (
            <p className="ka-sf-sub">
              ไม่มียอดเงินที่ต้องคืน
            </p>
          )}
        </div>
      ))}

      {canEdit && orderStatus === "paid" && returnable.length > 0 && (
        <div className="ka-sf-divider ka-sf-form">
          <h3>บันทึกรับคืนสินค้า</h3>
          <p className="ka-sf-sub">
            สำหรับลูกค้าที่เลือกรับเงินคืน ร้านเป็นผู้จัดการส่งคืนเอง
            การส่งสินค้าใหม่แทนยังไม่รองรับในระบบ
          </p>
          {returnable.map((line) => {
            const entry = draft[line.saleOrderListId];
            return (
              <fieldset
                key={line.saleOrderListId}
                className="ka-sf-panel m-0 border-0"
              >
                <legend className="sr-only">{line.productName}</legend>
                <p className="font-semibold">{line.productName}</p>
                <p className="ka-sf-sub">
                  ได้รับแล้ว {line.deliveredQty} · คืนแล้ว {line.returnedQty} ·
                  คืนได้อีก {line.returnableQty} · ชิ้นละ {baht(line.unitPrice)}{" "}
                  บาท
                </p>
                <span className="ka-label">จำนวนที่รับคืน</span>
                <div className="ka-step ka-sf-stepper" role="group" aria-label={`จำนวนที่รับคืนของ ${line.productName}`}>
                  <button
                    type="button"
                    aria-label="ลดจำนวน"
                    disabled={pending || (entry?.quantity ?? 0) <= 0}
                    onClick={() => setQuantity(line, (entry?.quantity ?? 0) - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={line.returnableQty}
                    aria-label="จำนวนที่รับคืน"
                    value={entry?.quantity ?? 0}
                    disabled={pending}
                    onChange={(e) => setQuantity(line, Number(e.target.value))}
                  />
                  <button
                    type="button"
                    aria-label="เพิ่มจำนวน"
                    disabled={pending || (entry?.quantity ?? 0) >= line.returnableQty}
                    onClick={() => setQuantity(line, (entry?.quantity ?? 0) + 1)}
                  >
                    +
                  </button>
                </div>
                <label className="ka-sf-check">
                  <input
                    type="checkbox"
                    checked={entry?.restock ?? false}
                    disabled={pending}
                    onChange={(e) =>
                      setLine(line.saleOrderListId, {
                        restock: e.target.checked,
                      })
                    }
                  />
                  <span>นำกลับเข้าสต็อกพร้อมขาย (ไม่ใช่ของชำรุด)</span>
                </label>
              </fieldset>
            );
          })}
          <label className="ka-field">
            <span className="ka-label">เหตุผลที่รับคืน</span>
            <CustomSelect
              value={reason}
              onChange={(value) => setReason(value as StoreReturnReason)}
              options={[
                ...(Object.keys(reasonLabels) as StoreReturnReason[]).map((value) => ({ value, label: reasonLabels[value] })),
              ]}
              placeholder="เลือกเหตุผล"
              disabled={pending}
            />
          </label>
          <label className="ka-field">
            <span className="ka-label">หมายเหตุ (ไม่บังคับ)</span>
            <textarea
              value={note}
              disabled={pending}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="ka-textarea"
            />
          </label>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => setConfirming(true)}
            className="ka-btn ka-btn--primary self-start"
          >
            {pending
              ? "กำลังบันทึก..."
              : `บันทึกรับคืนและคืนเงิน ${baht(total)} บาท`}
          </button>
          {error && (
            <p role="alert" className="ka-sf-error">
              {error}
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirming}
        title="ยืนยันรับคืนสินค้าและคืนเงิน"
        message={`คืนเงิน ${baht(total)} บาทตามช่องทางที่ลูกค้าชำระ ถ้าชำระด้วยบัตรระบบจะเริ่มคืนเงินทันที ถ้าชำระด้วยพร้อมเพย์ต้องโอนคืนแล้วบันทึกหลักฐาน รายการนี้ย้อนกลับไม่ได้`}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
