import Link from 'next/link';
import type { ReactNode } from 'react';
import type { OpenList } from '@/components/dashboard/DashboardListModal';
import type { DashboardListKey, SalesSummary as SalesSummaryData } from '@/types/dashboard';

const baht = (value: number) =>
  `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

interface Period {
  /** The number as shown. */
  value: ReactNode;
  note?: string;
  list: OpenList;
}

interface MetricCardProps {
  href: string;
  title: string;
  hint: string;
  icon: ReactNode;
  today: Period;
  month: Period;
  onOpen: (list: OpenList) => void;
}

/** One number of a card: the figure opens the rows behind it. */
function PeriodStat({ label, period, onOpen }: { label: string; period: Period; onOpen: (list: OpenList) => void }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-[var(--ink-muted)]">{label}</dt>
      <dd>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${period.list.title}: ดูรายการ`}
          onClick={() => onOpen(period.list)}
          className="ka-stat__value break-words text-left underline-offset-4 hover:underline"
        >
          {period.value}
        </button>
      </dd>
      {period.note && <p className="ka-stat__foot">{period.note}</p>}
    </div>
  );
}

function MetricCard({ href, title, hint, icon, today, month, onOpen }: MetricCardProps) {
  return (
    <div className="ka-card ka-stat">
      <div className="ka-stat__top">
        <span className="ka-stat__label">{title}</span>
        <span className="ka-stat__icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-4">
        <PeriodStat label="วันนี้" period={today} onOpen={onOpen} />
        <PeriodStat label="เดือนนี้" period={month} onOpen={onOpen} />
      </dl>
      <Link href={href} className="ka-stat__foot inline-block underline-offset-4 hover:underline">
        {hint}
      </Link>
    </div>
  );
}

/** What a list is called and which page it belongs to; the same for today and the month. */
const target = (key: DashboardListKey, title: string, href: string, dateLabel: string): OpenList => ({ key, title, href, dateLabel });

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24' } as const;

/**
 * Sales and receipts for today and this month (Asia/Bangkok). Only the blocks
 * the API returned are drawn, so a block the employee may not see leaves no
 * empty card behind.
 */
export default function SalesSummary({ sales, onOpen }: { sales: SalesSummaryData; onOpen: (list: OpenList) => void }) {
  const { received, approved, store_orders: storeOrders } = sales;

  return (
    <section aria-labelledby="dashboard-sales" className="mb-6">
      <h2 id="dashboard-sales" className="mb-3 text-[19px] font-semibold text-[var(--ink)]">
        ยอดขายและรับชำระ
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {received && (
          <MetricCard
            href="/admin/payment-receipts"
            title="ยอดที่รับชำระจริง (สุทธิหลังคืนเงิน)"
            hint="ดูใบเสร็จรับเงิน"
            icon={
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            today={{
              value: baht(received.today.net),
              note: `คืนเงิน ${baht(received.today.refunded)}`,
              list: target('sales_received_today', 'ใบเสร็จรับเงินวันนี้ (รวมใบคืนเงิน)', '/admin/payment-receipts', 'วันที่ชำระ'),
            }}
            month={{
              value: baht(received.month.net),
              note: `คืนเงิน ${baht(received.month.refunded)}`,
              list: target('sales_received_month', 'ใบเสร็จรับเงินเดือนนี้ (รวมใบคืนเงิน)', '/admin/payment-receipts', 'วันที่ชำระ'),
            }}
            onOpen={onOpen}
          />
        )}
        {approved && (
          <MetricCard
            href="/admin/sale-orders"
            title="ยอดใบขายที่อนุมัติ (ยังไม่หักใบที่ยกเลิกหรือคืนภายหลัง)"
            hint="ดูใบขายสินค้า"
            icon={
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            today={{
              value: baht(approved.today.amount),
              note: `${count(approved.today.count)} ใบ`,
              list: target('sales_approved_today', 'ใบขายที่อนุมัติวันนี้', '/admin/sale-orders', 'วันที่อนุมัติ'),
            }}
            month={{
              value: baht(approved.month.amount),
              note: `${count(approved.month.count)} ใบ`,
              list: target('sales_approved_month', 'ใบขายที่อนุมัติเดือนนี้', '/admin/sale-orders', 'วันที่อนุมัติ'),
            }}
            onOpen={onOpen}
          />
        )}
        {storeOrders && (
          <MetricCard
            href="/admin/store-fulfillment"
            title="คำสั่งซื้อหน้าร้านที่ชำระแล้ว"
            hint="ดูจัดส่งพัสดุ"
            icon={
              <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
            today={{
              value: count(storeOrders.today),
              note: 'คำสั่งซื้อ',
              list: target('sales_store_orders_today', 'คำสั่งซื้อหน้าร้านที่ชำระแล้ววันนี้', '/admin/store-fulfillment', 'วันที่ชำระ'),
            }}
            month={{
              value: count(storeOrders.month),
              note: 'คำสั่งซื้อ',
              list: target('sales_store_orders_month', 'คำสั่งซื้อหน้าร้านที่ชำระแล้วเดือนนี้', '/admin/store-fulfillment', 'วันที่ชำระ'),
            }}
            onOpen={onOpen}
          />
        )}
      </div>
    </section>
  );
}
