import StatusBadge from "@/components/StatusBadge";
import type { OpenList } from "@/components/dashboard/DashboardListModal";
import type {
  DashboardListKey,
  PendingWork as PendingWorkData,
} from "@/types/dashboard";

const count = (value: number) => new Intl.NumberFormat("th-TH").format(value);

interface Item {
  key: DashboardListKey & keyof PendingWorkData;
  href: string;
  title: string;
  hint: string;
  /** What the date column means for this list. */
  dateLabel: string;
  /** Needs a decision or is at risk now: listed first and marked with this word while the count is above 0. */
  urgent?: string;
  /** False for a count that is part of another row, or waits on the customer rather than on staff. */
  counted?: boolean;
  /** Why the rows are listed, in the list's header; `hint` when left out. */
  reason?: string;
  /** The verb on each row of the list. */
  rowAction?: string;
}

// Urgent work first, then the rest in the order the work usually moves. Each row opens the rows behind
// its count; `href` is the page where that work is done.
const ITEMS: Item[] = [
  {
    key: "store_orders_to_review",
    href: "/admin/store-fulfillment",
    title: "คำสั่งซื้อหน้าร้านที่รอตรวจ",
    hint: "ชำระเงินหลังหมดเวลา",
    reason: "ลูกค้าชำระเงินหลังหมดเวลาจอง ต้องตรวจก่อนยืนยัน",
    rowAction: "ตรวจสอบ",
    dateLabel: "วันที่สั่งซื้อ",
    urgent: "ต้องตรวจสอบ",
  },
  {
    key: "store_cancellations_to_decide",
    href: "/admin/store-fulfillment",
    title: "คำขอยกเลิกรอพิจารณา",
    hint: "พักส่งและส่งมอบไว้จนกว่าจะพิจารณา",
    rowAction: "พิจารณา",
    dateLabel: "วันที่ขอยกเลิก",
    urgent: "รอพิจารณา",
  },
  {
    key: "store_refunds_unfinished",
    href: "/admin/store-fulfillment",
    title: "เงินคืนที่ยังไม่เสร็จ",
    hint: "คืนไม่สำเร็จ ต้องโอนคืน หรือรอปิดคำสั่งซื้อ",
    dateLabel: "วันที่สั่งซื้อ",
    urgent: "เงินคืนค้าง",
  },
  {
    key: "store_pickups_overdue",
    href: "/admin/store-fulfillment",
    title: "รับที่ร้านเลยกำหนด",
    hint: "เป็นส่วนหนึ่งของ “รอรับที่ร้าน” ที่เลยวันนัดรับแล้ว",
    dateLabel: "กำหนดรับ",
    urgent: "เลยกำหนด",
    counted: false,
  },
  {
    key: "sale_orders_to_approve",
    href: "/admin/sale-orders",
    title: "ใบขายรออนุมัติ",
    hint: "ไม่นับใบที่รอลูกค้าจ่ายเงิน",
    rowAction: "อนุมัติ",
    dateLabel: "วันที่สร้าง",
  },
  {
    key: "store_orders_to_ship",
    href: "/admin/store-fulfillment",
    title: "รอจัดส่ง",
    hint: "ชำระแล้ว สินค้ายังไม่ส่ง ไม่นับที่รอค่าจัดส่ง",
    dateLabel: "วันที่สั่งซื้อ",
  },
  {
    key: "store_orders_to_pickup",
    href: "/admin/store-fulfillment",
    title: "รอรับที่ร้าน",
    hint: "ชำระแล้ว ลูกค้ายังไม่มารับ",
    dateLabel: "วันที่สั่งซื้อ",
  },
  {
    key: "purchase_orders_to_approve",
    href: "/admin/purchase-orders",
    title: "ใบสั่งซื้อรออนุมัติ",
    hint: "ดูใบสั่งซื้อ",
    reason: "ใบสั่งซื้อที่ยังไม่ได้อนุมัติ",
    rowAction: "อนุมัติ",
    dateLabel: "วันที่สั่งซื้อ",
  },
  {
    key: "contact_requests_new",
    href: "/admin/contact-requests",
    title: "คำขอติดต่อกลับใหม่",
    hint: "ยังไม่มีใครติดต่อ",
    dateLabel: "วันที่ส่งคำขอ",
  },
  {
    key: "store_shipping_unpaid",
    href: "/admin/store-fulfillment",
    title: "รอลูกค้าชำระค่าจัดส่ง",
    hint: "สร้างพัสดุได้เมื่อลูกค้าชำระแล้ว",
    dateLabel: "วันที่แจ้งค่าจัดส่ง",
    counted: false,
  },
];

/** The totals the greeting shows: rows that count, and how many of those are urgent. */
export function summarizePending(work: PendingWorkData | undefined) {
  if (!work) return undefined;
  let waiting = 0;
  let urgent = 0;
  for (const item of ITEMS) {
    const value = work[item.key] ?? 0;
    if (item.counted === false) continue;
    waiting += value;
    if (item.urgent) urgent += value;
  }
  return { waiting, urgent };
}

/**
 * Work waiting for an employee, most urgent first. Only the counts the API returned are drawn,
 * so a count the employee may not see leaves no empty row behind; rows at 0 share one line.
 */
export default function PendingWork({
  work,
  onOpen,
}: {
  work: PendingWorkData;
  onOpen: (list: OpenList) => void;
}) {
  const visible = ITEMS.filter((item) => work[item.key] !== undefined);
  if (visible.length === 0) return null;
  const open = visible.filter((item) => (work[item.key] ?? 0) > 0);
  const empty = visible.filter((item) => (work[item.key] ?? 0) === 0);

  return (
    <section aria-labelledby="dashboard-pending" className="ka-card ka-todo">
      <div className="ka-card__head">
        <h2 id="dashboard-pending" className="ka-card__title">
          งานที่รอทำ
        </h2>
        <span className="ka-todo__cap">เรียงตามความเร่งด่วน</span>
      </div>
      {open.length > 0 && (
        <ul className="ka-todo__list">
          {open.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() =>
                  onOpen({
                    key: item.key,
                    title: item.title,
                    href: item.href,
                    dateLabel: item.dateLabel,
                    reason: item.reason ?? item.hint,
                    tone: item.urgent ? "danger" : "warning",
                    oldestFirst: true,
                    rowAction: item.rowAction,
                  })
                }
                className="ka-todo__row"
              >
                <span className="ka-todo__text">
                  <span className="ka-todo__title">
                    {item.title}
                    {item.urgent && (
                      <StatusBadge tone="danger" live>
                        {item.urgent}
                      </StatusBadge>
                    )}
                  </span>
                  <span className="ka-todo__cap">{item.hint}</span>
                </span>
                <span className="ka-todo__count numeric">{count(work[item.key] ?? 0)}</span>
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true" className="ka-todo__chev">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open.length === 0 && <p className="ka-todo__none">ไม่มีงานค้างที่รอทำ</p>}
      {empty.length > 0 && open.length > 0 && (
        <p className="ka-todo__zero">
          ไม่มีงานค้าง: {empty.map((item) => item.title).join(" · ")}
        </p>
      )}
    </section>
  );
}
