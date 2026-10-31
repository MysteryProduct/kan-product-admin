import type { BadgeTone } from "@/components/StatusBadge";
import {
  CONTACT_REQUEST_STATUS_TONE,
  INVOICE_SUPPLIER_STATUS_TONE,
  PURCHASE_ORDER_STATUS_TONE,
  SALE_ORDER_STATUS_TONE,
  STORE_CANCELLATION_STATUS_TONE,
  STORE_PICKUP_STATUS_TONE,
} from "@/lib/status-tones";
import { INVOICE_STATUS_LABELS } from "@/types/invoice-supplier";
import type { DashboardListKind } from "@/types/dashboard";

// The statuses these lists can hold, in words and tone, by what the row is (the
// same word can mean different things: "pending" of an order or of a job).
const STATUS_VIEWS: Partial<
  Record<DashboardListKind, Record<string, { label: string; tone: BadgeTone }>>
> = {
  sale_order: {
    pending: { label: "รออนุมัติ", tone: SALE_ORDER_STATUS_TONE.pending },
    approved: { label: "อนุมัติแล้ว", tone: SALE_ORDER_STATUS_TONE.approved },
    partial: { label: "ชำระบางส่วน", tone: SALE_ORDER_STATUS_TONE.partial },
    paid: { label: "ชำระแล้ว", tone: SALE_ORDER_STATUS_TONE.paid },
    cancelled: { label: "ยกเลิก", tone: SALE_ORDER_STATUS_TONE.cancelled },
    partially_returned: {
      label: "คืนสินค้าบางส่วน",
      tone: SALE_ORDER_STATUS_TONE.partially_returned,
    },
    returned: { label: "คืนสินค้าแล้ว", tone: SALE_ORDER_STATUS_TONE.returned },
  },
  payment_receipt: {
    paid: { label: "ชำระแล้ว", tone: "success" },
    refunded: { label: "คืนเงินแล้ว", tone: "warning" },
  },
  // Stock of a variant by the remaining quantity of all lots (TASK-0161).
  product_variant: {
    out: { label: "หมด", tone: "danger" },
    low: { label: "เหลือน้อย", tone: "warning" },
    normal: { label: "ปกติ", tone: "success" },
  },
  purchase_order: {
    pending: { label: "รออนุมัติ", tone: PURCHASE_ORDER_STATUS_TONE.pending },
    active: {
      label: "อนุมัติแล้ว รอรับสินค้า",
      tone: PURCHASE_ORDER_STATUS_TONE.active,
    },
    partial: {
      label: "รับสินค้าบางส่วน",
      tone: PURCHASE_ORDER_STATUS_TONE.partial,
    },
  },
  // The Store work queues send why the order is listed rather than its own
  // status. Pickup, shipping and an attempt in flight use the order page's
  // words; the refund reasons say what staff have to do (TASK-0089).
  store_order: {
    awaiting_review: { label: "รอตรวจ", tone: "warning" },
    paid: { label: "ชำระแล้ว", tone: "success" },
    cancellation_pending: {
      label: "รอพิจารณา",
      tone: STORE_CANCELLATION_STATUS_TONE.pending,
    },
    refund_failed: { label: "คืนไม่สำเร็จ", tone: "danger" },
    refund_transfer_due: { label: "ต้องโอนคืน", tone: "warning" },
    shipping_overpaid: { label: "ค่าส่งจ่ายเกิน", tone: "warning" },
    refund_reversal_pending: {
      label: "คืนแล้ว รอปิดคำสั่งซื้อ",
      tone: "warning",
    },
    // Nothing asks the gateway again by itself: staff press "ลองคืนเงินอีกครั้ง".
    refund_retry_due: { label: "รอผล กดตรวจอีกครั้ง", tone: "warning" },
    refund_account_required: { label: "รอลูกค้าแจ้งบัญชี", tone: "warning" },
    refund_processing: { label: "กำลังส่งคำขอคืนเงิน", tone: "info" },
    pickup_overdue: {
      label: "เกินกำหนดรับ",
      tone: STORE_PICKUP_STATUS_TONE.overdue,
    },
    pickup_pending_review: {
      label: "รอพิจารณากรณีไม่รับสินค้า",
      tone: STORE_PICKUP_STATUS_TONE.pending_review,
    },
    shipping_awaiting_payment: { label: "รอลูกค้าชำระ", tone: "warning" },
    shipping_pending_review: {
      label: "รอพิจารณา (ครบกำหนดเก็บสินค้า)",
      tone: "danger",
    },
  },
  contact_request: {
    new: { label: "ใหม่", tone: CONTACT_REQUEST_STATUS_TONE.new },
  },
  job_order: {
    pending: { label: "รอดำเนินการ", tone: "warning" },
    in_progress: { label: "กำลังผลิต", tone: "info" },
    completed: { label: "ผลิตเสร็จแล้ว", tone: "success" },
    cancelled: { label: "ยกเลิกการผลิต", tone: "danger" },
  },
  invoice_supplier: {
    pending: {
      label: INVOICE_STATUS_LABELS.pending,
      tone: INVOICE_SUPPLIER_STATUS_TONE.pending,
    },
    partial: {
      label: INVOICE_STATUS_LABELS.partial,
      tone: INVOICE_SUPPLIER_STATUS_TONE.partial,
    },
  },
};

export const statusView = (kind: DashboardListKind, status: string) =>
  STATUS_VIEWS[kind]?.[status] ?? {
    label: status,
    tone: "neutral" as BadgeTone,
  };
