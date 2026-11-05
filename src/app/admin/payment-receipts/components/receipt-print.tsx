"use client";

import Image from "next/image";
import { formatThaiDate, formatThaiDateTime } from "@/lib/date-format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import type { PaymentReceipt } from "@/types/payment-receipt";
import {
  formatBaht,
  formatMoney,
  payable,
} from "@/app/admin/sale-orders/lib/so-display";
import {
  accountText,
  hasSystemName,
  customerOf,
  orderOf,
  paidBefore,
  receiptKind,
  storeMethod,
  sumMoney,
} from "../lib/receipt-display";

const ITEM_TEXT: Record<string, string> = {
  full: "รับชำระเต็มจำนวน",
  partial: "รับชำระบางส่วน",
  deposit: "รับชำระมัดจำ",
  online_gateway: "รับชำระผ่านหน้าร้าน",
};

interface ReceiptPrintProps {
  receipt: PaymentReceipt;
  /** Every receipt of the order, so the sheet can say what came before this one (R33). */
  receipts: PaymentReceipt[];
}

/** The A4 sheet of `Print`. It takes no room on screen; the print styles show it alone. */
export default function ReceiptPrint({ receipt, receipts }: ReceiptPrintProps) {
  const kind = receiptKind(receipt);
  const refund = kind === "refund";
  const shop = receipt.shop;
  const order = orderOf(receipt);
  const orderCode = receipt.saleOrder?.sale_order_code ?? "—";
  const amount = Math.abs(Number(receipt.amount_paid));
  const total = order ? payable(order) : 0;
  const before = paidBefore(receipt, receipts);
  const remaining = Math.max(
    0,
    sumMoney([total, -before, -Number(receipt.amount_paid)]),
  );
  const netAfter = sumMoney(receipts.map((item) => Number(item.amount_paid)));
  const taxLine = [
    shop?.tax_id && `เลขประจำตัวผู้เสียภาษี ${shop.tax_id}`,
    shop?.branch_code && `สาขา ${shop.branch_code}`,
    shop?.phone && `โทร ${shop.phone}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const itemText = refund
    ? "คืนเงินตามใบสั่งขาย"
    : `${ITEM_TEXT[receipt.payment_receipt_type] ?? "รับชำระ"} ตามใบสั่งขาย`;
  const signatures = refund
    ? ["ผู้จ่ายเงิน", "ผู้รับเงิน"]
    : ["ผู้รับเงิน", "ผู้จ่ายเงิน"];

  return (
    <section className="ka-pr-pg" aria-hidden="true">
      <header className="ka-pr-pg__hd">
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <Image
            src="/kan-product-mark.png"
            alt=""
            width={48}
            height={48}
            className="ka-pr-pg__logo"
          />
          <div>
            {shop?.name && (
              <div style={{ fontWeight: 700, fontSize: 16 }}>{shop.name}</div>
            )}
            <div className="ka-pr-mut" style={{ fontSize: 13 }}>
              {shop?.address && <div>{shop.address}</div>}
              {taxLine && <div>{taxLine}</div>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 className="ka-pr-pg__ttl">
            {refund ? "ใบคืนเงิน" : "ใบเสร็จรับเงิน"}
          </h2>
          <div className="ka-pr-pg__en">{refund ? "REFUND" : "RECEIPT"}</div>
          <dl className="ka-pr-pg__meta">
            <dt>เลขที่</dt>
            <dd className="ka-pr-code">{receipt.payment_receipt_code}</dd>
            <dt>วันที่</dt>
            <dd>{formatThaiDate(receipt.payment_date)}</dd>
            <dt>อ้างอิงใบสั่งขาย</dt>
            <dd className="ka-pr-code">{orderCode}</dd>
          </dl>
        </div>
      </header>

      <div className="ka-pr-pg__box">
        <div className="ka-pr-pg__lb">
          {refund ? "คืนเงินให้" : "ได้รับเงินจาก"}
        </div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          {customerOf(receipt)}
        </div>
        {receipt.saleOrder?.shipping_address_name &&
          receipt.saleOrder.shipping_address_name !== customerOf(receipt) && (
            <div className="ka-pr-mut">
              {receipt.saleOrder.shipping_address_name}
            </div>
          )}
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 64 }}>#</th>
            <th>รายการ</th>
            <th className="ka-pr-r" style={{ width: 180 }}>
              จำนวนเงิน (บาท)
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="ka-pr-num">1</td>
            <td>
              <div style={{ fontWeight: 600 }}>
                {itemText} {orderCode}
              </div>
              <div className="ka-pr-mut">
                {hasSystemName(receipt)
                  ? ""
                  : `${receipt.saleOrder?.sale_order_name} · `}
                ยอดใบสั่งขาย {formatBaht(total)}
              </div>
            </td>
            <td className="ka-pr-r ka-pr-num">{formatMoney(amount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="ka-pr-pg__tot">
        {refund ? (
          <div>
            <span className="ka-pr-mut">ยอดชำระสุทธิหลังคืนเงิน</span>
            <span>{formatMoney(netAfter)}</span>
          </div>
        ) : (
          <>
            <div>
              <span className="ka-pr-mut">ชำระก่อนหน้านี้</span>
              <span>{formatMoney(before)}</span>
            </div>
            <div>
              <span className="ka-pr-mut">คงค้างหลังรับชำระ</span>
              <span>{formatMoney(remaining)}</span>
            </div>
          </>
        )}
        <div className="ka-pr-pg__g">
          <span>{refund ? "คืนเงินครั้งนี้" : "รับชำระครั้งนี้"}</span>
          <span>{formatBaht(amount)}</span>
        </div>
      </div>

      <div className="ka-pr-pg__words">({thaiBahtText(amount)})</div>

      {!refund && (
        <div>
          <div className="ka-pr-pg__lb">ชำระโดย</div>
          {kind === "store" ? (
            <span>
              {storeMethod(receipt)} · เลขอ้างอิง{" "}
              <span className="ka-pr-code">{receipt.gateway_reference}</span>
            </span>
          ) : (
            <>
              <span className="ka-pr-pg__cb">
                <i>{receipt.payment_method === "cash" ? "✓" : ""}</i>เงินสด
              </span>
              <span className="ka-pr-pg__cb">
                <i>{receipt.payment_method === "bank" ? "✓" : ""}</i>
                โอนผ่านธนาคาร
                {receipt.payment_method === "bank" &&
                  ` ${accountText(receipt)}`}
              </span>
              {receipt.payment_method === "bank" && (
                <span className="ka-pr-mut">
                  วันที่โอน {formatThaiDate(receipt.payment_date)}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {receipt.payment_receipt_remark && (
        <div>
          <div className="ka-pr-pg__lb">หมายเหตุ</div>
          {receipt.payment_receipt_remark}
        </div>
      )}

      <div className="ka-pr-pg__sig">
        {signatures.map((label) => (
          <div key={label}>
            <div className="ka-pr-pg__ln" />
            {label}
            <br />
            <span className="ka-pr-mut">วันที่ ____/____/______</span>
          </div>
        ))}
      </div>

      <footer className="ka-pr-pg__ft">
        <span>เอกสารนี้ไม่ใช่ใบกำกับภาษี</span>
        <span>พิมพ์เมื่อ {formatThaiDateTime(new Date())} · หน้า 1/1</span>
      </footer>
    </section>
  );
}
