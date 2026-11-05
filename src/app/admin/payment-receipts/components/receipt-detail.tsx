"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DocumentHistoryPanel from "@/components/document-history/DocumentHistoryPanel";
import DocumentCode from "@/components/DocumentCode";
import { loadErrorText } from "@/components/LoadErrorBanner";
import { useToast } from "@/components/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { formatThaiDate } from "@/lib/date-format";
import { usePageCrumb } from "@/lib/page-crumb";
import PaymentReceiptModel from "@/models/payment-receipt";
import type { PaymentReceipt } from "@/types/payment-receipt";
import type { SaleOrder } from "@/types/sale-order";
import {
  formatBaht,
  paymentState,
  payable,
} from "@/app/admin/sale-orders/lib/so-display";
import { loadOrder } from "../hooks/useReceiptForm";
import {
  accountText,
  BASE,
  canDeleteReceipt,
  canEditReceipt,
  customerOf,
  pageLockNote,
  methodView,
  orderOf,
  ORDERS,
  netAfter,
  receiptKind,
  receiptStatus,
  signedBaht,
  storeMethod,
  sumMoney,
  typeText,
  typeWithShare,
} from "../lib/receipt-display";
import {
  ReceiptMenu,
  useReceiptDelete,
  type MenuEntry,
} from "./receipt-actions";
import ReceiptPrint from "./receipt-print";
import { Badge, Icon, SectionError } from "./receipt-ui";

const receiptModel = new PaymentReceiptModel();

interface ReceiptDetailProps {
  receipt: PaymentReceipt;
  /** `?print=1`: open the print window once everything on the sheet has loaded. */
  autoPrint: boolean;
}

function Hero({ receipt }: { receipt: PaymentReceipt }) {
  const kind = receiptKind(receipt);
  const amount = Number(receipt.amount_paid);
  const date = formatThaiDate(receipt.payment_date);
  const view = methodView(receipt);
  const time = new Date(receipt.payment_date).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const heading =
    kind === "refund"
      ? "คืนเงินให้ลูกค้าแล้ว"
      : kind === "store"
        ? "ลูกค้าชำระผ่านหน้าร้าน"
        : "รับชำระเรียบร้อย";
  const line =
    kind === "refund"
      ? [receipt.payment_receipt_remark, date].filter(Boolean).join(" · ")
      : kind === "store"
        ? `${typeText(receipt)} · ${storeMethod(receipt)} · ${date} ${time}`
        : `${typeText(receipt)} · ${view.main} · ${date}`;
  return (
    <section
      className="ka-pr-hero"
      data-kind={kind}
      aria-label={kind === "refund" ? "ยอดคืนเงิน" : "ยอดรับชำระ"}
    >
      <span
        className="ka-pr-tone ka-pr-ring"
        data-tone={
          kind === "refund" ? "neutral" : kind === "store" ? "brand" : "success"
        }
      >
        {kind === "refund" ? (
          <Icon name="refund" size={26} />
        ) : kind === "store" ? (
          <Icon name="store" size={26} />
        ) : (
          <Icon name="check" size={28} width={2.5} draw />
        )}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="ka-pr-hero__t">{heading}</div>
        <div className="ka-pr-cap ka-pr-cap--14">{line}</div>
      </div>
      <div className="ka-pr-hero__amt ka-pr-r">
        <div className="ka-pr-cap ka-pr-cap--500">
          {kind === "refund" ? "ยอดคืนเงิน" : "ยอดรับชำระ"}
        </div>
        <div className={`ka-pr-big${amount < 0 ? " ka-pr-neg" : ""}`}>
          {signedBaht(amount)}
        </div>
      </div>
    </section>
  );
}

/** `/[id]`: one receipt, its order's payments and its history (R25–R28), with the print sheet beside it. */
export default function ReceiptDetail({
  receipt,
  autoPrint,
}: ReceiptDetailProps) {
  const router = useRouter();
  const toast = useToast();
  const { can } = usePermissions();
  const canAdd = can("payment_receipts", "add");
  const canEdit = can("payment_receipts", "edit");
  const canDelete = can("payment_receipts", "delete");
  const canViewOrders = can("sale_orders", "view");

  const id = receipt.payment_receipt_id;
  const code = receipt.payment_receipt_code;
  const kind = receiptKind(receipt);
  const orderId = receipt.saleOrder?.sale_order_id ?? receipt.sale_order_id;
  const orderHref = `${ORDERS}/${orderId}`;
  const orderCode = receipt.saleOrder?.sale_order_code ?? "—";
  const orderStatus = receipt.saleOrder?.sale_order_status;
  const cancelled = orderStatus === "cancelled";

  usePageCrumb({
    back: { label: "ใบเสร็จรับเงิน", href: BASE },
    current: code,
  });

  const [receipts, setReceipts] = useState<PaymentReceipt[] | null>(null);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fullOrder, setFullOrder] = useState<SaleOrder | null>(null);

  useEffect(() => {
    let active = true;
    receiptModel
      .getPaymentReceiptsBySaleOrder(orderId, 200)
      .then((response) => {
        if (!active) return;
        setReceipts(response.data ?? []);
        setReceiptsError(null);
      })
      .catch((error: unknown) => {
        if (active)
          setReceiptsError(loadErrorText("การชำระของใบสั่งขาย", error));
      });
    return () => {
      active = false;
    };
  }, [orderId, attempt]);

  useEffect(() => {
    if (!canViewOrders) return;
    let active = true;
    loadOrder(orderId)
      .then((loaded) => {
        if (active && loaded?.sale_order_id) setFullOrder(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [orderId, canViewOrders]);

  // Print on paper colours: the dark theme is lifted while the browser prints (button or Ctrl+P).
  useEffect(() => {
    const html = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = html.classList.contains("dark");
      if (wasDark) html.classList.remove("dark");
    };
    const after = () => {
      if (wasDark) html.classList.add("dark");
      wasDark = false;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const ready = receipts !== null;
  useEffect(() => {
    if (!autoPrint || !ready) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint, ready]);

  const remove = useReceiptDelete({
    onDeleted: useCallback(() => router.push(BASE), [router]),
  });

  const order = fullOrder ?? orderOf(receipt);
  const received = useMemo(
    () =>
      receipts
        ? sumMoney(receipts.map((item) => Number(item.amount_paid)))
        : undefined,
    [receipts],
  );
  const pay = order ? paymentState(order, received) : null;
  const percent = pay?.percent ?? 0;
  // `paymentState` says 0 for a cancelled order; the bar still shows what had been received.
  const orderTotal = order ? payable(order) : 0;
  const shownPercent =
    cancelled && orderTotal > 0
      ? Math.min(100, Math.round(((pay?.paid ?? 0) / orderTotal) * 100))
      : percent;
  const canReceive =
    canAdd &&
    Boolean(pay && pay.due > 0) &&
    (orderStatus === "approved" || orderStatus === "partial") &&
    receipt.saleOrder?.sale_order_type !== "custom";
  const editable = canEdit && canEditReceipt(receipt);
  const state = receiptStatus(receipt);
  const note = pageLockNote(receipt);

  const moreEntries: MenuEntry[] = [
    {
      label: "ไปที่ใบสั่งขาย",
      icon: "document",
      onSelect: () => router.push(orderHref),
    },
  ];
  if (canDelete && canDeleteReceipt(receipt)) {
    moreEntries.push({
      label: "ลบใบเสร็จ",
      icon: "delete",
      tone: "danger",
      onSelect: () => remove.request(receipt),
    });
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receipt.gateway_reference ?? "");
      toast({ message: "คัดลอกแล้ว", tone: "success" });
    } catch {
      toast({ message: "คัดลอกไม่สำเร็จ", tone: "danger" });
    }
  };

  const headTitle =
    kind === "refund"
      ? `ใบคืนเงิน · ${customerOf(receipt)}`
      : `ใบเสร็จรับเงิน · ${customerOf(receipt)}`;

  const paymentCard = receiptsError ? (
    <section className="ka-pr-card ka-pr-cp">
      <h2 style={{ marginBottom: 12 }}>การชำระของใบสั่งขายนี้</h2>
      <SectionError
        message={receiptsError}
        onRetry={() => setAttempt((count) => count + 1)}
      />
    </section>
  ) : kind === "store" && !cancelled ? (
    <section className="ka-pr-card ka-pr-cp">
      <h2 style={{ marginBottom: 6 }}>การชำระของใบสั่งขายนี้</h2>
      <div
        className="ka-pr-row ka-pr-row--between"
        style={{ fontSize: 14, marginBottom: 6 }}
      >
        <span className="ka-pr-mut">
          {pay && pay.due <= 0 ? "ชำระครบ" : `ชำระแล้ว ${percent}%`}
        </span>
        <b className="ka-pr-num">{`${formatBaht(pay?.paid ?? 0)} / ${formatBaht(pay?.total ?? 0)}`}</b>
      </div>
      <div
        className="ka-pr-meter"
        role="img"
        aria-label={`ชำระแล้ว ${percent}%`}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
    </section>
  ) : (
    <section className="ka-pr-card ka-pr-cp">
      <h2 style={{ marginBottom: 4 }}>การชำระของใบสั่งขายนี้</h2>
      <div className="ka-pr-cap" style={{ marginBottom: 12 }}>
        {orderCode} ·{" "}
        {cancelled ? (
          <span
            className="ka-pr-bd ka-pr-tone"
            data-tone="danger"
            style={{ height: 20, lineHeight: "20px" }}
          >
            ยกเลิก
          </span>
        ) : (
          `ยอดรวม ${formatBaht(order ? payable(order) : 0)}`
        )}
      </div>
      <div
        className="ka-pr-row ka-pr-row--between"
        style={{ fontSize: 14, marginBottom: 6 }}
      >
        <span className="ka-pr-mut">
          {pay && pay.due <= 0 && !cancelled
            ? "ชำระครบ"
            : cancelled
              ? "ชำระแล้ว"
              : `ชำระแล้ว ${percent}%`}
        </span>
        <b className="ka-pr-num">
          {cancelled
            ? formatBaht(pay?.paid ?? 0)
            : `${formatBaht(pay?.paid ?? 0)} / ${formatBaht(pay?.total ?? 0)}`}
        </b>
      </div>
      <div
        className="ka-pr-meter"
        role="img"
        aria-label={`ชำระแล้ว ${shownPercent}%`}
      >
        <i
          data-kind={cancelled ? "muted" : undefined}
          style={{ width: `${shownPercent}%` }}
        />
      </div>
      {cancelled ? (
        <div className="ka-pr-cap" style={{ marginTop: 10 }}>
          ใบสั่งขายถูกยกเลิกแล้ว รับชำระเพิ่มไม่ได้
        </div>
      ) : (
        <div className="ka-pr-paylist">
          {(receipts ?? [receipt]).map((item) => {
            const current = item.payment_receipt_id === id;
            return (
              <div
                key={item.payment_receipt_id}
                className="ka-pr-pay"
                data-current={current || undefined}
              >
                <span>
                  {current ? (
                    <span className="ka-pr-code">
                      {item.payment_receipt_code}
                    </span>
                  ) : (
                    <Link
                      href={`${BASE}/${item.payment_receipt_id}`}
                      className="ka-pr-code ka-pr-link ka-pr-target"
                    >
                      {item.payment_receipt_code}
                    </Link>
                  )}{" "}
                  · {typeText(item)}
                </span>
                <span className="ka-pr-num">
                  {signedBaht(Number(item.amount_paid))}
                </span>
              </div>
            );
          })}
          <div className="ka-pr-pay">
            <span className="ka-pr-mut">คงค้าง</span>
            <span className="ka-pr-num ka-pr-link" style={{ fontWeight: 600 }}>
              {formatBaht(pay?.due ?? 0)}
            </span>
          </div>
        </div>
      )}
      {canReceive && !cancelled && (
        <Link
          className="ka-pr-btn ka-pr-btn--a ka-pr-w100"
          style={{ marginTop: 12 }}
          href={`${BASE}/new?sale_order=${orderId}`}
        >
          รับชำระส่วนที่เหลือ
        </Link>
      )}
    </section>
  );

  const historyCard = (
    <section className="ka-pr-card ka-pr-cp">
      <h2 style={{ marginBottom: 12 }}>ประวัติ</h2>
      <DocumentHistoryPanel
        endpoint={`/payment-receipts/${id}/history`}
        variant="timeline"
        limit={2}
        documentLabel={receipt.payment_receipt_code || undefined}
      />
    </section>
  );

  return (
    <div className="ka-pr">
      <div className="ka-pr-ph">
        <div style={{ minWidth: 0 }}>
          <div className="ka-pr-row ka-pr-row--8 ka-pr-row--wrap">
            <span className="ka-pr-code ka-pr-mut">
              <DocumentCode code={code} />
            </span>
            <Badge tone={state.tone}>{state.label}</Badge>
            {kind === "store" && <Badge tone="brand">หน้าร้านออนไลน์</Badge>}
            {kind === "custom" && <Badge tone="info">Custom</Badge>}
          </div>
          <h1 style={{ marginTop: 4 }}>{headTitle}</h1>
          {receipt.legacy_code && (
            <p className="ka-pr-cap ka-pr-p">เลขเดิม {receipt.legacy_code}</p>
          )}
        </div>
        <div className="ka-pr-row ka-pr-row--8 ka-pr-row--wrap ka-pr-dact">
          <button
            type="button"
            className="ka-pr-btn"
            disabled={!ready}
            onClick={() => window.print()}
          >
            <Icon name="print" small />
            พิมพ์ / PDF
          </button>
          {kind === "custom" && (
            <Link className="ka-pr-btn" href={orderHref}>
              เปิดใบสั่งขาย Custom
            </Link>
          )}
          {editable && (
            <Link className="ka-pr-btn" href={`${BASE}/${id}/edit`}>
              <Icon name="edit" small />
              แก้ไข
            </Link>
          )}
          {kind !== "refund" && kind !== "custom" && (
            <ReceiptMenu
              receipt={receipt}
              label="ตัวเลือกเพิ่มเติม"
              entries={moreEntries}
              triggerClassName="ka-pr-ib ka-pr-ib--line"
            />
          )}
        </div>
      </div>

      <div className="ka-pr-grid">
        <div className="ka-pr-stack">
          <Hero receipt={receipt} />
          {note && kind !== "store" && (
            <div
              className="ka-pr-note ka-pr-tone"
              style={{ display: "flex" }}
              data-tone={kind === "custom" ? "info" : "neutral"}
            >
              <Icon name="lock" small />
              <span>{note}</span>
            </div>
          )}
          {kind === "store" ? (
            <section className="ka-pr-card ka-pr-cp">
              <dl className="ka-pr-dl">
                <div>
                  <dt>เลขอ้างอิงผู้ให้บริการ</dt>
                  <dd>
                    <span className="ka-pr-ref">
                      <span className="ka-pr-code">
                        {receipt.gateway_reference}
                      </span>
                      <button
                        type="button"
                        className="ka-pr-ib ka-pr-ib--sm"
                        aria-label="คัดลอกเลขอ้างอิง"
                        onClick={() => void copy()}
                      >
                        <Icon name="copy" small />
                      </button>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>ใบสั่งขาย</dt>
                  <dd>
                    <Link className="ka-pr-sochip ka-pr-code" href={orderHref}>
                      {orderCode} →
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>ผู้บันทึก</dt>
                  <dd>ระบบหน้าร้าน</dd>
                </div>
              </dl>
            </section>
          ) : kind !== "refund" ? (
            <section className="ka-pr-card" aria-labelledby="ka-pr-dd">
              <div className="ka-pr-chd">
                <h2 id="ka-pr-dd">ข้อมูลใบเสร็จ</h2>
              </div>
              <div className="ka-pr-cp">
                <dl className="ka-pr-dl">
                  <div>
                    <dt>ใบสั่งขาย</dt>
                    <dd>
                      <Link
                        className="ka-pr-sochip ka-pr-code"
                        href={orderHref}
                      >
                        {orderCode} →
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>ลูกค้า</dt>
                    <dd style={{ fontWeight: 600 }}>{customerOf(receipt)}</dd>
                  </div>
                  <div>
                    <dt>วันที่รับชำระ</dt>
                    <dd>{formatThaiDate(receipt.payment_date)}</dd>
                  </div>
                  <div>
                    <dt>ประเภทการชำระ</dt>
                    <dd>{typeWithShare(receipt)}</dd>
                  </div>
                  <div>
                    <dt>วิธีชำระ</dt>
                    <dd>{methodView(receipt).main}</dd>
                  </div>
                  <div>
                    <dt>บัญชีที่รับเงิน</dt>
                    <dd>{accountText(receipt)}</dd>
                  </div>
                  <div>
                    <dt>ผู้บันทึก</dt>
                    <dd>{receipt.create_by_name || "—"}</dd>
                  </div>
                  <div className="ka-pr-dl__wide">
                    <dt>หมายเหตุ</dt>
                    <dd>{receipt.payment_receipt_remark || "—"}</dd>
                  </div>
                </dl>
              </div>
            </section>
          ) : null}
        </div>
        <div className="ka-pr-aside">
          {kind === "refund" ? (
            <section className="ka-pr-card ka-pr-cp">
              <h2 style={{ marginBottom: 10 }}>ใบสั่งขาย</h2>
              <Link className="ka-pr-sochip ka-pr-code" href={orderHref}>
                {orderCode} →
              </Link>
              {receiptsError ? (
                <div style={{ marginTop: 12 }}>
                  <SectionError
                    message={receiptsError}
                    onRetry={() => setAttempt((count) => count + 1)}
                  />
                </div>
              ) : (
                <div className="ka-pr-cap" style={{ marginTop: 8 }}>
                  ยอดชำระสุทธิหลังคืนเงิน{" "}
                  {receipts ? formatBaht(netAfter(receipt, receipts)) : "—"}
                </div>
              )}
            </section>
          ) : (
            paymentCard
          )}
          {historyCard}
        </div>
      </div>
      {/* Without the order's receipts every sum on the sheet would be false, Ctrl+P included. */}
      {receipts ? <ReceiptPrint receipt={receipt} receipts={receipts} /> : null}
      {remove.dialogs}
    </div>
  );
}
