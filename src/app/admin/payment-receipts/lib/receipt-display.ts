import type { BadgeTone } from "@/components/StatusBadge";
import {
  formatBaht,
  payable,
  paymentState,
} from "@/app/admin/sale-orders/lib/so-display";
import type { SaleOrder } from "@/types/sale-order";
import type {
  PaymentReceipt,
  PaymentReceiptMethodFilter,
  PaymentReceiptSaleOrder,
  PaymentReceiptTab,
  PaymentReceiptType,
} from "@/types/payment-receipt";

export const BASE = "/admin/payment-receipts";
export const ORDERS = "/admin/sale-orders";

export type ReceiptKind = "regular" | "refund" | "store" | "custom";
export type ReceiptSort = "newest" | "oldest" | "amount_desc" | "amount_asc";

export const TABS: { key: PaymentReceiptTab; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "paid", label: "ชำระแล้ว" },
  { key: "refund", label: "คืนเงิน" },
];

export const METHODS: { value: PaymentReceiptMethodFilter; label: string }[] = [
  { value: "bank", label: "โอนผ่านธนาคาร" },
  { value: "cash", label: "เงินสด" },
  { value: "online", label: "หน้าร้านออนไลน์" },
];

export const TYPES: { value: PaymentReceiptType; label: string }[] = [
  { value: "full", label: "ชำระเต็มจำนวน" },
  { value: "partial", label: "ชำระบางส่วน" },
  { value: "deposit", label: "วางมัดจำ" },
  { value: "refund", label: "คืนเงิน" },
];

export const SORTS: Record<
  ReceiptSort,
  {
    label: string;
    field: "payment_date" | "amount_paid";
    order: "ASC" | "DESC";
  }
> = {
  newest: { label: "ล่าสุดก่อน", field: "payment_date", order: "DESC" },
  oldest: { label: "เก่าสุดก่อน", field: "payment_date", order: "ASC" },
  amount_desc: { label: "ยอดมากไปน้อย", field: "amount_paid", order: "DESC" },
  amount_asc: { label: "ยอดน้อยไปมาก", field: "amount_paid", order: "ASC" },
};

/** A refund stays a refund when it came from the Store; R8 and the guards read it that way. */
export function receiptKind(receipt: PaymentReceipt): ReceiptKind {
  if (receipt.payment_receipt_type === "refund") return "refund";
  if (receipt.gateway_reference) return "store";
  if (receipt.custom_linked) return "custom";
  return "regular";
}

export function asOrder(order: PaymentReceiptSaleOrder): SaleOrder {
  return order as unknown as SaleOrder;
}

/** The receipt's sale order in the shape `payable()` and `paymentState()` read. */
export function orderOf(receipt: PaymentReceipt): SaleOrder | null {
  return receipt.saleOrder ? asOrder(receipt.saleOrder) : null;
}

const EDITABLE_ORDER = ["approved", "partial", "paid"];

/** R9: the API answers 400 when the order is in any other status. */
export function canEditReceipt(receipt: PaymentReceipt): boolean {
  return (
    receiptKind(receipt) === "regular" &&
    EDITABLE_ORDER.includes(receipt.saleOrder?.sale_order_status ?? "")
  );
}

export function canDeleteReceipt(receipt: PaymentReceipt): boolean {
  return receiptKind(receipt) === "regular";
}

/** Why a receipt offers no edit or delete; the same words stand in its menu and on its page. */
export function lockNote(receipt: PaymentReceipt): string | undefined {
  const kind = receiptKind(receipt);
  if (kind === "refund" && receipt.gateway_reference)
    return "ใบจากหน้าร้านออนไลน์ดูและพิมพ์ได้เท่านั้น";
  if (kind === "refund")
    return "ใบคืนเงินสร้างจากการคืนสินค้า จึงแก้ไขหรือลบไม่ได้";
  if (kind === "custom")
    return "ใบนี้ผูกกับคำขอ Custom จึงแก้ไขหรือลบที่นี่ไม่ได้ จัดการที่ใบสั่งขาย Custom";
  if (kind === "store") return "ใบจากหน้าร้านออนไลน์ดูและพิมพ์ได้เท่านั้น";
  return undefined;
}

/** The longer words of `DetailVariants`, for the note on a receipt's own page. */
export function pageLockNote(receipt: PaymentReceipt): string | undefined {
  const kind = receiptKind(receipt);
  if (kind === "refund" && !receipt.gateway_reference)
    return "ใบคืนเงินสร้างจากการคืนสินค้าเท่านั้น จึงแก้ไขหรือลบที่นี่ไม่ได้ ถ้าต้องแก้ ให้ทำที่การคืนสินค้าของใบสั่งขาย";
  if (kind === "custom")
    return "ใบนี้ผูกกับคำขอ Custom จึงแก้ไขหรือลบที่นี่ไม่ได้ บันทึกมัดจำหรือยอดคงเหลือผ่านใบสั่งขาย Custom";
  return lockNote(receipt);
}

/** What the edit page says in place of the form (R24). */
export function editLock(receipt: PaymentReceipt): string {
  return (
    lockNote(receipt) ?? "ใบสั่งขายของใบนี้ไม่อยู่ในสถานะที่แก้ไขใบเสร็จได้"
  );
}

export function typeText(receipt: PaymentReceipt): string {
  const type = receipt.payment_receipt_type;
  if (type === "online_gateway") return "ชำระเต็มจำนวน";
  return TYPES.find((item) => item.value === type)?.label ?? "—";
}

export type MethodIcon = "bank" | "cash" | "store" | "refund";

export interface MethodView {
  icon: MethodIcon;
  tone: BadgeTone;
  main: string;
  sub: string;
}

/** "กสิกรไทย ·· 4821"; an account number is never shown whole. */
export function accountText(receipt: PaymentReceipt): string {
  const account = receipt.bankAccount;
  // A receipt changed from transfer to cash keeps its old account in the API; it is no longer this receipt's (D21).
  if (!account || receipt.payment_method !== "bank") return "—";
  const tail = String(account.account_number ?? "")
    .replace(/\D/g, "")
    .slice(-4);
  return tail ? `${account.bank_name} ·· ${tail}` : account.bank_name;
}

export function storeMethod(receipt: PaymentReceipt): string {
  return receipt.payment_method === "card" ? "บัตร" : "PromptPay";
}

/** R8: icon, tone and both lines of the payment method. */
export function methodView(receipt: PaymentReceipt): MethodView {
  if (receiptKind(receipt) === "refund") {
    return {
      icon: "refund",
      tone: "neutral",
      main: "คืนเงิน",
      sub: receipt.payment_receipt_remark || "—",
    };
  }
  if (receipt.gateway_reference) {
    return {
      icon: "store",
      tone: "brand",
      main: "หน้าร้านออนไลน์",
      sub: `${storeMethod(receipt)} · ${receipt.gateway_reference.slice(0, 7)}…`,
    };
  }
  if (receipt.payment_method === "cash")
    return { icon: "cash", tone: "success", main: "เงินสด", sub: "รับที่ร้าน" };
  return {
    icon: "bank",
    tone: "info",
    main: "โอนผ่านธนาคาร",
    sub: accountText(receipt),
  };
}

/** `฿48,500.00`, or `−฿590.00` for a refund. */
export function signedBaht(amount: number): string {
  return amount < 0 ? `−${formatBaht(Math.abs(amount))}` : formatBaht(amount);
}

/** A store or custom order's name is a label the system wrote, never for a customer to read (D20). */
export function hasSystemName(receipt: PaymentReceipt): boolean {
  return ["store", "custom"].includes(receipt.saleOrder?.sale_order_type ?? "");
}

export function customerOf(receipt: PaymentReceipt): string {
  const order = receipt.saleOrder;
  return (
    order?.customer_name ||
    order?.shipping_address_name ||
    (hasSystemName(receipt) ? "" : order?.sale_order_name) ||
    "—"
  );
}

export function receiptStatus(receipt: PaymentReceipt): {
  label: string;
  tone: BadgeTone;
} {
  return receiptKind(receipt) === "refund" ||
    receipt.payment_status === "refunded"
    ? { label: "คืนเงินแล้ว", tone: "neutral" }
    : { label: "ชำระแล้ว", tone: "success" };
}

/** "วางมัดจำ 30%" for a deposit, the plain type for the rest (R25). */
export function typeWithShare(receipt: PaymentReceipt): string {
  const order = orderOf(receipt);
  const total = order ? payable(order) : 0;
  if (receipt.payment_receipt_type !== "deposit" || total <= 0)
    return typeText(receipt);
  return `วางมัดจำ ${Math.round((Number(receipt.amount_paid) / total) * 100)}%`;
}

/** Sums money in satang, so 0.1 + 0.2 stays 0.30. */
export function sumMoney(values: number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}

/** The amounts a deletion takes away, for the facts of the dialog (R29). */
export function afterDelete(receipt: PaymentReceipt) {
  const order = orderOf(receipt);
  const state = order ? paymentState(order) : null;
  const amount = Number(receipt.amount_paid);
  return {
    amount,
    paidAfter: state ? sumMoney([state.paid, -amount]) : 0,
    total: state?.total ?? 0,
  };
}

/**
 * R33: what was received before this receipt on the same order. An earlier `payment_date` counts; on the same
 * date the document code decides, so the result never depends on how the list was sorted.
 */
export function paidBefore(
  receipt: PaymentReceipt,
  all: PaymentReceipt[],
): number {
  const day = (value: PaymentReceipt) => new Date(value.payment_date).getTime();
  return sumMoney(
    all
      .filter(
        (other) => other.payment_receipt_id !== receipt.payment_receipt_id,
      )
      .filter(
        (other) =>
          day(other) < day(receipt) ||
          (day(other) === day(receipt) &&
            other.payment_receipt_code < receipt.payment_receipt_code),
      )
      .map((other) => Number(other.amount_paid)),
  );
}
