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
  unit: string;
  hint: string;
  /** What the date column means for this list. */
  dateLabel: string;
}

// Each count opens the rows behind it; `href` is the page where that work is done.
const ITEMS: Item[] = [
  {
    key: "sale_orders_to_approve",
    href: "/admin/sale-orders",
    title: "ใบขายรออนุมัติ",
    unit: "ใบ",
    hint: "ไม่นับใบที่รอลูกค้าจ่ายเงิน",
    dateLabel: "วันที่สร้าง",
  },
  {
    key: "store_orders_to_review",
    href: "/admin/store-fulfillment",
    title: "คำสั่งซื้อหน้าร้านที่รอตรวจ",
    unit: "คำสั่งซื้อ",
    hint: "ชำระเงินหลังหมดเวลา",
    dateLabel: "วันที่สั่งซื้อ",
  },
  {
    key: "store_cancellations_to_decide",
    href: "/admin/store-fulfillment",
    title: "คำขอยกเลิกรอพิจารณา",
    unit: "คำขอ",
    hint: "พักส่งและส่งมอบไว้จนกว่าจะพิจารณา",
    dateLabel: "วันที่ขอยกเลิก",
  },
  {
    key: "store_refunds_unfinished",
    href: "/admin/store-fulfillment",
    title: "เงินคืนที่ยังไม่เสร็จ",
    unit: "คำสั่งซื้อ",
    hint: "คืนไม่สำเร็จ ต้องโอนคืน หรือรอปิดคำสั่งซื้อ",
    dateLabel: "วันที่สั่งซื้อ",
  },
  {
    key: "store_orders_to_ship",
    href: "/admin/store-fulfillment",
    title: "รอจัดส่ง",
    unit: "คำสั่งซื้อ",
    hint: "ชำระแล้ว สินค้ายังไม่ส่ง ไม่นับที่รอค่าจัดส่ง",
    dateLabel: "วันที่สั่งซื้อ",
  },
  {
    key: "store_shipping_unpaid",
    href: "/admin/store-fulfillment",
    title: "รอลูกค้าชำระค่าจัดส่ง",
    unit: "คำสั่งซื้อ",
    hint: "สร้างพัสดุได้เมื่อลูกค้าชำระแล้ว",
    dateLabel: "วันที่แจ้งค่าจัดส่ง",
  },
  {
    key: "store_orders_to_pickup",
    href: "/admin/store-fulfillment",
    title: "รอรับที่ร้าน",
    unit: "คำสั่งซื้อ",
    hint: "ชำระแล้ว ลูกค้ายังไม่มารับ",
    dateLabel: "วันที่สั่งซื้อ",
  },
  {
    key: "store_pickups_overdue",
    href: "/admin/store-fulfillment",
    title: "รับที่ร้านเลยกำหนด",
    unit: "คำสั่งซื้อ",
    hint: "เป็นส่วนหนึ่งของ “รอรับที่ร้าน” ที่เลยวันนัดรับแล้ว",
    dateLabel: "กำหนดรับ",
  },
  {
    key: "contact_requests_new",
    href: "/admin/contact-requests",
    title: "คำขอติดต่อกลับใหม่",
    unit: "รายการ",
    hint: "ยังไม่มีใครติดต่อ",
    dateLabel: "วันที่ส่งคำขอ",
  },
  {
    key: "purchase_orders_to_approve",
    href: "/admin/purchase-orders",
    title: "ใบสั่งซื้อรออนุมัติ",
    unit: "ใบ",
    hint: "ดูใบสั่งซื้อ",
    dateLabel: "วันที่สั่งซื้อ",
  },
];

/**
 * Work waiting for an employee. Only the counts the API returned are drawn, so
 * a count the employee may not see leaves no empty card behind.
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

  return (
    <section aria-labelledby="dashboard-pending" className="mb-6">
      <h2
        id="dashboard-pending"
        className="mb-3 text-[19px] font-semibold text-[var(--ink)]"
      >
        งานที่รอทำ
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-haspopup="dialog"
            onClick={() =>
              onOpen({
                key: item.key,
                title: item.title,
                href: item.href,
                dateLabel: item.dateLabel,
              })
            }
            className="ka-card ka-card--link ka-stat block w-full text-left"
          >
            <span className="ka-stat__label">{item.title}</span>
            <p className="ka-stat__value">
              {count(work[item.key] ?? 0)}
              <span className="ml-2 text-[14px] font-normal text-[var(--ink-muted)]">
                {item.unit}
              </span>
            </p>
            <p className="ka-stat__foot">{item.hint}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
