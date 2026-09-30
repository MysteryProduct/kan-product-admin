import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SalesSummary as SalesSummaryData } from '@/types/dashboard';

const baht = (value: number) =>
  `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

interface MetricCardProps {
  href: string;
  title: string;
  hint: string;
  icon: ReactNode;
  today: ReactNode;
  month: ReactNode;
  todayNote?: string;
  monthNote?: string;
}

function MetricCard({ href, title, hint, icon, today, month, todayNote, monthNote }: MetricCardProps) {
  return (
    <Link href={href} className="ka-card ka-card--link ka-stat block">
      <div className="ka-stat__top">
        <span className="ka-stat__label">{title}</span>
        <span className="ka-stat__icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <dt className="text-[13px] text-[var(--ink-muted)]">วันนี้</dt>
          <dd className="ka-stat__value break-words">{today}</dd>
          {todayNote && <p className="ka-stat__foot">{todayNote}</p>}
        </div>
        <div className="min-w-0">
          <dt className="text-[13px] text-[var(--ink-muted)]">เดือนนี้</dt>
          <dd className="ka-stat__value break-words">{month}</dd>
          {monthNote && <p className="ka-stat__foot">{monthNote}</p>}
        </div>
      </dl>
      <p className="ka-stat__foot">{hint}</p>
    </Link>
  );
}

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24' } as const;

/**
 * Sales and receipts for today and this month (Asia/Bangkok). Only the blocks
 * the API returned are drawn, so a block the employee may not see leaves no
 * empty card behind.
 */
export default function SalesSummary({ sales }: { sales: SalesSummaryData }) {
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
            today={baht(received.today.net)}
            month={baht(received.month.net)}
            todayNote={`คืนเงิน ${baht(received.today.refunded)}`}
            monthNote={`คืนเงิน ${baht(received.month.refunded)}`}
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
            today={baht(approved.today.amount)}
            month={baht(approved.month.amount)}
            todayNote={`${count(approved.today.count)} ใบ`}
            monthNote={`${count(approved.month.count)} ใบ`}
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
            today={count(storeOrders.today)}
            month={count(storeOrders.month)}
            todayNote="คำสั่งซื้อ"
            monthNote="คำสั่งซื้อ"
          />
        )}
      </div>
    </section>
  );
}
