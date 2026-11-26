"use client";
import { useId, useRef, useState } from "react";
import { useNow } from "@/hooks/useNow";
import StoreFulfillmentModel from "@/models/store-fulfillment";
import {
  CustomReturnReason,
  StoreReturnReason,
  StoreReturns,
} from "@/types/store-fulfillment";
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

// TASK-0217: a Custom order comes back only for these two reasons; the second
// is stored as 'wrong_item'.
const customReasonLabels: Record<CustomReturnReason, string> = {
  defective: "สินค้าชำรุด",
  not_as_approved: "ผลิตไม่ตรงแบบที่อนุมัติ",
};
const customStoredReasonLabels: Record<StoreReturnReason, string> = {
  ...reasonLabels,
  wrong_item: customReasonLabels.not_as_approved,
};

// The API stores a Custom return's note as its reason, then ": " and what
// staff typed. The reason is already the record's heading, so only the typed
// part is shown.
function customNote(reason: StoreReturnReason, note: string | null) {
  const label = customStoredReasonLabels[reason];
  if (!note || note === label) return null;
  return note.startsWith(`${label}: `) ? note.slice(label.length + 2) : note;
}

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
  const custom = returns.custom ?? null;
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
      {custom && (
        <p className="ka-sf-sub border-l-[3px] border-[var(--border-control)] pl-3">
          งานสั่งผลิตรับคืนได้เฉพาะสินค้าชำรุด หรือผลิตไม่ตรงแบบที่อนุมัติ
        </p>
      )}
      {!custom && allPastWindow && (
        <p className="ka-sf-warn">
          ผ่านมาเกิน {RETURN_DAYS} วันแล้ว พิจารณาตามนโยบายคืนสินค้าก่อนรับคืน
          (ระบบรู้เพียงวันส่งพัสดุ ไม่รู้วันที่พัสดุถึงมือลูกค้า)
        </p>
      )}

      {returns.returns.map((record) => {
        const note = custom
          ? customNote(record.reason, record.note)
          : record.note;
        return (
        <div
          key={record.returnId}
          className="ka-sf-divider ka-sf-form" style={{ gap: 8 }}
        >
          <p className="m-0 font-semibold">
            รับคืนเมื่อ {formatThaiDate(record.createdAt)} ·{" "}
            {(custom ? customStoredReasonLabels : reasonLabels)[record.reason]}
          </p>
          <ul className="ka-sf-sub m-0 grid list-none gap-1 p-0">
            {record.items.map((item, index) => (
              <li key={index}>
                {item.productName} × {item.quantity} ·{" "}
                {custom &&
                  `${record.goodsReturned ? "ได้รับของกลับแล้ว" : "ยังไม่ได้รับของกลับ"} · `}
                {item.restocked ? "นำกลับเข้าสต็อกแล้ว" : "ไม่นำกลับเข้าสต็อก"}
              </li>
            ))}
          </ul>
          {note && (
            <p className="ka-sf-sub">
              หมายเหตุ: {note}
            </p>
          )}
          {record.refund ? (
            <RefundPanel
              title={
                custom
                  ? "การคืนเงินงานสั่งผลิตที่รับคืน"
                  : "การคืนเงินค่าสินค้าที่คืน"
              }
              refund={record.refund}
              account={null}
              canEdit={canEdit}
              onChanged={onChanged}
              customOrder={!!custom}
            />
          ) : (
            <p className="ka-sf-sub">
              ไม่มียอดเงินที่ต้องคืน
            </p>
          )}
        </div>
        );
      })}

      {custom && canEdit && orderStatus === "paid" && custom.canReturn && (
        <CustomReturnForm
          storeOrderId={storeOrderId}
          refundAmount={custom.refundAmount}
          onChanged={onChanged}
        />
      )}

      {/* The API takes a Custom return only once every piece has shipped. */}
      {custom &&
        !custom.canReturn &&
        !custom.returned &&
        returns.returns.length === 0 &&
        received.length > 0 && (
          <p className="ka-sf-sub">
            รับคืนงานสั่งผลิตได้เมื่อจัดส่งครบทุกชิ้นแล้ว
          </p>
        )}

      {!custom && canEdit && orderStatus === "paid" && returnable.length > 0 && (
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

const ACCOUNT_FIELDS = [
  ["name", "ชื่อบัญชี", 120],
  ["bank", "ธนาคาร / พร้อมเพย์", 120],
  ["number", "เลขที่บัญชี", 40],
] as const;

/**
 * TASK-0217: a Custom order returned after delivery. The whole order comes
 * back, once; the API works out the refund (everything received) and the shop
 * transfers it, so the form asks only why, whether the goods are back, and
 * where the money goes if staff already know.
 */
function CustomReturnForm({
  storeOrderId,
  refundAmount,
  onChanged,
}: {
  storeOrderId: string;
  refundAmount: number;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState<CustomReturnReason | "">("");
  const [goodsReturned, setGoodsReturned] = useState(false);
  const [note, setNote] = useState("");
  const [account, setAccount] = useState({ name: "", bank: "", number: "" });
  // One reference per submission, so a repeat finds the same return.
  const [reference, setReference] = useState(() => crypto.randomUUID());
  // Judged only after a real attempt to save.
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // A second click lands before the disabled button is drawn.
  const sendingNow = useRef(false);
  const uid = useId();

  const stated = ACCOUNT_FIELDS.filter(([key]) => account[key].trim()).length;
  const reasonError = tried && !reason ? "กรุณาเลือกกรณีที่รับคืน" : "";
  // All three or none, as the API takes it.
  const accountError =
    tried && stated > 0 && stated < ACCOUNT_FIELDS.length
      ? "กรอกบัญชีรับเงินคืนให้ครบทั้งสามช่อง หรือเว้นว่างทั้งหมด"
      : "";

  function review() {
    setTried(true);
    if (!reason) {
      document.getElementById(`${uid}-defective`)?.focus();
      return;
    }
    if (stated > 0 && stated < ACCOUNT_FIELDS.length) {
      const [missing] =
        ACCOUNT_FIELDS.find(([key]) => !account[key].trim()) ?? [];
      document.getElementById(`${uid}-${missing}`)?.focus();
      return;
    }
    setConfirming(true);
  }

  async function submit() {
    if (!reason || sendingNow.current) return;
    sendingNow.current = true;
    setPending(true);
    setError("");
    try {
      await storeFulfillmentModel.createCustomReturn(storeOrderId, {
        return_reference: reference,
        reason,
        note: note.trim() || undefined,
        goods_returned: goodsReturned,
        ...(stated === ACCOUNT_FIELDS.length && {
          refund_account_name: account.name.trim(),
          refund_account_bank: account.bank.trim(),
          refund_account_number: account.number.trim(),
        }),
      });
      setReason("");
      setGoodsReturned(false);
      setNote("");
      setAccount({ name: "", bank: "", number: "" });
      setTried(false);
      setReference(crypto.randomUUID());
      onChanged();
    } catch (err) {
      // What was entered stays, so staff can correct it and try again.
      setError(getApiErrorMessage(err));
    } finally {
      sendingNow.current = false;
      setPending(false);
    }
  }

  return (
    <div className="ka-sf-divider ka-sf-form">
      <h3>บันทึกรับคืนงานสั่งผลิต</h3>
      <fieldset
        className="ka-field m-0 min-w-0 border-0 p-0"
        aria-describedby={reasonError ? `${uid}-reason-error` : undefined}
      >
        <legend className="ka-label mb-1.5 p-0">
          กรณีที่รับคืน
          <span className="ka-req" aria-hidden="true">
            *
          </span>
        </legend>
        {(Object.keys(customReasonLabels) as CustomReturnReason[]).map(
          (value) => (
            <label key={value} className="ka-sf-check">
              <input
                id={`${uid}-${value}`}
                type="radio"
                name={`${uid}-reason`}
                required
                checked={reason === value}
                disabled={pending}
                onChange={() => setReason(value)}
              />
              <span>{customReasonLabels[value]}</span>
            </label>
          ),
        )}
        {reasonError && (
          <p id={`${uid}-reason-error`} className="ka-error m-0">
            {reasonError}
          </p>
        )}
      </fieldset>
      <label className="ka-sf-check">
        <input
          type="checkbox"
          checked={goodsReturned}
          disabled={pending}
          onChange={(e) => setGoodsReturned(e.target.checked)}
        />
        <span>ได้รับของกลับมาแล้ว (บันทึกไว้เท่านั้น ระบบไม่เพิ่มสต็อก)</span>
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
      <p id={`${uid}-account-hint`} className="ka-sf-sub">
        บัญชีรับเงินคืนของลูกค้า (ไม่บังคับ:
        เว้นว่างได้ถ้าจะให้ลูกค้าแจ้งเองที่หน้าติดตามคำสั่งซื้อ)
      </p>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {ACCOUNT_FIELDS.map(([key, label, max]) => {
          const missing = !!accountError && !account[key].trim();
          return (
            <div key={key} className="ka-field">
              <label className="ka-label" htmlFor={`${uid}-${key}`}>
                {label}
              </label>
              <input
                id={`${uid}-${key}`}
                className="ka-input"
                maxLength={max}
                autoComplete="off"
                value={account[key]}
                disabled={pending}
                aria-invalid={missing || undefined}
                aria-describedby={
                  accountError ? `${uid}-account-error` : `${uid}-account-hint`
                }
                onChange={(e) =>
                  setAccount({ ...account, [key]: e.target.value })
                }
              />
            </div>
          );
        })}
      </div>
      {accountError && (
        <p id={`${uid}-account-error`} className="ka-error m-0">
          {accountError}
        </p>
      )}
      <div className="ka-sf-panel">
        <p className="text-xl font-semibold tabular-nums">
          คืนเงิน {baht(refundAmount)} บาท
        </p>
        <p className="ka-sf-sub">
          เต็มยอดที่รับชำระ รวมค่าส่ง ร้านโอนคืนเอง ระบบคำนวณให้ แก้ยอดไม่ได้
          รับคืนได้ครั้งเดียวต่อคำสั่งซื้อ
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={review}
        className="ka-btn ka-btn--primary self-start max-sm:min-h-11"
      >
        บันทึกรับคืน
      </button>
      {error && (
        <p role="alert" className="ka-sf-error">
          {error}
        </p>
      )}
      <ConfirmDialog
        isOpen={confirming}
        title="ยืนยันรับคืนงานสั่งผลิต"
        message={`คืนเงิน ${baht(refundAmount)} บาท ร้านเป็นผู้โอนคืนเองแล้วบันทึกหลักฐานการโอน รายการนี้ย้อนกลับไม่ได้ และรับคืนได้ครั้งเดียวต่อคำสั่งซื้อ`}
        confirmLabel="บันทึกรับคืน"
        cancelLabel="กลับไปตรวจ"
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
