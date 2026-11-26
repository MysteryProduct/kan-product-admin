"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import axios from "@/lib/axios";
import { refreshPendingWork } from "@/hooks/usePendingWork";
import { usePermissions } from "@/hooks/usePermissions";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatThaiDate, todayLocalIso } from "@/lib/date-format";
import ConfirmDialog from "@/components/ConfirmDialog";
import StatusBadge from "@/components/StatusBadge";
import type {
  CustomCancellation as Cancellation,
  CustomCancellationView,
  RequestCustomCancellationDto,
} from "@/types/custom-cancellation";

type Loaded = {
  // The request's CU code and the job it has now, from the sale order.
  code: string;
  jobOrderId: string | null;
  view: CustomCancellationView;
};
type Action = "" | "request" | "approve" | "reject" | "refund";

const baht = (value: number) =>
  value.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const REQUESTED_BY: Record<Cancellation["requestedBy"], string> = {
  employee: "ลูกค้า (พนักงานบันทึกแทน)",
  customer: "ลูกค้า",
  guest: "ลูกค้า (ไม่ได้เข้าสู่ระบบ)",
};

// How the API's refusal starts when the job's stage is not the one approved on.
const STAGE_CHANGED = "สถานะงานผลิตเปลี่ยนไปแล้ว";

const BTN = "ka-btn max-sm:min-h-11";
const MUTED = "text-sm text-[var(--ink-muted)]";
const PANEL = "space-y-2 rounded-xl bg-[var(--bg-subtle)] px-3.5 py-3";
const AMOUNT = "text-xl font-semibold tabular-nums";

/**
 * TASK-0217: cancelling a Custom request from its sale order. Staff file the
 * request a customer made on LINE, decide it, and record the transfer the
 * shop then makes. Every figure comes from the API; nothing here sends one.
 */
export default function CustomCancellation({
  orderId,
  onSuccess,
}: {
  orderId: string;
  onSuccess?: () => void;
}) {
  const { can } = usePermissions();
  // Reading a cancellation shows the customer's bank account, so the API
  // gives it only to someone who may cancel a sale order (owner decision D7):
  // without that permission nothing is asked for and nothing is drawn.
  const canView = can("sale_orders", "reject");
  const canRefund = canView && can("payment_receipts", "add");
  const canSeeReceipts = can("payment_receipts", "view");
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [account, setAccount] = useState({ name: "", bank: "", number: "" });
  const [note, setNote] = useState("");
  const [transfer, setTransfer] = useState(() => ({
    reference: "",
    date: todayLocalIso(),
  }));
  // Fields are judged only after a real attempt to save them.
  const [tried, setTried] = useState<"" | "request" | "refund">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Action>("");
  const [confirming, setConfirming] = useState(false);
  // A second click lands before the disabled button is drawn.
  const busyNow = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // After a saved action its controls are gone; focus moves to the heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const uid = useId();

  useEffect(() => {
    if (!canView) return;
    let active = true;
    const load = async () => {
      try {
        const info = await axios.get<{
          customRequestId?: string;
          code: string;
          jobOrderId: string | null;
        }>(`/sale-order/${orderId}/custom`);
        const { customRequestId, code, jobOrderId } = info.data;
        if (!customRequestId) throw new Error("ไม่พบรหัสคำขอ Custom ของใบขายนี้");
        const view = await axios.get<CustomCancellationView>(
          `/custom-cancellation/requests/${customRequestId}`,
        );
        if (!active) return;
        setData({ code, jobOrderId, view: view.data });
        setLoadError("");
      } catch (e) {
        if (active) setLoadError(getApiErrorMessage(e));
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [orderId, canView, reload]);

  // Closing the form hands focus back to the button that opened it.
  useEffect(() => {
    if (wasOpen.current && !formOpen) openButton.current?.focus();
    wasOpen.current = formOpen;
  }, [formOpen]);

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [data]);

  async function run(kind: Exclude<Action, "">, action: () => Promise<unknown>) {
    if (busyNow.current) return;
    busyNow.current = true;
    setBusy(kind);
    setError("");
    try {
      await action();
      setTried("");
      if (kind === "request") {
        setFormOpen(false);
        setReason("");
        setAccount({ name: "", bank: "", number: "" });
      }
      if (kind === "approve" || kind === "reject") setNote("");
      if (kind === "refund") setTransfer({ reference: "", date: todayLocalIso() });
      // The request's state, the sale order's status and the work counts moved.
      focusHeading.current = true;
      setReload((n) => n + 1);
      refreshPendingWork();
      onSuccess?.();
    } catch (e) {
      // What was typed stays, so it can be corrected and sent again.
      const message = getApiErrorMessage(e);
      setError(message);
      // Production moved on between the dialog and the approval: the figure
      // shown is stale, so the card is read again and must be confirmed again.
      if (message.includes(STAGE_CHANGED)) setReload((n) => n + 1);
    } finally {
      busyNow.current = false;
      setBusy("");
    }
  }

  if (!canView) return null;

  const view = data?.view;
  const current = view?.current ?? null;
  const latest = view?.history[0] ?? null;
  const preview = view?.preview;
  const paid = preview?.paidAmount ?? 0;
  const refundNow = preview?.refundAmount ?? 0;
  const started = preview?.productionStage === "in_progress";
  const needAccount = paid > 0;
  const pending = busy !== "";

  // Nothing to say about a sale order cancelled some other way.
  if (view && !current && !latest && preview?.blocked === "cancelled")
    return null;

  const requestErrors = {
    reason: reason.trim() ? "" : "กรุณากรอกเหตุผลที่ลูกค้าขอยกเลิก",
    name: !needAccount || account.name.trim() ? "" : "กรุณากรอกชื่อบัญชี",
    bank:
      !needAccount || account.bank.trim() ? "" : "กรุณากรอกธนาคาร / พร้อมเพย์",
    number:
      !needAccount || account.number.trim() ? "" : "กรุณากรอกเลขที่บัญชี",
  };
  const refundErrors = {
    reference: transfer.reference.trim()
      ? ""
      : "กรุณากรอกเลขอ้างอิงการโอนจากสลิป",
    date: transfer.date ? "" : "กรุณาเลือกวันที่โอน",
  };
  const shown = <T extends Record<string, string>>(
    form: "request" | "refund",
    errors: T,
  ): T =>
    tried === form
      ? errors
      : (Object.fromEntries(Object.keys(errors).map((k) => [k, ""])) as T);
  const requestShown = shown("request", requestErrors);
  const refundShown = shown("refund", refundErrors);

  function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!view) return;
    setTried("request");
    const first = (
      ["reason", "name", "bank", "number"] as const
    ).find((key) => requestErrors[key]);
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    const body: RequestCustomCancellationDto = { reason: reason.trim() };
    if (needAccount) {
      body.refund_account_name = account.name.trim();
      body.refund_account_bank = account.bank.trim();
      body.refund_account_number = account.number.trim();
    }
    void run("request", () =>
      axios.post(`/custom-cancellation/requests/${view.customRequestId}`, body),
    );
  }

  function decide(decision: "approve" | "reject") {
    if (!current) return;
    void run(decision, () =>
      axios.post(`/custom-cancellation/${current.id}/decision`, {
        decision,
        note: note.trim() || undefined,
        // The stage the dialog's figure was worked out from; the API refuses
        // the approval if the job has moved on since. Never an amount.
        ...(decision === "approve" &&
          preview?.productionStage && {
            expected_stage: preview.productionStage,
          }),
      }),
    );
  }

  function submitRefund(event: React.FormEvent) {
    event.preventDefault();
    if (!current) return;
    setTried("refund");
    const first = (["reference", "date"] as const).find(
      (key) => refundErrors[key],
    );
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    void run("refund", () =>
      axios.post(`/custom-cancellation/${current.id}/refund`, {
        // The bank's own reference: a repeat with it records nothing twice.
        reference: transfer.reference.trim(),
        transferred_at: new Date(transfer.date).toISOString(),
      }),
    );
  }

  const field = (
    key: string,
    label: string,
    message: string,
    control: (props: {
      id: string;
      "aria-invalid": true | undefined;
      "aria-describedby": string | undefined;
    }) => React.ReactNode,
    required = true,
  ) => (
    <div className="ka-field" data-invalid={message ? "" : undefined}>
      <label className="ka-label" htmlFor={`${uid}-${key}`}>
        {label}
        {required && (
          <span className="ka-req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control({
        id: `${uid}-${key}`,
        "aria-invalid": message ? true : undefined,
        "aria-describedby": message ? `${uid}-${key}-error` : undefined,
      })}
      {message && (
        <p id={`${uid}-${key}-error`} className="ka-error m-0">
          {message}
        </p>
      )}
    </div>
  );

  const accountText = (a: NonNullable<Cancellation["refundAccount"]>) =>
    [a.name, a.bank, a.number].filter(Boolean).join(" · ");

  const openForm = (
    <div className="flex flex-wrap gap-2">
      <button
        ref={openButton}
        type="button"
        className={BTN}
        onClick={() => {
          setError("");
          setFormOpen(true);
        }}
      >
        บันทึกคำขอยกเลิกแทนลูกค้า
      </button>
    </div>
  );
  const actionError = error && (
    <p role="alert" className="whitespace-pre-line text-[var(--danger)]">
      {error}
    </p>
  );
  const produced = (
    <>
      <p>งานนี้ผลิตเสร็จแล้ว ยกเลิกไม่ได้</p>
      <p className={MUTED}>
        หลังจัดส่ง รับคืนได้เฉพาะสินค้าชำรุดหรือผลิตไม่ตรงแบบ
        ที่หน้าจัดส่งพัสดุ
      </p>
    </>
  );

  const headingId = `${uid}-heading`;
  const heading = (title: string, badges?: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-2">
      <h3
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="text-base font-semibold outline-none"
      >
        {title}
      </h3>
      {badges}
    </div>
  );

  let body: React.ReactNode = null;
  if (!view) {
    body = (
      <>
        {heading("การยกเลิกคำขอ")}
        {!loadError && <p role="status">กำลังโหลดข้อมูลการยกเลิก…</p>}
      </>
    );
  } else if (current?.status === "pending") {
    // ก3: decide the request. Approval is impossible once the goods are made.
    const blocked = preview?.blocked ?? null;
    body = (
      <>
        {heading(
          "การยกเลิกคำขอ",
          <StatusBadge tone="warning">รอพิจารณา</StatusBadge>,
        )}
        <dl className="m-0 grid gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <div>
            <dt className="text-[13px] text-[var(--ink-muted)]">ผู้ขอ</dt>
            <dd className="m-0 break-words">
              {REQUESTED_BY[current.requestedBy] ?? "ลูกค้า"} ·{" "}
              {formatThaiDate(current.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-[var(--ink-muted)]">เหตุผล</dt>
            <dd className="m-0 whitespace-pre-line break-words">
              {current.reason}
            </dd>
          </div>
          {current.refundAccount && (
            <div>
              <dt className="text-[13px] text-[var(--ink-muted)]">
                บัญชีรับเงินคืน
              </dt>
              <dd className="m-0 break-words tabular-nums">
                {accountText(current.refundAccount)}
              </dd>
            </div>
          )}
        </dl>
        {blocked ? (
          <p>
            {blocked === "produced"
              ? "งานนี้ผลิตเสร็จแล้ว"
              : "ใบสั่งขายนี้ถูกยกเลิกแล้ว"}{" "}
            อนุมัติยกเลิกไม่ได้ ปฏิเสธคำขอได้อย่างเดียว
          </p>
        ) : (
          <div className={PANEL}>
            <p>
              ถ้าอนุมัติตอนนี้: งานผลิต{" "}
              <strong>{started ? "เริ่มผลิตแล้ว" : "ยังไม่เริ่มผลิต"}</strong>{" "}
              {paid > 0
                ? `${started ? "คืน 50% ของยอดที่รับชำระ" : "คืนเต็มจำนวนที่รับชำระ"} ${baht(paid)} บาท`
                : "ยังไม่ได้รับชำระ"}
            </p>
            <p className={AMOUNT}>
              {refundNow > 0
                ? `ยอดที่ต้องโอนคืน ${baht(refundNow)} บาท`
                : "ไม่มียอดที่ต้องคืน"}
            </p>
            <p className={MUTED}>
              ระบบคำนวณจากใบเสร็จและสถานะงานผลิต ณ เวลาที่กดอนุมัติ
              แก้ยอดเองไม่ได้
            </p>
          </div>
        )}
            <div className="ka-field">
              <label className="ka-label" htmlFor={`${uid}-note`}>
                หมายเหตุถึงลูกค้า (ไม่บังคับ)
              </label>
              <textarea
                id={`${uid}-note`}
                className="ka-textarea"
                rows={2}
                maxLength={500}
                value={note}
                disabled={pending}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {!blocked && (
                <button
                  type="button"
                  className={`${BTN} ka-btn--danger`}
                  disabled={pending}
                  aria-busy={busy === "approve" || undefined}
                  onClick={() => setConfirming(true)}
                >
                  อนุมัติยกเลิก
                </button>
              )}
              <button
                type="button"
                className={BTN}
                disabled={pending}
                aria-busy={busy === "reject" || undefined}
                onClick={() => decide("reject")}
              >
                ปฏิเสธคำขอ
              </button>
            </div>
            {actionError}
      </>
    );
  } else if (current?.status === "approved") {
    const amount = current.refundAmount ?? 0;
    const jobOpen =
      current.productionStage === "in_progress" && !!current.jobOrderId;
    body = (
      <>
        {heading(
          "การยกเลิกคำขอ",
          <>
            <StatusBadge tone="danger">ยกเลิกแล้ว</StatusBadge>
            {current.refundDue && (
              <StatusBadge tone="warning">รอโอนคืน</StatusBadge>
            )}
            {current.refund && (
              <StatusBadge tone="success">โอนคืนแล้ว</StatusBadge>
            )}
          </>,
        )}
        {current.refundDue ? (
          // ก5: the transfer is still owed.
          <>
            <p className={AMOUNT}>โอนคืน {baht(amount)} บาท</p>
            <p className="break-words tabular-nums">
              {current.refundAccount
                ? `เข้าบัญชี ${accountText(current.refundAccount)}`
                : "คำขอนี้ไม่มีบัญชีรับเงินคืน"}
            </p>
            {jobOpen && (
              <p className="text-sm text-[var(--warning)]">
                งานผลิต {current.jobOrderCode ?? ""} ยังเปิดอยู่{" "}
                <Link
                  className="underline"
                  href={`/admin/job-orders?jobId=${encodeURIComponent(current.jobOrderId ?? "")}`}
                >
                  ไปปิดงานหรือยกเลิกที่หน้างานผลิต
                </Link>
              </p>
            )}
            {canRefund ? (
              <form
                className="space-y-4 border-t border-[var(--border)] pt-4"
                noValidate
                onSubmit={submitRefund}
              >
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                  {field(
                    "reference",
                    "เลขอ้างอิงการโอน",
                    refundShown.reference,
                    (props) => (
                      <input
                        {...props}
                        className="ka-input"
                        placeholder="เลขอ้างอิงจากสลิป"
                        maxLength={120}
                        autoComplete="off"
                        required
                        value={transfer.reference}
                        disabled={pending}
                        onChange={(e) =>
                          setTransfer({ ...transfer, reference: e.target.value })
                        }
                      />
                    ),
                  )}
                  {field("date", "วันที่โอน", refundShown.date, (props) => (
                    <input
                      {...props}
                      className="ka-input"
                      type="date"
                      // The API takes a day from the approval up to today.
                      max={todayLocalIso()}
                      required
                      value={transfer.date}
                      disabled={pending}
                      onChange={(e) =>
                        setTransfer({ ...transfer, date: e.target.value })
                      }
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className={`${BTN} ka-btn--primary`}
                    disabled={pending}
                    aria-busy={busy === "refund" || undefined}
                  >
                    บันทึกการโอนคืน {baht(amount)} บาท
                  </button>
                </div>
                {actionError}
                <p className={MUTED}>
                  บันทึกแล้วระบบออกใบเสร็จคืนเงิน (ยอดติดลบ) ให้ใบขายนี้
                  บันทึกซ้ำด้วยเลขอ้างอิงเดิมไม่ออกใบซ้ำ
                </p>
              </form>
            ) : (
              <p className={MUTED}>
                ต้องมีสิทธิ์ยกเลิกในเมนูใบสั่งขาย
                และสิทธิ์เพิ่มในเมนูใบเสร็จรับเงิน จึงจะบันทึกการโอนคืนได้
              </p>
            )}
          </>
        ) : current.refund ? (
          // ก6: the money went back.
          <p className="break-words">
            โอนคืน {baht(amount)} บาท เมื่อ{" "}
            {formatThaiDate(current.refund.transferredAt)} · อ้างอิง{" "}
            {current.refund.reference}
            {canSeeReceipts && (
              <>
                {" · "}
                <Link className="underline" href="/admin/payment-receipts">
                  ดูใบเสร็จคืนเงิน
                </Link>
              </>
            )}
          </p>
        ) : (
          <p>ไม่มียอดที่ต้องคืน</p>
        )}
      </>
    );
  } else if (formOpen && view.canRequest) {
    // ก2: the customer asked on LINE; staff file it for them.
    body = (
      <form className="space-y-4" noValidate onSubmit={submitRequest}>
        {heading("บันทึกคำขอยกเลิกแทนลูกค้า")}
        {field(
          "reason",
          "เหตุผลที่ลูกค้าขอยกเลิก",
          requestShown.reason,
          (props) => (
            <textarea
              {...props}
              className="ka-textarea"
              rows={3}
              maxLength={500}
              required
              autoFocus
              value={reason}
              disabled={pending}
              onChange={(e) => setReason(e.target.value)}
            />
          ),
        )}
        {needAccount && (
          <>
            <p className={MUTED}>
              บัญชีรับเงินคืนของลูกค้า (ต้องระบุเมื่อรับชำระแล้ว)
            </p>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
              {(
                [
                  ["name", "ชื่อบัญชี", 120],
                  ["bank", "ธนาคาร / พร้อมเพย์", 120],
                  ["number", "เลขที่บัญชี", 40],
                ] as const
              ).map(([key, label, max]) => (
                <div key={key} className="min-w-0">
                  {field(key, label, requestShown[key], (props) => (
                    <input
                      {...props}
                      className="ka-input"
                      maxLength={max}
                      autoComplete="off"
                      required
                      value={account[key]}
                      disabled={pending}
                      onChange={(e) =>
                        setAccount({ ...account, [key]: e.target.value })
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className={`${BTN} ka-btn--primary`}
            disabled={pending}
            aria-busy={busy === "request" || undefined}
          >
            บันทึกคำขอยกเลิก
          </button>
          <button
            type="button"
            className={BTN}
            disabled={pending}
            onClick={() => {
              setFormOpen(false);
              setTried("");
              setError("");
            }}
          >
            ไม่บันทึก
          </button>
        </div>
        {actionError}
        <p className={MUTED}>
          บันทึกแล้วคำขอยังไม่ถูกยกเลิก ต้องอนุมัติในขั้นถัดไป ระหว่างรอ
          ระบบไม่ให้รับชำระ สร้างงานผลิต หรือส่งเข้าหน้าจัดส่ง
        </p>
      </form>
    );
  } else if (latest?.status === "rejected") {
    // ก6: the last request was turned down; another may be filed.
    body = (
      <>
        {heading(
          "การยกเลิกคำขอ",
          <StatusBadge>ปฏิเสธคำขอแล้ว</StatusBadge>,
        )}
        <p className="break-words">
          ปฏิเสธเมื่อ{" "}
          {latest.decidedAt ? formatThaiDate(latest.decidedAt) : "-"}
          {latest.decisionNote ? ` · หมายเหตุ: ${latest.decisionNote}` : ""}
        </p>
        {preview?.blocked === "produced" && produced}
        {view.canRequest && openForm}
      </>
    );
  } else if (view.canRequest) {
    // ก1: nothing asked yet; what cancelling now would return.
    body = (
      <>
        {heading("การยกเลิกคำขอ")}
        {paid > 0 ? (
          <p>
            ยกเลิกตอนนี้ร้านคืนเงิน <strong>{baht(refundNow)} บาท</strong> (
            {started
              ? `50% ของยอดที่รับชำระ ${baht(paid)} บาท เพราะเริ่มผลิตแล้ว`
              : "เต็มจำนวนที่รับชำระ เพราะยังไม่เริ่มผลิต"}
            )
          </p>
        ) : (
          <p>ยังไม่ได้รับชำระ ยกเลิกตอนนี้ไม่มียอดที่ต้องคืน</p>
        )}
        <p className={MUTED}>
          เริ่มผลิตแล้วคืน 50% ของยอดที่รับชำระ ผลิตเสร็จแล้วยกเลิกไม่ได้
        </p>
        {openForm}
      </>
    );
  } else {
    body = (
      <>
        {heading("การยกเลิกคำขอ")}
        {produced}
      </>
    );
  }

  // ก4: what approving does, by where production stands right now.
  const confirmAmount = refundNow;
  return (
    <section
      className="relative space-y-4 border-t border-[var(--border)] pt-5"
      aria-labelledby={headingId}
    >
      {body}
      {loadError && (
        <div role="alert" className="space-y-2">
          <p className="text-[var(--danger)]">{loadError}</p>
          <button
            type="button"
            className={BTN}
            onClick={() => {
              setLoadError("");
              setReload((n) => n + 1);
            }}
          >
            โหลดใหม่
          </button>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirming}
        title={`ยืนยันอนุมัติยกเลิกคำขอ ${data?.code ?? ""}`}
        message="ใบสั่งขายและคำขอถูกยกเลิกทันที ย้อนกลับไม่ได้"
        confirmLabel="อนุมัติยกเลิก"
        cancelLabel="กลับไปตรวจ"
        onConfirm={() => decide("approve")}
        onCancel={() => setConfirming(false)}
      >
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {started ? (
            <li>
              งานผลิตเริ่มผลิตแล้ว ระบบไม่ยกเลิกงานและไม่คืนวัตถุดิบให้เอง
              ต้องปิดงานหรือยกเลิกที่หน้างานผลิต
            </li>
          ) : (
            data?.jobOrderId && (
              <li>งานผลิตถูกยกเลิกและคืนยอดจองวัตถุดิบ</li>
            )
          )}
          <li>
            {confirmAmount > 0
              ? `ร้านต้องโอนคืน ${baht(confirmAmount)} บาท${started ? " (50% ของยอดที่รับชำระ)" : " (เต็มจำนวนที่รับชำระ)"} แล้วกลับมาบันทึกการโอน`
              : "ไม่มียอดที่ต้องคืน"}
          </li>
        </ul>
      </ConfirmDialog>
    </section>
  );
}
