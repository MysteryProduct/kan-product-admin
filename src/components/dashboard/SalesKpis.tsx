import type { ReactNode } from 'react';
import { formatBaht } from '@/components/charts/scale';
import type { OpenList } from '@/components/dashboard/DashboardListModal';
import type { PeriodPreset } from '@/components/dashboard/salesPeriod';
import type { SalesSummary } from '@/types/dashboard';

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

type Period = NonNullable<SalesSummary['period']>;

/** The rows behind a figure exist only for today and this month (TASK-0317 Q2); other periods are numbers only. */
const LISTS: Partial<Record<PeriodPreset, { received: OpenList; approved: OpenList; storeOrders: OpenList }>> = {
  today: {
    received: { key: 'sales_received_today', title: 'ใบเสร็จรับเงินวันนี้ (รวมใบคืนเงิน)', href: '/admin/payment-receipts', dateLabel: 'วันที่ชำระ' },
    approved: { key: 'sales_approved_today', title: 'ใบขายที่อนุมัติวันนี้', href: '/admin/sale-orders', dateLabel: 'วันที่อนุมัติ' },
    storeOrders: { key: 'sales_store_orders_today', title: 'คำสั่งซื้อหน้าร้านที่ชำระแล้ววันนี้', href: '/admin/store-fulfillment', dateLabel: 'วันที่ชำระ' },
  },
  month: {
    received: { key: 'sales_received_month', title: 'ใบเสร็จรับเงินเดือนนี้ (รวมใบคืนเงิน)', href: '/admin/payment-receipts', dateLabel: 'วันที่ชำระ' },
    approved: { key: 'sales_approved_month', title: 'ใบขายที่อนุมัติเดือนนี้', href: '/admin/sale-orders', dateLabel: 'วันที่อนุมัติ' },
    storeOrders: { key: 'sales_store_orders_month', title: 'คำสั่งซื้อหน้าร้านที่ชำระแล้วเดือนนี้', href: '/admin/store-fulfillment', dateLabel: 'วันที่ชำระ' },
  },
};

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24', 'aria-hidden': true } as const;

interface KpiProps {
  label: string;
  icon: ReactNode;
  value: string;
  note: string;
  /** Opens the rows behind the figure when there are any for this period. */
  list?: OpenList;
  onOpen: (list: OpenList) => void;
}

function Kpi({ label, icon, value, note, list, onOpen }: KpiProps) {
  return (
    <section className="ka-card ka-kpi" aria-label={label}>
      <div className="ka-kpi__top">
        <h2 className="ka-kpi__label">{label}</h2>
        <span className="ka-stat__icon">{icon}</span>
      </div>
      {list ? (
        <button type="button" aria-haspopup="dialog" aria-label={`${list.title}: ดูรายการ`} onClick={() => onOpen(list)} className="ka-kpi__value numeric ka-kpi__open">
          {value}
        </button>
      ) : (
        <p className="ka-kpi__value numeric">{value}</p>
      )}
      <p className="ka-kpi__note">{note}</p>
    </section>
  );
}

/**
 * The four figures of the chosen period. A figure the employee may not see leaves no card behind;
 * the average is the approved total over the number of orders, so it needs both.
 */
export default function SalesKpis({ period, preset, onOpen }: { period: Period; preset: PeriodPreset; onOpen: (list: OpenList) => void }) {
  const { received, approved, store_orders: storeOrders } = period;
  const lists = LISTS[preset];

  return (
    <div className="ka-kpis">
      {received && (
        <Kpi
          label="รับชำระสุทธิ"
          icon={
            <svg {...iconProps}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          value={formatBaht(received.net)}
          note={`หลังหักคืนเงิน ${formatBaht(received.refunded)}`}
          list={lists?.received}
          onOpen={onOpen}
        />
      )}
      {approved && (
        <Kpi
          label="ใบขายที่อนุมัติ"
          icon={
            <svg {...iconProps}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          value={formatBaht(approved.amount)}
          note={`${count(approved.count)} ใบ · ยังไม่หักที่ยกเลิกหรือคืนภายหลัง`}
          list={lists?.approved}
          onOpen={onOpen}
        />
      )}
      {storeOrders !== undefined && (
        <Kpi
          label="คำสั่งซื้อหน้าร้าน"
          icon={
            <svg {...iconProps}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          }
          value={count(storeOrders)}
          note="ชำระแล้ว นับตามวันที่ชำระครั้งแรก"
          list={lists?.storeOrders}
          onOpen={onOpen}
        />
      )}
      {approved && (
        <Kpi
          label="เฉลี่ยต่อใบขาย"
          icon={
            <svg {...iconProps}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h3M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
          }
          value={approved.count > 0 ? formatBaht(Math.round((approved.amount / approved.count) * 100) / 100) : '-'}
          note={approved.count > 0 ? 'ยอดอนุมัติ ÷ จำนวนใบ' : 'ยังไม่มีใบขายที่อนุมัติในช่วงนี้'}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}
