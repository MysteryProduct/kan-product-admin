"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import StatusBadge from "@/components/StatusBadge";
import LoadErrorBanner, { loadErrorText } from "@/components/LoadErrorBanner";
import CustomSelect from "@/components/CustomSelect";
import RecordDetail, { OPENABLE_KINDS } from "@/components/dashboard/RecordDetail";
import { statusView } from "@/components/dashboard/listStatus";
import DashboardModel from "@/models/dashboard";
import { formatThaiDateTime, toDateValue } from "@/lib/date-format";
import type {
  DashboardList,
  DashboardListKey,
  DashboardListRow,
  StockFilter,
  StockStatusFilter,
} from "@/types/dashboard";

const dashboardModel = new DashboardModel();

// A refund is negative: "-฿120.00", not "฿-120.00".
const baht = (value: number) =>
  `${value < 0 ? "-" : ""}฿${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))}`;
const count = (value: number) => new Intl.NumberFormat("th-TH").format(value);

// The modal answers "what needs me first"; the full list lives on the page the footer links to.
const SHOWN = 5;
// Rows fetched per request, the API's maximum; search looks through these.
const FETCH = 50;
const DAY = 24 * 60 * 60 * 1000;

export interface OpenList {
  key: DashboardListKey;
  title: string;
  /** The page of the menu the rows belong to. */
  href: string;
  /** What the date column means for this list (target date, due date, ...). */
  dateLabel?: string;
  /** Why the rows are listed, under the title: "ลูกค้าชำระเงินหลังหมดเวลาจอง ต้องตรวจก่อนยืนยัน". */
  reason?: string;
  /** `danger` for work at risk now; sets the header icon. */
  tone?: "danger" | "warning" | "info";
  /** Work waiting on staff: the rows waiting longest come first, with how long they have waited. */
  oldestFirst?: boolean;
  /** The verb on each row's button, such as "ตรวจสอบ" or "อนุมัติ"; it opens the record. */
  rowAction?: string;
  /** The stock list's conditions, the same as the card that opened it; only `stock_variants` has them. */
  stock?: {
    filter: StockFilter;
    status?: StockStatusFilter;
  };
}

const STOCK_STATUS_OPTIONS: { value: StockStatusFilter | ""; label: string }[] = [
  { value: "", label: "ทุกสถานะ" },
  { value: "problem", label: "ต้องดูแล (หมด + เหลือน้อย)" },
  { value: "out", label: "หมด" },
  { value: "low", label: "เหลือน้อย" },
  { value: "normal", label: "ปกติ" },
];

// The page each list belongs to, for the footer's "ไปหน้า…" button.
const PAGE_NAMES: Record<string, string> = {
  "/admin/store-fulfillment": "คำสั่งซื้อหน้าร้าน",
  "/admin/sale-orders": "ใบขาย",
  "/admin/purchase-orders": "ใบสั่งซื้อ",
  "/admin/contact-requests": "คำขอติดต่อกลับ",
  "/admin/job-orders": "งานผลิต",
  "/admin/payment-receipts": "รับชำระ",
  "/admin/invoice-supplier": "ใบแจ้งหนี้ผู้จำหน่าย",
  "/admin/purchase-receipt": "ใบรับสินค้า",
  "/admin/products": "รายการสินค้า",
  "/admin/materials": "วัตถุดิบ",
};

const ICONS = {
  danger: "M12 4l9 16H3zM12 10v4M12 17h.01",
  warning: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
};

const waitedText = (date: string | null, now: number) => {
  const at = toDateValue(date)?.getTime();
  if (at === undefined || Number.isNaN(at)) return null;
  const days = Math.floor((now - at) / DAY);
  return days >= 1 ? `รอ ${count(days)} วัน` : null;
};

const byOldest = (a: DashboardListRow, b: DashboardListRow) =>
  (toDateValue(a.date)?.getTime() ?? Infinity) - (toDateValue(b.date)?.getTime() ?? Infinity);

interface DashboardListModalProps {
  list: OpenList;
  onClose: () => void;
  /** A record was changed from its detail view, so the Dashboard numbers are stale. */
  onChanged: () => void;
}

/**
 * The rows behind one Dashboard number, as cards: the 5 that need attention first, a search
 * when there are more, and a link to the page that holds the whole list. No page numbers here.
 */
export default function DashboardListModal({ list, onClose, onChanged }: DashboardListModalProps) {
  const [result, setResult] = useState<{ rows: DashboardListRow[]; total: number; amountTotal?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<DashboardListRow | null>(null);
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());
  // The stock list's status can be changed here; the card opens it for every category (TASK-0321 Q2).
  const [stockStatus, setStockStatus] = useState<StockStatusFilter | "">(list.stock?.status ?? "");
  const stockFilter = list.stock?.filter;
  const isStock = list.key === "stock_variants";

  // Only the newest request may fill the list.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setIsLoading(true);
    const extra = isStock
      ? {
          ...(stockFilter?.category_id !== undefined ? { category_id: stockFilter.category_id } : {}),
          ...(stockFilter?.q ? { q: stockFilter.q } : {}),
          ...(stockStatus ? { status: stockStatus } : {}),
        }
      : {};
    try {
      const first: DashboardList = await dashboardModel.getList(list.key, 1, FETCH, extra);
      let rows = first.data;
      // A long queue: its oldest rows sit on the last page whichever way the API sorts it,
      // so take both ends and sort them here.
      if (list.oldestFirst && first.meta.last_page > 1) {
        const last = await dashboardModel.getList(list.key, first.meta.last_page, FETCH, extra);
        rows = [...rows, ...last.data];
      }
      if (request !== latestRequest.current) return;
      if (list.oldestFirst) rows = [...rows].sort(byOldest);
      setResult({ rows, total: first.meta.total, amountTotal: first.amount_total });
      setError(null);
    } catch (loadError) {
      if (request !== latestRequest.current) return;
      setError(loadErrorText("รายการ", loadError));
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [isStock, list.key, list.oldestFirst, stockFilter?.category_id, stockFilter?.q, stockStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = result?.total ?? 0;
  const searchable = total > SHOWN;
  const matches = useMemo(() => {
    const rows = result?.rows ?? [];
    const words = query.trim().toLowerCase();
    if (!words) return rows;
    return rows.filter((row) =>
      [row.code, row.title, row.party, row.product_name].some((value) => value?.toLowerCase().includes(words)),
    );
  }, [result, query]);
  const shown = matches.slice(0, SHOWN);
  const pageName = PAGE_NAMES[list.href] ?? "รายการ";
  const tone = list.tone ?? "warning";

  const subtitle =
    result === null
      ? list.reason
      : [
          `${count(total)} รายการ`,
          result.amountTotal === undefined ? null : `รวม ${baht(result.amountTotal)}`,
          list.reason ?? (list.oldestFirst ? "เรียงจากรอนานที่สุด" : null),
        ]
          .filter(Boolean)
          .join(" · ");

  const footerNote =
    result === null || total === 0
      ? ""
      : total <= SHOWN
        ? `แสดงครบ ${count(total)} รายการ`
        : `แสดง ${count(shown.length)} จาก ${count(total)} · รายการที่เหลือดูในหน้า${pageName}`;

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={list.title}
        description={subtitle}
        icon={
          <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS[tone]} />
          </svg>
        }
        iconTone={tone}
        size="list"
        footer={
          <>
            {footerNote && <span className="ka-modal__note numeric">{footerNote}</span>}
            <button type="button" className="ka-btn" onClick={onClose}>
              ปิด
            </button>
            <Link href={list.href} className="ka-btn ka-btn--primary">
              {total > SHOWN ? `ดูทั้ง ${count(total)} รายการ` : `ไปหน้า${pageName}`}
              <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </>
        }
      >
        <div className="grid gap-3">
          <LoadErrorBanner message={error} onRetry={() => void load()} />

          {isStock && (
            <div className="grid gap-2">
              <div className="max-w-xs">
                <label htmlFor="stock-status" className="ka-label mb-1 block">
                  สถานะสต็อก
                </label>
                <CustomSelect
                  id="stock-status"
                  value={stockStatus}
                  onChange={(value) => setStockStatus(value as StockStatusFilter | "")}
                  options={STOCK_STATUS_OPTIONS}
                />
              </div>
              <p className="ka-todo__cap">
                จำนวนคงเหลือรวมทุกล็อต (ชิ้น) ไม่ใช่จำนวนที่ซื้อออนไลน์ได้
              </p>
            </div>
          )}

          {searchable && (
            <div className="ka-input-wrap">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                role="searchbox"
                className="ka-input"
                aria-label={`ค้นหาใน${list.title}`}
                placeholder="ค้นหาเลขเอกสารหรือชื่อลูกค้า"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}

          {isLoading && !result && (
            <div className="ka-qlist" aria-busy="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="ka-qrow" aria-hidden="true">
                  <span className="ka-skel ka-skel--title" />
                  <span className="ka-skel" style={{ width: "60%" }} />
                </div>
              ))}
            </div>
          )}

          {result && shown.length === 0 && !error && (
            <div className="ka-empty">
              <p className="text-base font-semibold text-[var(--ink)]">
                {query ? "ไม่พบรายการที่ตรงกับคำค้นหา" : "ไม่มีรายการ"}
              </p>
              {query && (
                <button type="button" className="ka-btn ka-btn--sm" onClick={() => setQuery("")}>
                  ล้างคำค้นหา
                </button>
              )}
            </div>
          )}

          {shown.length > 0 && (
            <ul className="ka-qlist" aria-label={list.title}>
              {shown.map((row) => (
                <ListRow key={row.id} row={row} list={list} now={now} onOpen={() => setDetail(row)} />
              ))}
            </ul>
          )}
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

function ListRow({ row, list, now, onOpen }: { row: DashboardListRow; list: OpenList; now: number; onOpen: () => void }) {
  const openable = OPENABLE_KINDS.includes(row.kind);
  const name = row.code ?? row.title ?? "-";
  const status = row.status ? statusView(row.kind, row.status) : null;
  const isStockRow = row.remain_qty !== undefined;
  const meta = isStockRow
    ? [row.color_name, row.size_name].filter(Boolean).join(" · ")
    : [
        row.code && row.title && row.title !== row.code ? row.title : null,
        row.party,
        row.date ? formatThaiDateTime(row.date) : null,
        row.kind === "store_order" ? "หน้าร้านออนไลน์" : null,
      ]
        .filter(Boolean)
        .join(" · ");
  const waited = list.oldestFirst ? waitedText(row.date, now) : null;

  return (
    <li className="ka-qrow">
      <div className="ka-qrow__main">
        <div className="ka-qrow__title">
          {openable ? (
            <button type="button" className="ka-qrow__code numeric" onClick={onOpen}>
              {name}
            </button>
          ) : (
            <span className="ka-qrow__code ka-qrow__code--plain numeric">{name}</span>
          )}
          {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        </div>
        {meta && <p className="ka-qrow__meta">{meta}</p>}
        {waited && <p className="ka-qrow__meta ka-qrow__meta--late">{waited}</p>}
      </div>
      <div className="ka-qrow__amount numeric">
        {isStockRow ? `${count(row.remain_qty as number)} ชิ้น` : row.amount === null ? "" : baht(row.amount)}
      </div>
      {openable && (
        <button
          type="button"
          className="ka-btn ka-btn--sm"
          aria-label={`${list.rowAction ?? "ดูรายละเอียด"} ${name}`}
          onClick={onOpen}
        >
          {list.rowAction ?? "ดูรายละเอียด"}
        </button>
      )}
    </li>
  );
}
