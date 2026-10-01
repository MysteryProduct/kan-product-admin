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

function Stat({
  label,
  value,
  target,
  onOpen,
}: {
  label: string;
  value: number;
  target: Target;
  onOpen: OpenProps["onOpen"];
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-[var(--ink-muted)]">{label}</dt>
      <dd>
        <NumberButton
          target={target}
          value={value}
          onOpen={onOpen}
          label={label}
        />
      </dd>
    </div>
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

/**
 * Production and purchasing. Only the blocks the API returned are drawn, so a
 * block the employee may not see leaves no empty card behind. Every number
 * opens the rows behind it.
 */
export default function Operations({
  operations,
  onOpen,
}: { operations: OperationsData } & OpenProps) {
  const {
    job_orders: jobs,
    purchase_orders_to_receive: toReceive,
    supplier_invoices: invoices,
  } = operations;
  if (!jobs && toReceive === undefined && !invoices) return null;

  return (
    <section aria-labelledby="dashboard-operations" className="mb-6">
      <h2
        id="dashboard-operations"
        className="mb-3 text-[19px] font-semibold text-[var(--ink)]"
      >
        งานผลิตและจัดซื้อ
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {jobs && (
          <div className="ka-card ka-stat">
            <span className="ka-stat__label">งานผลิตแยกตามสถานะ</span>
            <dl className="mt-2 grid grid-cols-2 gap-4">
              <Stat
                label="รอดำเนินการ"
                value={jobs.pending}
                target={TARGETS.pending}
                onOpen={onOpen}
              />
              <Stat
                label="กำลังผลิต"
                value={jobs.in_progress}
                target={TARGETS.in_progress}
                onOpen={onOpen}
              />
              <Stat
                label="ผลิตเสร็จแล้ว"
                value={jobs.completed}
                target={TARGETS.completed}
                onOpen={onOpen}
              />
              <Stat
                label="ยกเลิกการผลิต"
                value={jobs.cancelled}
                target={TARGETS.cancelled}
                onOpen={onOpen}
              />
            </dl>
            <Late
              label="เลยกำหนด"
              value={jobs.overdue}
              target={TARGETS.overdue}
              tone="danger"
              onOpen={onOpen}
            />
            <p className="ka-stat__foot">
              เลยกำหนด = ยังไม่เสร็จและเลยวันที่เป้าหมาย (รวมงานทั้งหมด{" "}
              {count(jobs.all)} งาน)
            </p>
          </div>
        )}
        {toReceive !== undefined && (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => onOpen(TARGETS.toReceive)}
            className="ka-card ka-card--link ka-stat block w-full text-left"
          >
            <span className="ka-stat__label">ใบสั่งซื้อรอรับสินค้า</span>
            <p className="ka-stat__value">
              {count(toReceive)}
              <span className="ml-2 text-[14px] font-normal text-[var(--ink-muted)]">
                ใบ
              </span>
            </p>
            <p className="ka-stat__foot">อนุมัติแล้ว ยังรับสินค้าไม่ครบ</p>
          </button>
        )}
        {invoices && (
          <div className="ka-card ka-stat">
            <span className="ka-stat__label">
              ใบแจ้งหนี้ผู้จัดจำหน่ายที่ยังไม่จ่ายครบ
            </span>
            <p className="ka-stat__value">
              <NumberButton
                target={TARGETS.unpaid}
                value={invoices.unpaid}
                onOpen={onOpen}
                label="ยังไม่จ่ายครบ"
                className=""
              />
              <span className="ml-2 text-[14px] font-normal text-[var(--ink-muted)]">
                ใบ
              </span>
            </p>
            <Late
              label="เลยกำหนด"
              value={invoices.overdue}
              target={TARGETS.invoiceOverdue}
              tone="danger"
              onOpen={onOpen}
            />
            <Late
              label="ใกล้ครบกำหนด"
              value={invoices.due_soon}
              target={TARGETS.dueSoon}
              tone="warning"
              onOpen={onOpen}
            />
            <p className="ka-stat__foot">ใกล้ครบกำหนด = ครบกำหนดภายใน 7 วัน</p>
          </div>
        )}
      </div>
    </section>
  );
}
