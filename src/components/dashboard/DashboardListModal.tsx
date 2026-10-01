"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import StatusBadge, { type BadgeTone } from "@/components/StatusBadge";
import LoadErrorBanner, { loadErrorText } from "@/components/LoadErrorBanner";
import RecordDetail, {
  OPENABLE_KINDS,
} from "@/components/dashboard/RecordDetail";
import DashboardModel from "@/models/dashboard";
import { formatThaiDate } from "@/lib/date-format";
import {
  CONTACT_REQUEST_STATUS_TONE,
  INVOICE_SUPPLIER_STATUS_TONE,
  PURCHASE_ORDER_STATUS_TONE,
  SALE_ORDER_STATUS_TONE,
} from "@/lib/status-tones";
import { INVOICE_STATUS_LABELS } from "@/types/invoice-supplier";
import type {
  DashboardList,
  DashboardListKey,
  DashboardListKind,
  DashboardListRow,
} from "@/types/dashboard";

const dashboardModel = new DashboardModel();

const baht = (value: number) =>
  `฿${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

// The statuses these lists can hold, in words and tone, by what the row is (the
// same word can mean different things: "pending" of an order or of a job).
const STATUS_VIEWS: Partial<
  Record<DashboardListKind, Record<string, { label: string; tone: BadgeTone }>>
> = {
  sale_order: {
    pending: { label: "รออนุมัติ", tone: SALE_ORDER_STATUS_TONE.pending },
  },
  purchase_order: {
    pending: { label: "รออนุมัติ", tone: PURCHASE_ORDER_STATUS_TONE.pending },
    active: {
      label: "อนุมัติแล้ว รอรับสินค้า",
      tone: PURCHASE_ORDER_STATUS_TONE.active,
    },
    partial: {
      label: "รับสินค้าบางส่วน",
      tone: PURCHASE_ORDER_STATUS_TONE.partial,
    },
  },
  store_order: {
    awaiting_review: { label: "รอตรวจ", tone: "warning" },
    paid: { label: "ชำระแล้ว", tone: "success" },
  },
  contact_request: {
    new: { label: "ใหม่", tone: CONTACT_REQUEST_STATUS_TONE.new },
  },
  job_order: {
    pending: { label: "รอดำเนินการ", tone: "warning" },
    in_progress: { label: "กำลังผลิต", tone: "info" },
    completed: { label: "ผลิตเสร็จแล้ว", tone: "success" },
    cancelled: { label: "ยกเลิกการผลิต", tone: "danger" },
  },
  invoice_supplier: {
    pending: {
      label: INVOICE_STATUS_LABELS.pending,
      tone: INVOICE_SUPPLIER_STATUS_TONE.pending,
    },
    partial: {
      label: INVOICE_STATUS_LABELS.partial,
      tone: INVOICE_SUPPLIER_STATUS_TONE.partial,
    },
  },
};

const statusView = (kind: DashboardListKind, status: string) =>
  STATUS_VIEWS[kind]?.[status] ?? {
    label: status,
    tone: "neutral" as BadgeTone,
  };

export interface OpenList {
  key: DashboardListKey;
  title: string;
  /** The page of the menu the rows belong to. */
  href: string;
  /** What the date column means for this list (target date, due date, ...). */
  dateLabel?: string;
}

interface DashboardListModalProps {
  list: OpenList;
  onClose: () => void;
  /** A record was changed from its detail view, so the Dashboard numbers are stale. */
  onChanged: () => void;
}

/**
 * The rows behind one Dashboard number. The same source as the number, so the
 * total here is the number on the card. Rows are fetched when this opens, and a
 * row opens its own detail view on top when one exists.
 */
export default function DashboardListModal({
  list,
  onClose,
  onChanged,
}: DashboardListModalProps) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DashboardList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<DashboardListRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setResult(await dashboardModel.getList(list.key, page));
      setError(null);
    } catch (loadError) {
      setError(loadErrorText("รายการ", loadError));
    } finally {
      setIsLoading(false);
    }
  }, [list.key, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = result?.data ?? [];
  const total = result?.meta.total;
  // Columns that no row has a value for (a stock list has only names) are left out.
  const hasParty = rows.some((row) => row.party);
  const hasDate = rows.some((row) => row.date);
  const hasAmount = rows.some((row) => row.amount !== null);
  const hasStatus = rows.some((row) => row.status);

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={list.title}
        description={
          total === undefined
            ? undefined
            : `ทั้งหมด ${new Intl.NumberFormat("th-TH").format(total)} รายการ`
        }
        size="xl"
        footer={
          <>
            <Link href={list.href} className="ka-btn">
              เปิดหน้ารายการ
            </Link>
            <button
              type="button"
              className="ka-btn ka-btn--primary"
              onClick={onClose}
            >
              ปิด
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <LoadErrorBanner message={error} onRetry={() => void load()} />

          {isLoading && !result && (
            <p className="text-[14px] text-[var(--ink-muted)]">กำลังโหลด...</p>
          )}

          {result && rows.length === 0 && !error && (
            <p className="text-[14px] text-[var(--ink-muted)]">ไม่มีรายการ</p>
          )}

          {rows.length > 0 && (
            <div className="ka-table-scroll">
              <table className="ka-table">
                <thead>
                  <tr>
                    <th scope="col">รายการ</th>
                    {hasParty && <th scope="col">ผู้เกี่ยวข้อง</th>}
                    {hasDate && (
                      <th scope="col">{list.dateLabel ?? "วันที่"}</th>
                    )}
                    {hasAmount && (
                      <th scope="col" className="text-right">
                        ยอดเงิน
                      </th>
                    )}
                    {hasStatus && <th scope="col">สถานะ</th>}
                    <th scope="col" className="hidden sm:table-cell">
                      <span className="sr-only">ดูรายละเอียด</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="min-w-[10rem] break-words">
                        {OPENABLE_KINDS.includes(row.kind) ? (
                          // The name opens the record too, so it stays reachable on a narrow screen
                          // where the action column has scrolled out of view.
                          <button
                            type="button"
                            className="text-left font-medium text-[var(--brand-ink)] underline-offset-2 hover:underline"
                            onClick={() => setDetail(row)}
                          >
                            {row.code ?? row.title ?? "-"}
                          </button>
                        ) : (
                          <span className="font-medium text-[var(--ink)]">
                            {row.code ?? row.title ?? "-"}
                          </span>
                        )}
                        {row.code && row.title && row.title !== row.code && (
                          <span className="block text-[13px] text-[var(--ink-muted)]">
                            {row.title}
                          </span>
                        )}
                      </td>
                      {hasParty && (
                        <td className="break-words">{row.party ?? "-"}</td>
                      )}
                      {hasDate && (
                        <td className="whitespace-nowrap">
                          {row.date ? formatThaiDate(row.date) : "-"}
                        </td>
                      )}
                      {hasAmount && (
                        <td className="whitespace-nowrap text-right">
                          {row.amount === null ? "-" : baht(row.amount)}
                        </td>
                      )}
                      {hasStatus && (
                        <td>
                          {row.status ? (
                            <StatusBadge
                              tone={statusView(row.kind, row.status).tone}
                            >
                              {statusView(row.kind, row.status).label}
                            </StatusBadge>
                          ) : (
                            "-"
                          )}
                        </td>
                      )}
                      <td className="hidden text-right sm:table-cell">
                        {OPENABLE_KINDS.includes(row.kind) && (
                          <button
                            type="button"
                            className="ka-btn ka-btn--ghost"
                            aria-label={`ดูรายละเอียด ${row.code ?? row.title ?? ""}`.trim()}
                            onClick={() => setDetail(row)}
                          >
                            ดูรายละเอียด
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            meta={result?.meta ?? null}
            currentPage={page}
            onPageChange={setPage}
          />
        </div>
      </Modal>

      {detail && (
        <RecordDetail
          kind={detail.kind}
          id={detail.ref_id}
          onClose={() => setDetail(null)}
          onChanged={() => {
            setDetail(null);
            void load();
            onChanged();
          }}
          onError={setError}
        />
      )}
    </>
  );
}
