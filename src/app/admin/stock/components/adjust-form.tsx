"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CustomSelect from "@/components/CustomSelect";
import Modal from "@/components/Modal";
import { getApiErrorMessage } from "@/lib/api-error";
import StockModel, {
  ADJUSTMENT_REASONS,
  type AdjustmentDirection,
  type AdjustmentReason,
  type StockItem,
  type StockItemDetail,
  type StockKind,
  type StockLot,
} from "@/models/stock";
import { Icon } from "./icons";

const stockModel = new StockModel();
const MAX_QTY = 1000000;
const formatCount = (value: number) => value.toLocaleString("th-TH");
const formatMoney = (value: number) =>
  value.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const itemLabel = (
  item: Pick<StockItem, "name" | "code" | "colorName" | "sizeName">,
) =>
  [item.name, item.colorName, item.sizeName, item.code]
    .filter(Boolean)
    .join(" · ");

/**
 * An estimate for the form only: the server decides on the locked lot at approval.
 * An unreleased lot has nothing reserved against it, so all of it can go.
 */
const freeOf = (lot: StockLot) =>
  lot.released === false
    ? lot.remainQty
    : Math.max(0, lot.remainQty - lot.reservedQty);

export default function AdjustForm({
  kind,
  itemId,
  onClose,
  onSent,
}: {
  kind: StockKind;
  itemId?: string;
  onClose: () => void;
  onSent: (code: string) => void;
}) {
  const [options, setOptions] = useState<StockItem[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [selectedId, setSelectedId] = useState(itemId ?? "");
  const [item, setItem] = useState<StockItemDetail>();
  const [itemError, setItemError] = useState("");
  const [direction, setDirection] = useState<AdjustmentDirection>("decrease");
  const [lotId, setLotId] = useState("");
  const [qtyText, setQtyText] = useState("1");
  const [reason, setReason] = useState<AdjustmentReason>("damaged");
  const [detail, setDetail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(
    async (q?: string) => {
      setOptionsError("");
      try {
        const result = await stockModel.listItems(kind, {
          q,
          page: 1,
          limit: 50,
        });
        setOptions(result.data);
      } catch (err) {
        setOptionsError(getApiErrorMessage(err));
      }
    },
    [kind],
  );

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void search();
  }, [search]);

  const loadItem = useCallback(async () => {
    if (!selectedId) return;
    setItem(undefined);
    setItemError("");
    try {
      const detailRow = await stockModel.getItem(kind, selectedId);
      setItem(detailRow);
      setLotId(detailRow.lots[0]?.lotId ?? "");
    } catch (err) {
      setItemError(getApiErrorMessage(err));
    }
  }, [kind, selectedId]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItem();
  }, [loadItem]);

  const selectOptions = useMemo(() => {
    const list = options.map((option) => ({
      value: option.id,
      label: itemLabel(option),
    }));
    // A search can drop the chosen item from the list; its name must stay on the control.
    if (item && !options.some((option) => option.id === item.id)) {
      list.unshift({ value: item.id, label: itemLabel(item) });
    }
    return list;
  }, [options, item]);

  const lots = item?.lots ?? [];
  const lot = lots.find((row) => row.lotId === lotId);
  const noLots = item !== undefined && lots.length === 0;
  const free = lot ? freeOf(lot) : 0;
  const blocked = lot !== undefined && direction === "decrease" && free === 0;

  const qty = /^\d+$/.test(qtyText) ? Number(qtyText) : 0;
  const limit = direction === "decrease" ? Math.min(free, MAX_QTY) : MAX_QTY;
  const qtyError =
    !lot || blocked
      ? ""
      : qty < 1
        ? "จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1"
        : qty > limit
          ? `จำนวนต้องไม่เกิน ${formatCount(limit)}`
          : "";

  const needDetail = reason === "other";
  const canSend =
    !!lot &&
    !blocked &&
    !qtyError &&
    (!needDetail || !!detail.trim()) &&
    !pending;
  const delta = direction === "decrease" ? -qty : qty;
  const after = lot ? Math.max(0, lot.remainQty + delta) : 0;
  const peak = Math.max(lot?.remainQty ?? 0, after, 1);
  const dirty =
    (!itemId && !!selectedId) ||
    qtyText !== "1" ||
    !!detail ||
    direction !== "decrease" ||
    reason !== "damaged";

  const step = (by: number) =>
    setQtyText(String(Math.max(1, Math.min(limit || 1, qty + by))));

  async function send() {
    if (!lot) return;
    setPending(true);
    setError("");
    try {
      const trimmed = detail.trim();
      const created = await stockModel.createAdjustment(kind, {
        lotId: lot.lotId,
        direction,
        qty,
        reason,
        ...(trimmed ? { detail: trimmed } : {}),
      });
      onSent(created.code);
    } catch (err) {
      // What was typed stays, so a retry does not start over.
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      className="ka-stock-modal ka-stock-modal--form"
      isOpen
      onClose={pending ? () => undefined : onClose}
      title="ปรับยอดสต็อก"
      description="ส่งขออนุมัติก่อน ยอดจริงยังไม่เปลี่ยนจนกว่าจะอนุมัติ"
      size="standard"
      guardUnsaved
      dirty={dirty}
      footer={
        <>
          <button
            type="button"
            className="ka-btn min-h-11"
            disabled={pending}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="ka-btn ka-btn--primary min-h-11"
            disabled={!canSend}
            onClick={() => void send()}
          >
            {pending ? "กำลังส่ง..." : "ส่งขออนุมัติ"}
          </button>
        </>
      }
    >
      <div className="ka-stock-form">
        <div className="afield">
          <span className="lbl">รายการ</span>
          <CustomSelect
            aria-label="เลือกรายการ"
            options={selectOptions}
            value={selectedId}
            disabled={pending}
            placeholder="เลือกรายการ"
            fetchData={(query) => void search(query)}
            onChange={setSelectedId}
          />
          {optionsError && (
            <p role="alert" className="field-error">
              โหลดรายการไม่สำเร็จ: {optionsError}{" "}
              <button
                type="button"
                className="ka-btn ka-btn--ghost"
                onClick={() => void search()}
              >
                ลองใหม่
              </button>
            </p>
          )}
        </div>

        {itemError && (
          <div role="alert" className="field-error">
            โหลดล็อตไม่สำเร็จ: {itemError}{" "}
            <button
              type="button"
              className="ka-btn ka-btn--ghost"
              onClick={() => void loadItem()}
            >
              ลองใหม่
            </button>
          </div>
        )}
        {selectedId && !item && !itemError && (
          <p className="cap" role="status">
            กำลังโหลดล็อต...
          </p>
        )}

        {noLots && (
          <div className="ban wn" role="alert">
            <Icon name="warn" />
            <span>
              รายการนี้ไม่มีล็อตในคลัง จึงปรับยอดไม่ได้
              ยอดใหม่ต้องเข้าผ่านใบรับสินค้าหรืองานผลิต
            </span>
          </div>
        )}

        {item && !noLots && (
          <>
            <div className="afield">
              <span className="lbl">ชนิดการปรับ</span>
              <div className="seg2">
                {(["decrease", "increase"] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={`opt${direction === value ? " on" : ""}`}
                    aria-pressed={direction === value}
                    disabled={pending}
                    onClick={() => setDirection(value)}
                  >
                    <span className="rd" />
                    <Icon name={value === "decrease" ? "minus" : "plus"} />
                    {value === "decrease" ? "ลดยอด" : "เพิ่มยอด"}
                  </button>
                ))}
              </div>
            </div>

            <div className="afield">
              <span className="lbl">ล็อต</span>
              <div className="opts">
                {lots.map((row) => (
                  <button
                    type="button"
                    key={row.lotId}
                    className={`opt${row.lotId === lotId ? " on" : ""}`}
                    aria-pressed={row.lotId === lotId}
                    disabled={pending}
                    onClick={() => setLotId(row.lotId)}
                  >
                    <span className="rd" />
                    <span className="grow">
                      <span className="code">
                        {row.sourceCode ?? row.sourceLabel}
                      </span>
                      <span className="cap num">
                        คงเหลือ {formatCount(row.remainQty)} · จอง{" "}
                        {formatCount(row.reservedQty)} · ลดได้{" "}
                        {formatCount(freeOf(row))}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="thr-row">
              <label className="lbl" htmlFor="adj-qty">
                จำนวน{item.unitName ? ` (${item.unitName})` : ""}
              </label>
              <div className="step" role="group" aria-label="จำนวนที่ปรับ">
                <button
                  type="button"
                  aria-label="ลดจำนวน"
                  disabled={pending}
                  onClick={() => step(-1)}
                >
                  <Icon name="minus" />
                </button>
                <input
                  id="adj-qty"
                  inputMode="numeric"
                  autoComplete="off"
                  value={qtyText}
                  disabled={pending}
                  aria-invalid={!!qtyError}
                  onChange={(event) => setQtyText(event.target.value.trim())}
                />
                <button
                  type="button"
                  aria-label="เพิ่มจำนวน"
                  disabled={pending}
                  onClick={() => step(1)}
                >
                  <Icon name="plus" />
                </button>
              </div>
            </div>
            {qtyError && (
              <p role="alert" className="field-error">
                {qtyError}
              </p>
            )}

            {blocked && (
              <div className="ban wn" role="alert">
                <Icon name="warn" />
                <span>
                  ล็อตนี้ถูกจองหมดแล้ว ลดยอดไม่ได้ เลือกล็อตอื่น
                  หรือคืนยอดจองจากเอกสารที่จองอยู่ก่อน
                </span>
              </div>
            )}

            <div className="afield">
              <span className="lbl">เหตุผล</span>
              <div className="rs">
                {(Object.keys(ADJUSTMENT_REASONS) as AdjustmentReason[]).map(
                  (key) => (
                    <button
                      type="button"
                      key={key}
                      className={`rc${reason === key ? " on" : ""}`}
                      aria-pressed={reason === key}
                      disabled={pending}
                      onClick={() => setReason(key)}
                    >
                      {ADJUSTMENT_REASONS[key]}
                    </button>
                  ),
                )}
              </div>
            </div>

            <label className="afield">
              <span className="lbl">
                รายละเอียด{needDetail ? " (จำเป็น)" : " (ถ้ามี)"}
              </span>
              <textarea
                className="ka-textarea"
                rows={3}
                maxLength={500}
                value={detail}
                disabled={pending}
                placeholder="เช่น แก้วบุบจากการขนย้าย"
                onChange={(event) => setDetail(event.target.value)}
              />
            </label>

            {lot && (
              <>
                <div className="pv" aria-label="ผลหลังอนุมัติ">
                  <div>
                    <div className="cap">คงเหลือล็อตนี้ตอนนี้</div>
                    <div className="pvn">{formatCount(lot.remainQty)}</div>
                    <div className="pb">
                      <i
                        style={{ transform: `scaleX(${lot.remainQty / peak})` }}
                      />
                    </div>
                  </div>
                  <Icon name="right" />
                  <div>
                    <div className="cap">หลังอนุมัติ</div>
                    <div className="pvn">{formatCount(after)}</div>
                    <div className="pb new">
                      <i style={{ transform: `scaleX(${after / peak})` }} />
                    </div>
                  </div>
                </div>
                <p className="cap num">
                  {/* The lot API answers 0 for a lot with no cost, so 0 cannot be shown as a value. */}
                  {lot.unitCost > 0
                    ? `ผลต่อมูลค่า ${delta < 0 ? "−" : "+"}฿${formatMoney(Math.abs(delta) * lot.unitCost)} ตามต้นทุนของล็อตนี้`
                    : "ผลต่อมูลค่า: ไม่มีต้นทุน"}
                </p>
              </>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
