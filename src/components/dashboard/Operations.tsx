import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import type { OpenList } from "@/components/dashboard/DashboardListModal";
import type {
  DashboardListKey,
  Operations as OperationsData,
} from "@/types/dashboard";

const count = (value: number) => new Intl.NumberFormat("th-TH").format(value);

interface Target {
  key: DashboardListKey;
  title: string;
  href: string;
  dateLabel?: string;
}

const JOBS = { href: "/admin/job-orders", dateLabel: "วันที่เป้าหมาย" };
const INVOICES = { href: "/admin/invoice-supplier", dateLabel: "ครบกำหนด" };

const TARGETS = {
  pending: {
    key: "job_orders_pending",
    title: "งานผลิต: รอดำเนินการ",
    ...JOBS,
  },
  in_progress: {
    key: "job_orders_in_progress",
    title: "งานผลิต: กำลังผลิต",
    ...JOBS,
  },
  completed: {
    key: "job_orders_completed",
    title: "งานผลิต: ผลิตเสร็จแล้ว",
    ...JOBS,
  },
  cancelled: {
    key: "job_orders_cancelled",
    title: "งานผลิต: ยกเลิกการผลิต",
    ...JOBS,
  },
  overdue: { key: "job_orders_overdue", title: "งานผลิตที่เลยกำหนด", ...JOBS },
  toReceive: {
    key: "purchase_orders_to_receive",
    title: "ใบสั่งซื้อรอรับสินค้า",
    href: "/admin/purchase-orders",
    dateLabel: "วันที่สั่งซื้อ",
  },
  unpaid: {
    key: "supplier_invoices_unpaid",
    title: "ใบแจ้งหนี้ที่ยังไม่จ่ายครบ",
    ...INVOICES,
  },
  invoiceOverdue: {
    key: "supplier_invoices_overdue",
    title: "ใบแจ้งหนี้ที่เลยกำหนด",
    ...INVOICES,
  },
  dueSoon: {
    key: "supplier_invoices_due_soon",
    title: "ใบแจ้งหนี้ที่ใกล้ครบกำหนด (ภายใน 7 วัน)",
    ...INVOICES,
  },
} satisfies Record<string, Target>;

interface OpenProps {
  onOpen: (list: OpenList) => void;
}

/** A number that opens the rows behind it. */
function NumberButton({
  target,
  value,
  onOpen,
  className = "ka-stat__value",
  label,
}: {
  target: Target;
  value: number;
  onOpen: OpenProps["onOpen"];
  className?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`${label} ${count(value)} ดูรายการ`}
      onClick={() => onOpen(target)}
      className={`${className} text-left underline-offset-4 hover:underline`}
    >
      {count(value)}
    </button>
  );
}

/** A late count is worded, not just coloured, so the state does not rest on colour alone. */
function Late({
  label,
  value,
  target,
  tone,
  onOpen,
}: {
  label: string;
  value: number;
  target: Target;
  tone: "danger" | "warning";
  onOpen: OpenProps["onOpen"];
}) {
  return (
    <p className="mt-3 flex items-center gap-2 text-[14px] text-[var(--ink)]">
      <span
        className={`ka-badge ${value > 0 ? `ka-badge--${tone}` : "ka-badge--success"}`}
      >
        {label}
      </span>
      <NumberButton
        target={target}
        value={value}
        onOpen={onOpen}
        label={label}
        className="font-semibold"
      />
    </p>
  );
}

const SEGMENTS = [
  { id: "pending", label: "รอ", tone: "warning" },
  { id: "in_progress", label: "กำลังผลิต", tone: "info" },
  { id: "completed", label: "เสร็จ", tone: "success" },
  { id: "cancelled", label: "ยกเลิก", tone: "danger" },
] as const;

/**
 * Production and purchasing. Only the blocks the API returned are drawn, so a
 * block the employee may not see leaves no empty card behind. Every number
 * opens the rows behind it.
 */
export default function Operations({
  operations,
  onOpen,
  show = "both",
}: { operations: OperationsData; /** The page places production beside the work list and purchasing in the stock row. */ show?: "production" | "purchasing" | "both" } & OpenProps) {
  const {
    job_orders: jobs,
    purchase_orders_to_receive: toReceive,
    supplier_invoices: invoices,
  } = operations;
  const hasPurchasing = show !== "production" && (toReceive !== undefined || Boolean(invoices));
  const hasProduction = show !== "purchasing" && Boolean(jobs);
  if (!hasProduction && !hasPurchasing) return null;

  const total = jobs ? SEGMENTS.reduce((sum, segment) => sum + jobs[segment.id], 0) : 0;

  return (
    <>
      {hasProduction && jobs && (
        <section className="ka-card ka-panel" aria-labelledby="dashboard-production">
          <div className="ka-panel__head">
            <h2 id="dashboard-production" className="ka-card__title">งานผลิต</h2>
            {jobs.overdue > 0 ? (
              <StatusBadge tone="danger">เลยกำหนด {count(jobs.overdue)} งาน</StatusBadge>
            ) : (
              <StatusBadge tone="success">ไม่มีงานเลยกำหนด</StatusBadge>
            )}
          </div>
          <p className="ka-panel__figure numeric">
            {count(jobs.all)}
            <span>งานทั้งหมด</span>
          </p>
          <div
            className="ka-stack"
            role="img"
            aria-label={SEGMENTS.map((segment) => `${segment.label} ${count(jobs[segment.id])}`).join(" ")}
          >
            {total > 0 &&
              SEGMENTS.map((segment) =>
                jobs[segment.id] > 0 ? (
                  <span key={segment.id} data-tone={segment.tone} style={{ flexGrow: jobs[segment.id] }} />
                ) : null,
              )}
          </div>
          <ul className="ka-legend">
            {SEGMENTS.map((segment) => (
              <li key={segment.id} data-tone={segment.tone}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`${segment.label} ${count(jobs[segment.id])} ดูรายการ`}
                  onClick={() => onOpen(TARGETS[segment.id])}
                >
                  <i aria-hidden="true" />
                  {segment.label} <span className="numeric">{count(jobs[segment.id])}</span>
                </button>
              </li>
            ))}
          </ul>
          {jobs.overdue > 0 && (
            <Late label="เลยกำหนด" value={jobs.overdue} target={TARGETS.overdue} tone="danger" onOpen={onOpen} />
          )}
          <Link href="/admin/job-orders" className="ka-panel__link">เปิดบอร์ดงานผลิต →</Link>
        </section>
      )}
      {hasPurchasing && (
        <section className="ka-card ka-panel" aria-labelledby="dashboard-purchasing">
          <h2 id="dashboard-purchasing" className="ka-card__title">จัดซื้อ</h2>
          <dl className="ka-kv">
            {toReceive !== undefined && (
              <div>
                <dt>ใบสั่งซื้อรอรับสินค้า</dt>
                <dd>
                  <NumberButton target={TARGETS.toReceive} value={toReceive} onOpen={onOpen} label="ใบสั่งซื้อรอรับสินค้า" className="numeric" />
                </dd>
              </div>
            )}
            {invoices && (
              <>
                <div>
                  <dt>ใบแจ้งหนี้ค้างจ่าย</dt>
                  <dd>
                    <NumberButton target={TARGETS.unpaid} value={invoices.unpaid} onOpen={onOpen} label="ใบแจ้งหนี้ค้างจ่าย" className="numeric" />
                  </dd>
                </div>
                {/* Not on the artboard, whose figures are 0; an overdue invoice is never hidden (TASK-0321 D5). */}
                {invoices.overdue > 0 && (
                  <div>
                    <dt>เลยกำหนดชำระ</dt>
                    <dd>
                      <NumberButton target={TARGETS.invoiceOverdue} value={invoices.overdue} onOpen={onOpen} label="ใบแจ้งหนี้เลยกำหนดชำระ" className="numeric" />
                    </dd>
                  </div>
                )}
                <div>
                  <dt>ใกล้ครบกำหนด (7 วัน)</dt>
                  <dd>
                    <NumberButton target={TARGETS.dueSoon} value={invoices.due_soon} onOpen={onOpen} label="ใบแจ้งหนี้ใกล้ครบกำหนด" className="numeric" />
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}
    </>
  );
}
