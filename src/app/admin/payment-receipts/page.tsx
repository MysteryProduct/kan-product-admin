"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DocumentCode from "@/components/DocumentCode";
import { loadErrorText } from "@/components/LoadErrorBanner";
import Pagination from "@/components/Pagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatThaiDate } from "@/lib/date-format";
import { usePageCrumb } from "@/lib/page-crumb";
import PaymentReceiptModel from "@/models/payment-receipt";
import SaleOrderModel from "@/models/sale-order";
import type { PaginationMeta } from "@/types/pagination";
import type {
  PaymentReceipt,
  PaymentReceiptMethodFilter,
  PaymentReceiptSummary,
  PaymentReceiptTab,
  PaymentReceiptType,
} from "@/types/payment-receipt";
import type { SaleOrder, SaleOrderSummary } from "@/types/sale-order";
import {
  formatBaht,
  formatMoney,
  paymentState,
  payable,
} from "@/app/admin/sale-orders/lib/so-display";
import {
  ReceiptMenu,
  useReceiptDelete,
  useRowEntries,
} from "./components/receipt-actions";
import {
  FilterChips,
  SortMenu,
  type FilterValues,
} from "./components/receipt-filters";
import {
  Badge,
  Highlight,
  Icon,
  OrderBadge,
  SectionError,
} from "./components/receipt-ui";
import {
  BASE,
  customerOf,
  METHODS,
  methodView,
  ORDERS,
  receiptStatus,
  signedBaht,
  SORTS,
  TABS,
  TYPES,
  typeText,
  type ReceiptSort,
} from "./lib/receipt-display";

const receiptModel = new PaymentReceiptModel();
const saleOrderModel = new SaleOrderModel();
const PAGE_SIZE = 10;
const QUEUE_PEEK = 3;
const QUEUE_PAGE = 12;
const ORDERS_PER_REQUEST = 100;

const readList = <T extends string>(
  value: string | null,
  allowed: readonly { value: T }[],
): T[] =>
  (value ?? "")
    .split(",")
    .filter((item): item is T =>
      allowed.some((option) => option.value === item),
    );
const readDay = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
const readTab = (value: string | null): PaymentReceiptTab =>
  TABS.some((tab) => tab.key === value) ? (value as PaymentReceiptTab) : "all";
const readSort = (value: string | null): ReceiptSort =>
  value && value in SORTS ? (value as ReceiptSort) : "newest";

/** Every approved or part-paid order, oldest first; only those still owing stay in the queue (R5, R6). */
async function loadQueue(): Promise<SaleOrder[]> {
  const all: SaleOrder[] = [];
  for (let page = 1; ; page += 1) {
    const response = await saleOrderModel.getSaleOrders(
      page,
      ORDERS_PER_REQUEST,
      undefined,
      "create_date",
      "ASC",
      undefined,
      {
        statuses: ["approved", "partial"],
      },
    );
    all.push(...(response.data ?? []));
    if (page >= (response.meta?.last_page ?? 1)) break;
  }
  return all.filter((order) => paymentState(order).due > 0);
}

function ChangeLine({
  now,
  before,
}: {
  now: number | null;
  before: number | null;
}) {
  if (now === null || !before) return <>&nbsp;</>;
  const percent = Math.round(((now - before) / before) * 100);
  return (
    <>
      <span className={percent < 0 ? "ka-pr-down" : "ka-pr-up"}>
        {percent < 0 ? "▼" : "▲"} {Math.abs(percent)}%
      </span>{" "}
      จากเดือนก่อน
    </>
  );
}

interface StatProps {
  tone: "success" | "brand" | "info" | "neutral";
  icon: "money" | "clock" | "receipt" | "refund";
  label: string;
  value: string | null;
  sub: React.ReactNode;
}

function Stat({ tone, icon, label, value, sub }: StatProps) {
  return (
    <section className="ka-pr-card ka-pr-stat">
      <span className="ka-pr-tone ka-pr-stat__ic" data-tone={tone}>
        <Icon name={icon} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="ka-pr-cap ka-pr-cap--500">{label}</div>
        <div className="ka-pr-sv">
          {value ?? (
            <span
              className="ka-pr-sk"
              style={{ display: "block", width: 120, height: 34 }}
            />
          )}
        </div>
        <div className="ka-pr-cap">{sub}</div>
      </div>
    </section>
  );
}

function QueueCard({ order, canAdd }: { order: SaleOrder; canAdd: boolean }) {
  const pay = paymentState(order);
  const custom = order.sale_order_type === "custom";
  const href = custom
    ? `${ORDERS}/${order.sale_order_id}`
    : `${BASE}/new?sale_order=${order.sale_order_id}`;
  return (
    <article className="ka-pr-qc">
      <div className="ka-pr-row ka-pr-row--8 ka-pr-row--between ka-pr-row--top">
        <div style={{ minWidth: 0 }}>
          <div className="ka-pr-code ka-pr-code--600">
            {order.sale_order_code}
          </div>
          <div className="ka-pr-qc__name">{order.sale_order_name}</div>
        </div>
        <OrderBadge status={order.sale_order_status} />
      </div>
      <div className="ka-pr-cap ka-pr-cap--14">
        {order.shipping_address_name || order.sale_order_name} · ยอด{" "}
        {formatBaht(payable(order))}
      </div>
      <div>
        <div className="ka-pr-row ka-pr-row--between ka-pr-qc__line">
          <span className="ka-pr-mut">ชำระแล้ว {pay.percent}%</span>
          <span>
            ค้าง <b className="ka-pr-num">{formatBaht(pay.due)}</b>
          </span>
        </div>
        <div
          className="ka-pr-meter"
          role="img"
          aria-label={`ชำระแล้ว ${pay.percent}%`}
        >
          <i data-kind="queue" style={{ width: `${pay.percent}%` }} />
        </div>
      </div>
      {canAdd && (
        <Link className="ka-pr-btn ka-pr-btn--a ka-pr-w100" href={href}>
          <Icon name="plus" small />
          รับชำระ
        </Link>
      )}
    </article>
  );
}

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลดใบเสร็จ">
      {[100, 80, 70, 90].map((width) => (
        <div key={width} className="ka-pr-skrow">
          {[width, 100, 70, 100, 60].map((cell, index) => (
            <div
              key={index}
              className="ka-pr-sk"
              style={{ height: 16, width: `${cell}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ReceiptsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can, isLoaded } = usePermissions();
  const canAdd = can("payment_receipts", "add");
  const canViewOrders = can("sale_orders", "view");

  usePageCrumb({ parents: ["ขายสินค้า"], current: "ใบเสร็จรับเงิน" });

  // The URL holds the whole view, so back/forward, reload and a shared link keep it (R11). `search` is the
  // older form of the link, kept for the links other pages already hold (R2).
  const query = params?.get("q") ?? params?.get("search") ?? "";
  const tab = readTab(params?.get("tab") ?? null);
  const methodParam = params?.get("method") ?? null;
  const typeParam = params?.get("type") ?? null;
  const method = useMemo(
    () => readList<PaymentReceiptMethodFilter>(methodParam, METHODS),
    [methodParam],
  );
  const type = useMemo(
    () => readList<PaymentReceiptType>(typeParam, TYPES),
    [typeParam],
  );
  const from = readDay(params?.get("from") ?? null);
  const to = readDay(params?.get("to") ?? null);
  const sort = readSort(params?.get("sort") ?? null);
  const page = Math.max(1, Number(params?.get("page")) || 1);
  const queueAll = params?.get("queue") === "all";
  const queuePage = queueAll
    ? Math.max(1, Number(params?.get("qpage")) || 1)
    : 1;

  const [searchText, setSearchText] = useState(query);
  const [rows, setRows] = useState<PaymentReceipt[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PaymentReceiptSummary | null>(null);
  const [orderSummary, setOrderSummary] = useState<SaleOrderSummary | null>(
    null,
  );
  const [queue, setQueue] = useState<SaleOrder[] | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [orderSummaryFailed, setOrderSummaryFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const setParams = useCallback(
    (
      next: Record<string, string | undefined>,
      mode: "push" | "replace" = "push",
    ) => {
      const merged = new URLSearchParams(params?.toString() ?? "");
      merged.delete("search");
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined) continue;
        if (value === "") merged.delete(key);
        else merged.set(key, value);
      }
      const href = merged.toString()
        ? `${pathname}?${merged}`
        : (pathname ?? BASE);
      if (mode === "replace") router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [params, pathname, router],
  );

  // Search while typing, 300 ms after the last key; a new search starts from page 1. Only typing counts: a
  // "clear all" on its way through the router must not be overwritten from the URL it is replacing.
  const typing = useRef(false);
  const typeSearch = (text: string) => {
    typing.current = true;
    setSearchText(text);
  };
  useEffect(() => {
    const trimmed = searchText.trim();
    if (!typing.current || trimmed === query) return;
    const timer = window.setTimeout(() => {
      typing.current = false;
      setParams({ q: trimmed, page: "" }, "replace");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText, query, setParams]);

  // Back/forward can change the URL's search under the box.
  const lastQuery = useRef(query);
  useEffect(() => {
    if (lastQuery.current !== query && query !== searchText.trim())
      setSearchText(query);
    lastQuery.current = query;
  }, [query, searchText]);

  const filters = useMemo(
    () => ({
      search: query,
      payment_method: method,
      payment_receipt_type: type,
      date_start: from,
      date_end: to,
    }),
    [query, method, type, from, to],
  );

  const listKey = JSON.stringify([filters, tab, sort, page, refresh]);
  useEffect(() => {
    let active = true;
    receiptModel
      .listPaymentReceipts({
        ...filters,
        tab,
        page,
        limit: PAGE_SIZE,
        sortField: SORTS[sort].field,
        sortOrder: SORTS[sort].order,
      })
      .then((response) => {
        if (!active) return;
        setRows(response.data ?? []);
        setMeta(response.meta);
        setListError(null);
        setLoadedKey(listKey);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setListError(loadErrorText("รายการใบเสร็จรับเงิน", error));
        setLoadedKey(listKey);
      });
    return () => {
      active = false;
    };
  }, [filters, tab, sort, page, refresh, listKey]);

  useEffect(() => {
    let active = true;
    receiptModel
      .getPaymentReceiptSummary({ ...filters, tab })
      .then((next) => {
        if (!active) return;
        setSummary(next);
        setSummaryFailed(false);
      })
      .catch(() => {
        if (!active) return;
        setSummary(null);
        setSummaryFailed(true);
      });
    return () => {
      active = false;
    };
  }, [filters, tab, refresh]);

  useEffect(() => {
    if (!isLoaded || !canViewOrders) return;
    let active = true;
    saleOrderModel
      .getSaleOrderSummary()
      .then((next) => {
        if (!active) return;
        setOrderSummary(next);
        setOrderSummaryFailed(false);
      })
      .catch(() => {
        if (!active) return;
        setOrderSummary(null);
        setOrderSummaryFailed(true);
      });
    loadQueue()
      .then((next) => {
        if (!active) return;
        setQueue(next);
        setQueueError(null);
      })
      .catch((error: unknown) => {
        if (active) setQueueError(loadErrorText("รายการใบสั่งขาย", error));
      });
    return () => {
      active = false;
    };
  }, [isLoaded, canViewOrders, refresh]);

  const reload = () => setRefresh((count) => count + 1);
  const remove = useReceiptDelete({ onDeleted: reload });
  const rowEntries = useRowEntries(remove.request);

  const loading = loadedKey !== listKey;
  useEffect(() => {
    if (loading || listError || rows.length > 0 || page <= 1) return;
    const last = meta?.last_page ?? 1;
    setParams({ page: last > 1 ? String(last) : "" }, "replace");
  }, [loading, listError, rows.length, page, meta, setParams]);
  const active = method.length > 0 || type.length > 0 || Boolean(from || to);
  const filtered = active || Boolean(query) || tab !== "all";
  const total = meta?.total ?? 0;
  const shop = summary?.tabs.all;
  const clearAll = () => {
    typing.current = false;
    setSearchText("");
    setParams({
      q: "",
      tab: "",
      method: "",
      type: "",
      from: "",
      to: "",
      page: "",
    });
  };
  const values: FilterValues = { tab, method, type, from, to };
  const applyFilters = (next: Partial<FilterValues>) =>
    setParams({
      tab:
        next.tab === undefined ? undefined : next.tab === "all" ? "" : next.tab,
      method: next.method?.join(","),
      type: next.type?.join(","),
      from: next.from,
      to: next.to,
      page: "",
    });

  const queueCount = queue?.length ?? 0;
  const queueRows = queueAll
    ? (queue ?? []).slice((queuePage - 1) * QUEUE_PAGE, queuePage * QUEUE_PAGE)
    : (queue ?? []).slice(0, QUEUE_PEEK);
  const queueMeta: PaginationMeta = {
    total: queueCount,
    page: queuePage,
    limit: QUEUE_PAGE,
    last_page: Math.max(1, Math.ceil(queueCount / QUEUE_PAGE)),
  };
  const received = orderSummary?.received_this_month ?? null;
  const dash = !canViewOrders || orderSummaryFailed;
  const dashMonth = summaryFailed;

  return (
    <div className="ka-pr">
      <div className="ka-pr-ph">
        <div>
          <h1>ใบเสร็จรับเงิน</h1>
          <p className="ka-pr-cap ka-pr-cap--14 ka-pr-p">
            รับชำระตามใบสั่งขายที่อนุมัติแล้ว ใบสั่งขายที่ยกเลิกจะไม่แสดงที่นี่
          </p>
        </div>
        {canAdd && (
          <div className="ka-pr-row">
            <Link className="ka-pr-btn ka-pr-btn--a" href={`${BASE}/new`}>
              <Icon name="plus" small />
              สร้างใบเสร็จรับเงิน
            </Link>
          </div>
        )}
      </div>

      {(summaryFailed || orderSummaryFailed) && (
        <SectionError
          message="โหลดตัวเลขสรุปไม่สำเร็จ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"
          onRetry={reload}
        />
      )}
      <div className="ka-pr-stats">
        <Stat
          tone="success"
          icon="money"
          label="รับชำระเดือนนี้"
          value={
            dash || (orderSummary && received === null)
              ? "—"
              : orderSummary
                ? formatBaht(received ?? 0)
                : null
          }
          sub={
            <ChangeLine
              now={received}
              before={orderSummary?.received_last_month ?? null}
            />
          }
        />
        <Stat
          tone="brand"
          icon="clock"
          label="ยอดค้างรับ"
          value={
            dash
              ? "—"
              : orderSummary
                ? formatBaht(orderSummary.outstanding_total)
                : null
          }
          sub={
            orderSummary ? (
              `${orderSummary.outstanding_count} ใบสั่งขาย`
            ) : (
              <>&nbsp;</>
            )
          }
        />
        <Stat
          tone="info"
          icon="receipt"
          label="ใบเสร็จเดือนนี้"
          value={
            dashMonth
              ? "—"
              : summary
                ? `${summary.month.receipt_count} ใบ`
                : null
          }
          sub={
            summary ? (
              `วันนี้ ${summary.month.receipt_today_count} ใบ`
            ) : (
              <>&nbsp;</>
            )
          }
        />
        <Stat
          tone="neutral"
          icon="refund"
          label="คืนเงินเดือนนี้"
          value={
            dashMonth
              ? "—"
              : summary
                ? formatBaht(summary.month.refund_total)
                : null
          }
          sub={summary ? `${summary.month.refund_count} รายการ` : <>&nbsp;</>}
        />
      </div>

      {canViewOrders && (
        <section
          className="ka-pr-card ka-pr-clip"
          aria-labelledby="ka-pr-queue-title"
        >
          <div className="ka-pr-chd">
            <div>
              <h2 id="ka-pr-queue-title">
                รอรับชำระ{" "}
                <span className="ka-pr-cap ka-pr-num">
                  {queue ? `· ${queueCount} ใบสั่งขาย` : ""}
                </span>
              </h2>
              <div className="ka-pr-cap">
                อนุมัติแล้วและยังชำระไม่ครบ · ไม่รวมใบที่ยกเลิก
              </div>
            </div>
            {(queueCount > QUEUE_PEEK || queueAll) && (
              <button
                type="button"
                className="ka-pr-btn ka-pr-btn--gh ka-pr-btn--sm ka-pr-btn--brand"
                onClick={() =>
                  setParams({ queue: queueAll ? "" : "all", qpage: "" })
                }
              >
                {queueAll ? "ย่อรายการ" : "ดูทั้งหมด"}
              </button>
            )}
          </div>
          {queueError ? (
            <div className="ka-pr-cp">
              <SectionError message={queueError} onRetry={reload} />
            </div>
          ) : queue === null ? (
            <div className="ka-pr-queue" aria-busy="true">
              {[0, 1, 2].map((item) => (
                <div key={item} className="ka-pr-qc ka-pr-qc--sk ka-pr-sk" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="ka-pr-empty">
              <span className="ka-pr-tone ka-pr-etile" data-tone="success">
                <Icon name="check" size={26} />
              </span>
              <b>ไม่มีใบสั่งขายรอรับชำระ</b>
              <span className="ka-pr-cap ka-pr-cap--14">
                ใบสั่งขายที่อนุมัติแล้วชำระครบทุกใบ
              </span>
            </div>
          ) : (
            <>
              <div className="ka-pr-queue">
                {queueRows.map((order) => (
                  <QueueCard
                    key={order.sale_order_id}
                    order={order}
                    canAdd={canAdd}
                  />
                ))}
              </div>
              {queueAll && queueMeta.last_page > 1 && (
                <div className="ka-pr-queue__foot">
                  <Pagination
                    meta={queueMeta}
                    currentPage={queuePage}
                    onPageChange={(next) =>
                      setParams({ qpage: next === 1 ? "" : String(next) })
                    }
                  />
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section
        className="ka-pr-card ka-pr-clip"
        aria-labelledby="ka-pr-list-title"
      >
        <div className="ka-pr-chd">
          <div>
            <h2 id="ka-pr-list-title">ใบเสร็จรับเงินทั้งหมด</h2>
            <div className="ka-pr-cap">
              {active || query
                ? `พบ ${total} รายการ จากตัวกรองที่เลือก`
                : `เรียง${SORTS[sort].label}`}
            </div>
          </div>
          <div className="ka-pr-tabs" role="tablist" aria-label="สถานะใบเสร็จ">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                className="ka-pr-tab"
                aria-selected={tab === item.key}
                onClick={() =>
                  setParams({
                    tab: item.key === "all" ? "" : item.key,
                    page: "",
                  })
                }
              >
                {item.label}
                <span className="ka-pr-tab__n">
                  {summary?.tabs[item.key] ?? "–"}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="ka-pr-fbar">
          <label className="ka-pr-fs">
            <Icon name="search" small />
            <input
              aria-label="ค้นหาใบเสร็จ"
              placeholder="เลข RE, เลข SO หรือชื่อลูกค้า"
              value={searchText}
              onChange={(event) => typeSearch(event.target.value)}
            />
            {searchText && (
              <button
                type="button"
                className="ka-pr-ib ka-pr-ib--sm"
                aria-label="ล้างคำค้น"
                onClick={() => typeSearch("")}
              >
                <Icon name="close" small />
              </button>
            )}
          </label>
          <FilterChips
            values={values}
            search={query}
            summary={summary}
            onChange={applyFilters}
          />
          {active && (
            <button
              type="button"
              className="ka-pr-btn ka-pr-btn--gh ka-pr-btn--sm ka-pr-btn--brand"
              onClick={() =>
                setParams({ method: "", type: "", from: "", to: "", page: "" })
              }
            >
              ล้างตัวกรอง
            </button>
          )}
          <span className="ka-pr-sp" />
          <SortMenu
            sort={sort}
            onChange={(next) =>
              setParams({ sort: next === "newest" ? "" : next, page: "" })
            }
          />
        </div>
        {listError && (
          <div className="ka-pr-cp">
            <SectionError message={listError} onRetry={reload} />
          </div>
        )}
        {!listError && loading && rows.length === 0 && <SkeletonRows />}
        {!listError &&
          !loading &&
          rows.length === 0 &&
          (filtered || (shop ?? 0) > 0 ? (
            <div className="ka-pr-empty">
              <span className="ka-pr-tone ka-pr-etile" data-tone="neutral">
                <Icon name="searchMinus" size={26} />
              </span>
              <b>
                {query
                  ? `ไม่พบใบเสร็จที่ตรงกับ “${query}”`
                  : "ไม่พบใบเสร็จที่ตรงกับตัวกรอง"}
              </b>
              <span className="ka-pr-cap ka-pr-cap--14">
                ลองเลขใบสั่งขายหรือชื่อลูกค้า หรือเอาตัวกรองออก
              </span>
              <button type="button" className="ka-pr-btn" onClick={clearAll}>
                ล้างคำค้นและตัวกรอง
              </button>
            </div>
          ) : (
            <div className="ka-pr-empty">
              <span className="ka-pr-tone ka-pr-etile" data-tone="brand">
                <Icon name="receipt" size={26} />
              </span>
              <b>ยังไม่มีใบเสร็จรับเงิน</b>
              <span className="ka-pr-cap ka-pr-cap--14">
                เริ่มรับชำระจากใบสั่งขายที่อนุมัติแล้ว
              </span>
              {canAdd && (
                <Link className="ka-pr-btn ka-pr-btn--a" href={`${BASE}/new`}>
                  <Icon name="plus" small />
                  สร้างใบเสร็จรับเงิน
                </Link>
              )}
            </div>
          ))}
        {rows.length > 0 && !listError && (
          <>
            <div className="ka-pr-tw">
              <table className="ka-pr-lt">
                <thead>
                  <tr>
                    <th>ใบเสร็จรับเงิน</th>
                    <th>ใบสั่งขาย</th>
                    <th>วิธีชำระ</th>
                    <th>วันที่รับชำระ</th>
                    <th>สถานะ</th>
                    <th className="ka-pr-r">ยอดรับชำระ (บาท)</th>
                    <th style={{ width: 56 }}>
                      <span className="sr-only">เมนู</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const href = `${BASE}/${row.payment_receipt_id}`;
                    const view = methodView(row);
                    const state = receiptStatus(row);
                    const amount = Number(row.amount_paid);
                    const menu = rowEntries(row);
                    return (
                      <tr
                        key={row.payment_receipt_id}
                        onClick={() => router.push(href)}
                      >
                        <td>
                          <Link
                            href={href}
                            className="ka-pr-rowlink ka-pr-code ka-pr-code--600"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <DocumentCode
                              code={
                                <Highlight
                                  text={row.payment_receipt_code}
                                  term={query}
                                />
                              }
                              legacyCode={row.legacy_code}
                              search={query}
                            />
                          </Link>
                          <div className="ka-pr-cap ka-pr-cap--14">
                            <Highlight text={customerOf(row)} term={query} />
                          </div>
                        </td>
                        <td>
                          {row.saleOrder ? (
                            <Link
                              href={`${ORDERS}/${row.saleOrder.sale_order_id}`}
                              className="ka-pr-sochip ka-pr-code"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Highlight
                                text={row.saleOrder.sale_order_code}
                                term={query}
                              />
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <span className="ka-pr-pm">
                            <span
                              className="ka-pr-tone ka-pr-pm__ic"
                              data-tone={view.tone}
                            >
                              <Icon name={view.icon} small />
                            </span>
                            <span>
                              <span className="ka-pr-pm__main">
                                {view.main}
                              </span>
                              <span className="ka-pr-cap">{view.sub}</span>
                            </span>
                          </span>
                        </td>
                        <td className="ka-pr-num">
                          {formatThaiDate(row.payment_date)}
                        </td>
                        <td>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </td>
                        <td className="ka-pr-r">
                          <div
                            className={`ka-pr-num${amount < 0 ? " ka-pr-neg" : ""}`}
                            style={{ fontWeight: 600 }}
                          >
                            {amount < 0
                              ? `−${formatMoney(Math.abs(amount))}`
                              : formatMoney(amount)}
                          </div>
                          <div className="ka-pr-cap">{typeText(row)}</div>
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <ReceiptMenu
                            receipt={row}
                            label={`ตัวเลือกของ ${row.payment_receipt_code}`}
                            entries={menu.entries}
                            note={menu.note}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="ka-pr-mlist">
              {rows.map((row) => {
                const view = methodView(row);
                const state = receiptStatus(row);
                const amount = Number(row.amount_paid);
                const menu = rowEntries(row);
                return (
                  <div key={row.payment_receipt_id} className="ka-pr-mc">
                    <span className="ka-pr-row ka-pr-row--8 ka-pr-row--between">
                      <Link
                        href={`${BASE}/${row.payment_receipt_id}`}
                        className="ka-pr-mc__link ka-pr-code ka-pr-code--600"
                      >
                        <DocumentCode
                          code={
                            <Highlight
                              text={row.payment_receipt_code}
                              term={query}
                            />
                          }
                          legacyCode={row.legacy_code}
                          search={query}
                        />
                      </Link>
                      <span
                        className={`ka-pr-num${amount < 0 ? " ka-pr-neg" : ""}`}
                        style={{ fontWeight: 700 }}
                      >
                        {signedBaht(amount)}
                      </span>
                    </span>
                    <span className="ka-pr-cap ka-pr-cap--14">
                      <Highlight text={customerOf(row)} term={query} /> ·{" "}
                      <Highlight
                        text={row.saleOrder?.sale_order_code ?? "—"}
                        term={query}
                      />
                    </span>
                    <span className="ka-pr-row ka-pr-row--8 ka-pr-row--between">
                      <span className="ka-pr-cap">
                        {view.main} · {formatThaiDate(row.payment_date)}
                      </span>
                      <span className="ka-pr-row ka-pr-row--8">
                        <Badge tone={state.tone}>{state.label}</Badge>
                        <span className="ka-pr-mc__menu">
                          <ReceiptMenu
                            receipt={row}
                            label={`ตัวเลือกของ ${row.payment_receipt_code}`}
                            entries={menu.entries}
                            note={menu.note}
                          />
                        </span>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="ka-pr-pager">
              <span className="ka-pr-cap">
                {meta && meta.last_page > 1
                  ? `แสดง ${rows.length} จาก ${total} รายการ`
                  : `แสดงครบ ${total} รายการ`}
              </span>
              {meta && meta.last_page > 1 && (
                <Pagination
                  meta={meta}
                  currentPage={page}
                  onPageChange={(next) =>
                    setParams({ page: next === 1 ? "" : String(next) })
                  }
                />
              )}
            </div>
          </>
        )}
      </section>
      {remove.dialogs}
    </div>
  );
}

export default function PaymentReceiptsPage() {
  return (
    <Suspense fallback={null}>
      <ReceiptsList />
    </Suspense>
  );
}
