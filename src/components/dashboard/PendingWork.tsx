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
  /** The row's icon tile (artboard "Dashboard"): its picture and colour. */
  icon: keyof typeof ICONS;
  tone: "danger" | "warning" | "info";
  /** Its name in the "ไม่มีงานค้าง" line; `title` when left out. */
  short?: string;
}

// Outline icons (24px viewBox, stroke 2) from the artboard's work list.
const ICONS = {
  alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
  document: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  store: "M4 9l1.5-5h13L20 9M4 9h16v11H4zM10 20v-6h4v6",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9M12 6v2M12 16v2",
} as const;

// Urgent work first, then the rest in the order the work usually moves. Each row opens the rows behind
// its count; `href` is the page where that work is done.
const ITEMS: Item[] = [
  {
    key: "store_orders_to_review",
    href: "/admin/store-fulfillment",
    title: "คำสั่งซื้อหน้าร้านที่รอตรวจ",
    hint: "ชำระเงินหลังหมดเวลาจอง",
    reason: "ลูกค้าชำระเงินหลังหมดเวลาจอง ต้องตรวจก่อนยืนยัน",
    rowAction: "ตรวจสอบ",
    dateLabel: "วันที่สั่งซื้อ",
    urgent: "ต้องตรวจสอบ",
    icon: "alert",
    tone: "danger",
  },
  {
    key: "store_cancellations_to_decide",
    href: "/admin/store-fulfillment",
    title: "คำขอยกเลิกรอพิจารณา",
    hint: "พักส่งและส่งมอบไว้จนกว่าจะพิจารณา",
    rowAction: "พิจารณา",
    dateLabel: "วันที่ขอยกเลิก",
    urgent: "รอพิจารณา",
    icon: "alert",
    tone: "danger",
    short: "คำขอยกเลิก",
  },
  {
    key: "store_refunds_unfinished",
    href: "/admin/store-fulfillment",
    title: "เงินคืนที่ยังไม่เสร็จ",
    hint: "คืนไม่สำเร็จ ต้องโอนคืน หรือรอปิดคำสั่งซื้อ",
    dateLabel: "วันที่สั่งซื้อ",
    urgent: "เงินคืนค้าง",
    icon: "alert",
    tone: "danger",
    short: "เงินคืน",
  },
  {
    key: "store_pickups_overdue",
    href: "/admin/store-fulfillment",
    title: "รับที่ร้านเลยกำหนด",
    hint: "เป็นส่วนหนึ่งของ “รอรับที่ร้าน” ที่เลยวันนัดรับแล้ว",
    dateLabel: "กำหนดรับ",
    urgent: "เลยกำหนด",
    counted: false,
    icon: "alert",
    tone: "danger",
  },
  {
    key: "sale_orders_to_approve",
    href: "/admin/sale-orders",
    title: "ใบขายรออนุมัติ",
    hint: "ไม่นับใบที่รอลูกค้าจ่ายเงิน",
    rowAction: "อนุมัติ",
    dateLabel: "วันที่สร้าง",
    icon: "document",
    tone: "warning",
  },
  {
    key: "store_orders_to_pickup",
    href: "/admin/store-fulfillment",
    title: "รอรับที่ร้าน",
    hint: "ชำระแล้ว ลูกค้ายังไม่มารับ",
    dateLabel: "วันที่สั่งซื้อ",
    icon: "store",
    tone: "info",
  },
  {
    key: "store_orders_to_ship",
    href: "/admin/store-fulfillment",
    title: "รอจัดส่ง",
    hint: "ชำระแล้ว สินค้ายังไม่ส่ง",
    reason: "ชำระแล้ว สินค้ายังไม่ส่ง ไม่นับที่รอค่าจัดส่ง",
    dateLabel: "วันที่สั่งซื้อ",
    icon: "truck",
    tone: "info",
  },
  {
    key: "purchase_orders_to_approve",
    href: "/admin/purchase-orders",
    title: "ใบสั่งซื้อรออนุมัติ",
    hint: "ดูใบสั่งซื้อ",
    reason: "ใบสั่งซื้อที่ยังไม่ได้อนุมัติ",
    rowAction: "อนุมัติ",
    dateLabel: "วันที่สั่งซื้อ",
    icon: "document",
    tone: "warning",
  },
  {
    key: "contact_requests_new",
    href: "/admin/contact-requests",
    title: "คำขอติดต่อกลับใหม่",
    hint: "ยังไม่มีใครติดต่อ",
    dateLabel: "วันที่ส่งคำขอ",
    icon: "phone",
    tone: "info",
    short: "คำขอติดต่อกลับ",
  },
  {
    key: "store_shipping_unpaid",
    href: "/admin/store-fulfillment",
    title: "รอลูกค้าชำระค่าจัดส่ง",
    hint: "สร้างพัสดุได้เมื่อลูกค้าชำระแล้ว",
    dateLabel: "วันที่แจ้งค่าจัดส่ง",
    counted: false,
    icon: "coin",
    tone: "info",
    short: "รอชำระค่าจัดส่ง",
  },
];

// The order of the names in the "ไม่มีงานค้าง" line, as on the artboard.
const ZERO_ORDER: Item["key"][] = [
  "store_cancellations_to_decide",
  "store_refunds_unfinished",
  "store_pickups_overdue",
  "store_shipping_unpaid",
  "contact_requests_new",
  "purchase_orders_to_approve",
  "store_orders_to_review",
  "sale_orders_to_approve",
  "store_orders_to_pickup",
  "store_orders_to_ship",
];

const Check = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

/** The waiting work above 0, urgent first, for the header's notification panel. */
export function pendingNotices(work: PendingWorkData | undefined) {
  if (!work) return [];
  return ITEMS.filter((item) => (work[item.key] ?? 0) > 0).map((item) => ({
    key: item.key,
    title: item.title,
    hint: item.hint,
    href: item.href,
    count: work[item.key] ?? 0,
    urgent: Boolean(item.urgent),
  }));
}

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
  const pickupsOverdue = work.store_pickups_overdue;
  // Overdue pickups are part of "รอรับที่ร้าน", so while that row shows, its caption carries them.
  const overdueInPickup = pickupsOverdue !== undefined && open.some((item) => item.key === "store_orders_to_pickup");
  const empty = visible
    .filter((item) => (work[item.key] ?? 0) === 0 && !(overdueInPickup && item.key === "store_pickups_overdue"))
    .sort((a, b) => ZERO_ORDER.indexOf(a.key) - ZERO_ORDER.indexOf(b.key));

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
                <span className="ka-todo__icon" data-tone={item.tone} aria-hidden="true">
                  <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d={ICONS[item.icon]} />
                  </svg>
                </span>
                <span className="ka-todo__text">
                  <span className="ka-todo__title">
                    {item.title}
                    {item.urgent && (
                      <StatusBadge tone="danger" live>
                        {item.urgent}
                      </StatusBadge>
                    )}
                  </span>
                  <span className="ka-todo__cap">
                    {item.hint}
                    {overdueInPickup && item.key === "store_orders_to_pickup" ? ` · เลยกำหนด ${count(pickupsOverdue ?? 0)}` : ""}
                  </span>
                </span>
                <span className="ka-todo__count numeric">{count(work[item.key] ?? 0)}</span>
                <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true" className="ka-todo__chev">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open.length === 0 && (
        <p className="ka-todo__zero">
          <Check />
          <span>ไม่มีงานค้างที่รอทำ</span>
        </p>
      )}
      {empty.length > 0 && open.length > 0 && (
        <p className="ka-todo__zero">
          <Check />
          <span>ไม่มีงานค้าง: {empty.map((item) => item.short ?? item.title).join(" · ")}</span>
        </p>
      )}
    </section>
  );
}
