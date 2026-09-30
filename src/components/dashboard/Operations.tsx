import Link from 'next/link';
import type { Operations as OperationsData } from '@/types/dashboard';

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-[var(--ink-muted)]">{label}</dt>
      <dd className="ka-stat__value">{count(value)}</dd>
    </div>
  );
}

/** A late count is worded, not just coloured, so the state does not rest on colour alone. */
function Late({ label, value }: { label: string; value: number }) {
  return (
    <p className="mt-3 flex items-center gap-2 text-[14px] text-[var(--ink)]">
      <span className={`ka-badge ${value > 0 ? 'ka-badge--danger' : 'ka-badge--success'}`}>{label}</span>
      <span className="font-semibold">{count(value)}</span>
    </p>
  );
}

/**
 * Production and purchasing. Only the blocks the API returned are drawn, so a
 * block the employee may not see leaves no empty card behind.
 */
export default function Operations({ operations }: { operations: OperationsData }) {
  const { job_orders: jobs, purchase_orders_to_receive: toReceive, supplier_invoices: invoices } = operations;
  if (!jobs && toReceive === undefined && !invoices) return null;

  return (
    <section aria-labelledby="dashboard-operations" className="mb-6">
      <h2 id="dashboard-operations" className="mb-3 text-[19px] font-semibold text-[var(--ink)]">
        งานผลิตและจัดซื้อ
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {jobs && (
          <Link href="/admin/job-orders" className="ka-card ka-card--link ka-stat block">
            <span className="ka-stat__label">งานผลิตแยกตามสถานะ</span>
            <dl className="mt-2 grid grid-cols-2 gap-4">
              <Stat label="รอดำเนินการ" value={jobs.pending} />
              <Stat label="กำลังผลิต" value={jobs.in_progress} />
              <Stat label="ผลิตเสร็จแล้ว" value={jobs.completed} />
              <Stat label="ยกเลิกการผลิต" value={jobs.cancelled} />
            </dl>
            <Late label="เลยกำหนด" value={jobs.overdue} />
            <p className="ka-stat__foot">เลยกำหนด = ยังไม่เสร็จและเลยวันที่เป้าหมาย (รวมงานทั้งหมด {count(jobs.all)} งาน)</p>
          </Link>
        )}
        {toReceive !== undefined && (
          <Link href="/admin/purchase-orders" className="ka-card ka-card--link ka-stat block">
            <span className="ka-stat__label">ใบสั่งซื้อรอรับสินค้า</span>
            <p className="ka-stat__value">
              {count(toReceive)}
              <span className="ml-2 text-[14px] font-normal text-[var(--ink-muted)]">ใบ</span>
            </p>
            <p className="ka-stat__foot">อนุมัติแล้ว ยังรับสินค้าไม่ครบ</p>
          </Link>
        )}
        {invoices && (
          <Link href="/admin/invoice-supplier" className="ka-card ka-card--link ka-stat block">
            <span className="ka-stat__label">ใบแจ้งหนี้ผู้จัดจำหน่ายที่ยังไม่จ่ายครบ</span>
            <p className="ka-stat__value">
              {count(invoices.unpaid)}
              <span className="ml-2 text-[14px] font-normal text-[var(--ink-muted)]">ใบ</span>
            </p>
            <Late label="เลยกำหนด" value={invoices.overdue} />
            <p className="mt-2 flex items-center gap-2 text-[14px] text-[var(--ink)]">
              <span className={`ka-badge ${invoices.due_soon > 0 ? 'ka-badge--warning' : 'ka-badge--success'}`}>
                ใกล้ครบกำหนด
              </span>
              <span className="font-semibold">{count(invoices.due_soon)}</span>
            </p>
            <p className="ka-stat__foot">ใกล้ครบกำหนด = ครบกำหนดภายใน 7 วัน</p>
          </Link>
        )}
      </div>
    </section>
  );
}
