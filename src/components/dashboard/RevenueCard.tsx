import Link from "next/link";
import { formatBaht } from "@/components/charts/scale";
import type { SalesDashboard } from "@/types/dashboard";

const count = (value: number) => new Intl.NumberFormat("th-TH").format(value);

const monthLabel = () =>
  new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());

/**
 * This month's money received, from the same figures as the sales dashboard. It is drawn only when the
 * API sent them, so an employee without that permission sees no empty card.
 */
export default function RevenueCard({ sales }: { sales: NonNullable<SalesDashboard["sales"]> }) {
  const { received, approved } = sales;
  if (!received) return null;

  return (
    <section className="ka-card ka-panel" aria-labelledby="dashboard-revenue">
      <div className="ka-panel__head">
        <h2 id="dashboard-revenue" className="ka-card__title">รับชำระเดือนนี้</h2>
        <span className="ka-todo__cap">{monthLabel()}</span>
      </div>
      <p className="ka-panel__stat numeric">{formatBaht(received.month.net)}</p>
      <p className="ka-panel__note">
        สุทธิหลังคืนเงิน
        {approved ? ` · ใบขายอนุมัติ ${count(approved.month.count)} ใบ` : ""}
      </p>
      <dl className="ka-kv">
        <div>
          <dt>วันนี้</dt>
          <dd className="numeric">{formatBaht(received.today.net)}</dd>
        </div>
        <div>
          <dt>คืนเงินเดือนนี้</dt>
          <dd className="numeric">{formatBaht(received.month.refunded)}</dd>
        </div>
      </dl>
      <Link href="/admin/sales-dashboard" className="ka-panel__link">
        ดูยอดขายทั้งหมด →
      </Link>
    </section>
  );
}
