"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { refreshStockPending } from "@/hooks/useStockPending";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatThaiDateTime } from "@/lib/date-format";
import StockModel, {
  ADJUSTMENT_REASONS,
  type ListMeta,
  type StockAdjustment,
  type StockKind,
} from "@/models/stock";
import { Icon, type IconName } from "./icons";
import { EmptyState, LoadFailed, LoadingRows } from './states';

const stockModel = new StockModel();
const PAGE_SIZE = 20;
const formatCount = (value: number) => value.toLocaleString("th-TH");
const signedQty = (row: StockAdjustment) =>
  `${row.direction === "increase" ? "+" : "−"}${formatCount(row.qty)}`;
const itemLabel = (row: StockAdjustment) =>
  [row.itemName, row.colorName, row.sizeName].filter(Boolean).join(" · ");

const STATUS: Record<
  StockAdjustment["status"],
  { label: string; tone: string; icon: IconName }
> = {
  pending: { label: "รออนุมัติ", tone: "wn", icon: "clock" },
  approved: { label: "อนุมัติแล้ว", tone: "ok", icon: "tick" },
  rejected: { label: "ปฏิเสธ", tone: "dnb", icon: "x" },
};

function ReviewModal({
  kind,
  row,
  onClose,
  onDone,
}: {
  kind: StockKind;
  row: StockAdjustment;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [why, setWhy] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function decide(action: "approve" | "reject") {
    setPending(true);
    setError("");
    try {
      if (action === "approve")
        await stockModel.approveAdjustment(kind, row.id);
      else await stockModel.rejectAdjustment(kind, row.id, why.trim());
      onDone(
        action === "approve"
          ? `อนุมัติ ${row.code} แล้ว`
          : `ปฏิเสธ ${row.code} แล้ว`,
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      className="ka-stock-modal"
      isOpen
      onClose={pending ? () => undefined : onClose}
      title="ตรวจคำขอปรับยอด"
      description={row.code}
      size="standard"
      footer={
        rejecting ? (
          <>
            <button
              type="button"
              className="ka-btn min-h-11"
              disabled={pending}
              onClick={() => setRejecting(false)}
            >
              กลับ
            </button>
            <button
              type="button"
              className="ka-btn ka-btn--danger min-h-11"
              disabled={pending || !why.trim()}
              onClick={() => void decide("reject")}
            >
              {pending ? "กำลังบันทึก..." : "ยืนยันปฏิเสธ"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="ka-btn dn min-h-11"
              disabled={pending}
              onClick={() => setRejecting(true)}
            >
              ปฏิเสธ
            </button>
            <button
              type="button"
              className="ka-btn ka-btn--primary min-h-11"
              disabled={pending}
              onClick={() => void decide("approve")}
            >
              {pending ? "กำลังบันทึก..." : "อนุมัติปรับยอด"}
            </button>
          </>
        )
      }
    >
      <div className="ka-stock-form">
        <dl className="adl">
          <div>
            <dt>รายการ</dt>
            <dd>{itemLabel(row)}</dd>
          </div>
          <div>
            <dt>จำนวน</dt>
            <dd className="num">
              <b>{signedQty(row)}</b>
            </dd>
          </div>
          <div>
            <dt>เหตุผล</dt>
            <dd>{ADJUSTMENT_REASONS[row.reason]}</dd>
          </div>
          <div>
            <dt>ผู้ขอ</dt>
            <dd>
              {row.requestedByName} · {formatThaiDateTime(row.requestedAt)}
            </dd>
          </div>
          <div>
            <dt>ล็อต</dt>
            <dd className="code">{row.lotLabel}</dd>
          </div>
          <div>
            <dt>รายละเอียด</dt>
            <dd>{row.detail || "-"}</dd>
          </div>
        </dl>
        <div className="pv">
          <div>
            <div className="cap">คงเหลือล็อตนี้ตอนนี้</div>
            <div className="pvn">{formatCount(row.remainBefore)}</div>
          </div>
          <Icon name="right" />
          <div>
            <div className="cap">หลังอนุมัติ</div>
            <div className="pvn">{formatCount(row.remainAfter)}</div>
          </div>
        </div>
        {rejecting && (
          <label className="afield">
            <span className="lbl">เหตุผลที่ปฏิเสธ (จำเป็น)</span>
            <textarea
              className="ka-textarea"
              rows={3}
              maxLength={500}
              value={why}
              disabled={pending}
              placeholder="บอกผู้ขอว่าต้องแก้อะไร"
              onChange={(event) => setWhy(event.target.value)}
            />
          </label>
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

export default function AdjustTab({
  kind,
  canEdit,
  reloadKey,
}: {
  kind: StockKind;
  canEdit: boolean;
  reloadKey: number;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StockAdjustment[]>();
  const [meta, setMeta] = useState<ListMeta>();
  const [counts, setCounts] = useState<{ pending: number; all: number }>();
  const [error, setError] = useState("");
  const [review, setReview] = useState<StockAdjustment>();

  const load = useCallback(async () => {
    setError("");
    try {
      const [list, pending, all] = await Promise.all([
        stockModel.listAdjustments(kind, {
          status: filter === "all" ? undefined : "pending",
          page,
          limit: PAGE_SIZE,
        }),
        stockModel.countAdjustments(kind, "pending"),
        stockModel.countAdjustments(kind),
      ]);
      setRows(list.data);
      setMeta(list.meta);
      setCounts({ pending, all });
    } catch (err) {
      setRows(undefined);
      setCounts(undefined);
      setError(getApiErrorMessage(err));
    }
  }, [kind, filter, page]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, reloadKey]);

  const pick = (next: "pending" | "all") => {
    setFilter(next);
    setPage(1);
  };

  return (
    <>
      <div className="fbar">
        <div className="seg" role="group" aria-label="สถานะการปรับยอด">
          <button
            type="button"
            className={filter === "pending" ? "on" : ""}
            aria-pressed={filter === "pending"}
            onClick={() => pick("pending")}
          >
            รออนุมัติ {counts ? formatCount(counts.pending) : ""}
          </button>
          <button
            type="button"
            className={filter === "all" ? "on" : ""}
            aria-pressed={filter === "all"}
            onClick={() => pick("all")}
          >
            ทั้งหมด {counts ? formatCount(counts.all) : ""}
          </button>
        </div>
        <p className="cap anote">ยอดในคลังเปลี่ยนเมื่ออนุมัติแล้วเท่านั้น</p>
      </div>

      {error ? (
        <LoadFailed title="โหลดคำขอปรับยอดไม่สำเร็จ" detail={error} onRetry={() => void load()} />
      ) : !rows ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="adj"
          title={filter === "pending" ? "ไม่มีรายการรออนุมัติ" : "ยังไม่มีคำขอปรับยอด"}
          lead="กดปรับยอดสต็อกเมื่อของเสียหาย สูญหาย หรือนับไม่ตรง"
        />
      ) : (
        <div>
          {rows.map((row) => {
            const status = STATUS[row.status];
            return (
              <div className="drow" key={row.id}>
                <span className={`ric ${status.tone}`}>
                  <Icon name={status.icon} />
                </span>
                <div className="grow">
                  <div className="dhead">
                    <span className="code">
                      <b>{row.code}</b>
                    </span>
                    <span className={`bd ${status.tone}`}>{status.label}</span>
                  </div>
                  <div className="hname">{itemLabel(row)}</div>
                </div>
                <div className="dmid">
                  <div
                    className={`qty ${row.direction === "increase" ? "plus" : "minus"}`}
                  >
                    {signedQty(row)}
                  </div>
                  <div className="cap">
                    {ADJUSTMENT_REASONS[row.reason]} · {row.requestedByName} ·{" "}
                    {formatThaiDateTime(row.requestedAt)}
                    {row.countCode ? ` · จากรอบนับ ${row.countCode}` : ""}
                  </div>
                </div>
                <div className="dact">
                  {row.status === "pending" ? (
                    canEdit ? (
                      <button
                        type="button"
                        className="ka-btn"
                        onClick={() => setReview(row)}
                      >
                        ตรวจและอนุมัติ
                      </button>
                    ) : (
                      <span className="cap">รออนุมัติ</span>
                    )
                  ) : (
                    <span className="cap">
                      {row.status === "rejected" && row.rejectReason
                        ? `${row.rejectReason} · `
                        : ""}
                      {row.decidedByName}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.last_page > 1 && !error && (
        <div className="pager">
          <button
            type="button"
            className="ka-btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ก่อนหน้า
          </button>
          <span className="cap">
            หน้า {page} จาก {meta.last_page}
          </span>
          <button
            type="button"
            className="ka-btn"
            disabled={page >= meta.last_page}
            onClick={() => setPage(page + 1)}
          >
            ถัดไป
          </button>
        </div>
      )}

      {review && (
        <ReviewModal
          kind={kind}
          row={review}
          onClose={() => {
            // Someone else may have decided it: the failed try is why the dialog is closing.
            setReview(undefined);
            void load();
          }}
          onDone={(message) => {
            setReview(undefined);
            toast({ message });
            refreshStockPending();
            void load();
          }}
        />
      )}
    </>
  );
}
