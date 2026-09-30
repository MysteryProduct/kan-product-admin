import type { OpenList } from '@/components/dashboard/DashboardListModal';
import type { DashboardListKey, PendingWork as PendingWorkData } from '@/types/dashboard';

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

interface Item {
  key: DashboardListKey;
  href: string;
  title: string;
  unit: string;
  hint: string;
}

// Each count opens the rows behind it; `href` is the page where that work is done.
const ITEMS: Item[] = [
  { key: 'sale_orders_to_approve', href: '/admin/sale-orders', title: 'ใบขายรออนุมัติ', unit: 'ใบ', hint: 'ไม่นับใบที่รอลูกค้าจ่ายเงิน' },
  { key: 'store_orders_to_review', href: '/admin/store-fulfillment', title: 'คำสั่งซื้อหน้าร้านที่รอตรวจ', unit: 'คำสั่งซื้อ', hint: 'ชำระเงินหลังหมดเวลา' },
  { key: 'store_orders_to_ship', href: '/admin/store-fulfillment', title: 'รอจัดส่ง', unit: 'คำสั่งซื้อ', hint: 'ชำระแล้ว สินค้ายังไม่ส่ง' },
  { key: 'store_orders_to_pickup', href: '/admin/store-fulfillment', title: 'รอรับที่ร้าน', unit: 'คำสั่งซื้อ', hint: 'ชำระแล้ว ลูกค้ายังไม่มารับ' },
  { key: 'contact_requests_new', href: '/admin/contact-requests', title: 'คำขอติดต่อกลับใหม่', unit: 'รายการ', hint: 'ยังไม่มีใครติดต่อ' },
  { key: 'purchase_orders_to_approve', href: '/admin/purchase-orders', title: 'ใบสั่งซื้อรออนุมัติ', unit: 'ใบ', hint: 'ดูใบสั่งซื้อ' },
];

/**
 * Work waiting for an employee. Only the counts the API returned are drawn, so
 * a count the employee may not see leaves no empty card behind.
 */
export default function PendingWork({ work, onOpen }: { work: PendingWorkData; onOpen: (list: OpenList) => void }) {
  const visible = ITEMS.filter((item) => work[item.key] !== undefined);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="dashboard-pending" className="mb-6">
      <h2 id="dashboard-pending" className="mb-3 text-[19px] font-semibold text-[var(--ink)]">
        งานที่รอทำ
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-haspopup="dialog"
            onClick={() => onOpen({ key: item.key, title: item.title, href: item.href })}
            className="ka-card ka-card--link ka-stat block w-full text-left"
          >
            <span className="ka-stat__label">{item.title}</span>
            <p className="ka-stat__value">
              {count(work[item.key] ?? 0)}
              <span className="ml-2 text-[14px] font-normal text-[var(--ink-muted)]">{item.unit}</span>
            </p>
            <p className="ka-stat__foot">{item.hint}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
