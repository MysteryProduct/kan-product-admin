'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import PurchaseOrderModel from '@/models/purchase-order';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import SupplierModel from '@/models/supplier';
import type { PurchaseOrder } from '@/types/purchase-order';
import type { PaginationMeta } from '@/types/pagination';
import { usePermissions } from '@/hooks/usePermissions';
import useVatRate from '@/hooks/useVatRate';
import { usePageCrumb } from '@/lib/page-crumb';
import { formatThaiDate } from '@/lib/date-format';
import { getApiErrorMessage } from '@/lib/api-error';
import ConfirmDialog from '@/components/ConfirmDialog';
import DocumentCode from '@/components/DocumentCode';
import FilterChip, { FilterChipOption } from '@/components/FilterChip';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import Pagination from '@/components/Pagination';
import RowMenu, { RowMenuItem } from '@/components/RowMenu';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { formatBaht, formatMoney, orderLines, orderVatSummary, statusLabel, statusTone } from '../purchase-orders/lib/po-display';
import {
  orderProgress,
  Receipt,
  ReceiptStatus,
  receiptQuantityText,
  RECEIPT_STATUS_LABELS,
  receiptStatusLabel,
  receiptStatusTone,
  receiptVatSummary,
  vatShortText,
} from './lib/pr-display';
import { useUnitNames } from './hooks/useUnitNames';

const purchaseOrderModel = new PurchaseOrderModel();
const purchaseReceiptModel = new PurchaseReceiptModel();
const supplierModel = new SupplierModel();
const BASE = '/admin/purchase-receipt';
const PAGE_SIZE = 10;
const QUEUE_PREVIEW = 6;
// The API searches receipt codes only and filters by status only. Searching by order code or
// supplier, or filtering by supplier, loads the latest receipts and filters them here (TASK-0325 Q3).
const LOCAL_FILTER_LIMIT = 500;

type SortKey = 'newest' | 'oldest' | 'high' | 'low';

const SORTS: Record<SortKey, { label: string; field: 'entry_date' | 'purchase_receipt_total'; order: 'ASC' | 'DESC' }> = {
  newest: { label: 'ล่าสุดก่อน', field: 'entry_date', order: 'DESC' },
  oldest: { label: 'เก่าสุดก่อน', field: 'entry_date', order: 'ASC' },
  high: { label: 'ยอดมากไปน้อย', field: 'purchase_receipt_total', order: 'DESC' },
  low: { label: 'ยอดน้อยไปมาก', field: 'purchase_receipt_total', order: 'ASC' },
};
const SORT_KEYS = Object.keys(SORTS) as SortKey[];
const STATUS_KEYS = Object.keys(RECEIPT_STATUS_LABELS) as ReceiptStatus[];

function readList<T extends string>(value: string | null | undefined, allowed?: readonly T[]): T[] {
  const items = (value ?? '').split(',').filter(Boolean) as T[];
  return allowed ? items.filter((item) => allowed.includes(item)) : items;
}

/** Order cards waiting for goods: approved orders and partly received ones. */
function ReceiveQueue({ canAdd }: { canAdd: boolean }) {
  const vatRate = useVatRate();
  const units = useUnitNames();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const totalRef = useRef<number | null>(null);
  const key = `${expanded}|${attempt}`;

  useEffect(() => {
    let active = true;
    // "ดูทั้งหมด" loads every waiting order in one go; the first view shows six.
    const limit = expanded && totalRef.current ? totalRef.current : QUEUE_PREVIEW;
    purchaseOrderModel
      .advisePurchaseOrders(1, limit, '')
      .then((response) => {
        if (!active) return;
        const count = response.meta?.total ?? response.data?.length ?? 0;
        totalRef.current = count;
        setOrders(response.data ?? []);
        setTotal(count);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (active) setError(loadErrorText('ใบสั่งซื้อที่รอรับสินค้า', failure));
      })
      .finally(() => {
        if (active) setLoadedKey(`${expanded}|${attempt}`);
      });
    return () => {
      active = false;
    };
  }, [expanded, attempt]);

  const loading = loadedKey !== key;
  const count = total ?? 0;

  return (
    <section className="ka-card ka-po-clip" aria-labelledby="pr-queue-title" aria-busy={loading || undefined}>
      <div className="ka-po-chd">
        <div>
          <h2 id="pr-queue-title" className="ka-po-h2">
            รอรับสินค้า <span className="ka-po-cap numeric ka-pr-h2count">· {total === null ? '–' : count.toLocaleString('th-TH')} ใบสั่งซื้อ</span>
          </h2>
          <p className="ka-po-cap">ใบสั่งซื้อที่อนุมัติแล้วและยังรับไม่ครบ</p>
        </div>
      </div>

      {error ? (
        <div className="ka-po-cp">
          <LoadErrorBanner message={error} onRetry={() => setAttempt((value) => value + 1)} />
        </div>
      ) : loading && orders.length === 0 ? (
        <div className="ka-pr-queue" aria-hidden="true">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="ka-pr-qc">
              <span className="ka-skel ka-skel--title" />
              <span className="ka-skel" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="ka-po-empty">
          <p className="ka-po-empty__t">ไม่มีใบสั่งซื้อที่รอรับสินค้า</p>
          <p className="ka-po-cap">ใบสั่งซื้อจะมาอยู่ที่นี่เมื่ออนุมัติแล้ว</p>
          <Link href="/admin/purchase-orders" className="ka-pr-link">ไปหน้าใบสั่งซื้อ →</Link>
        </div>
      ) : (
        <>
          <ul className="ka-pr-queue" aria-label="ใบสั่งซื้อที่รอรับสินค้า">
            {orders.map((order) => {
              const progress = orderProgress(orderLines(order), units);
              const pct = progress && progress.ordered > 0 ? Math.min(100, Math.round((progress.received / progress.ordered) * 100)) : 0;
              const partial = order.purchase_order_status === 'partial';
              return (
                <li key={order.purchase_order_id} className="ka-pr-qc">
                  <div className="ka-pr-qc__top">
                    <div className="ka-pr-qc__id">
                      <span className="ka-po-code"><DocumentCode code={order.purchase_order_code} legacyCode={order.legacy_code} /></span>
                      <span className="ka-pr-qc__name">{order.purchase_order_name}</span>
                    </div>
                    <StatusBadge tone={statusTone(order.purchase_order_status)}>{statusLabel(order.purchase_order_status)}</StatusBadge>
                  </div>
                  <p className="ka-po-cap ka-pr-qc__meta numeric">
                    {order.supplier?.supplier_name ?? '-'} · สั่ง {formatThaiDate(order.purchase_date)} · {formatBaht(orderVatSummary(order, vatRate).total)}
                  </p>
                  {progress && (
                    <div>
                      <div className="ka-po-progress__row ka-pr-qc__prog">
                        <span className="ka-po-cap">รับแล้ว</span>
                        <b className="numeric">
                          {progress.received.toLocaleString('th-TH')} / {progress.ordered.toLocaleString('th-TH')} {progress.unit}
                        </b>
                      </div>
                      <div
                        className={`ka-po-meter${progress.received > 0 ? ' ka-pr-meter--partial' : ''}`}
                        role="progressbar"
                        aria-label={`รับแล้ว ${order.purchase_order_code}`}
                        aria-valuemin={0}
                        aria-valuemax={progress.ordered}
                        aria-valuenow={progress.received}
                        aria-valuetext={`${progress.received} จาก ${progress.ordered} ${progress.unit}`}
                      >
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  {canAdd && (
                    <Link href={`${BASE}/new?po=${order.purchase_order_id}`} className="ka-btn ka-btn--primary ka-pr-qc__cta">
                      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                      </svg>
                      {partial ? 'รับส่วนที่เหลือ' : 'รับสินค้า'}
                      <span className="sr-only"> {order.purchase_order_code}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {!expanded && count > QUEUE_PREVIEW && (
            <div className="ka-pr-more">
              <button type="button" className="ka-btn" onClick={() => setExpanded(true)}>
                ดูทั้งหมด {count.toLocaleString('th-TH')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function matchesText(receipt: Receipt, text: string): boolean {
  const term = text.toLowerCase();
  return [
    receipt.purchase_receipt_code,
    receipt.legacy_code,
    receipt.purchaseOrder?.purchase_order_code,
    receipt.supplier?.supplier_name,
    receipt.purchase_receipt_detail,
  ].some((value) => value?.toLowerCase().includes(term));
}

function PurchaseReceiptList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const vatRate = useVatRate();
  const units = useUnitNames();
  const { can } = usePermissions();
  const canAdd = can('purchase_receipt', 'add');
  const canEdit = can('purchase_receipt', 'edit');
  const canDelete = can('purchase_receipt', 'delete');

  usePageCrumb({ parents: ['จัดซื้อ'], current: 'ใบรับสินค้า' });

  // The URL holds search, filters, page and sort, so back from a receipt keeps them.
  const query = params?.get('q') ?? '';
  const statuses = readList(params?.get('status'), STATUS_KEYS);
  const supplierIds = readList(params?.get('supplier'));
  const page = Math.max(1, Number(params?.get('page')) || 1);
  const sortParam = params?.get('sort') as SortKey | null;
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'newest';
  // The API sorts amounts by the line sum (before VAT for "แยก VAT"), not the total on screen, so a sort by
  // amount is also done here (TASK-0325 review F3).
  const local = Boolean(query) || supplierIds.length > 0 || SORTS[sort].field === 'purchase_receipt_total';

  const [searchText, setSearchText] = useState(query);
  const [rows, setRows] = useState<Receipt[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [capped, setCapped] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toDelete, setToDelete] = useState<Receipt | null>(null);
  const [suppliers, setSuppliers] = useState<FilterChipOption[]>([]);

  const setParams = useCallback(
    (next: { q?: string; status?: string[]; supplier?: string[]; page?: number; sort?: SortKey }, mode: 'push' | 'replace' = 'push') => {
      const merged = new URLSearchParams(params?.toString() ?? '');
      const put = (key: string, value: string | undefined, fallback: string) => {
        if (value === undefined) return;
        if (value === fallback || value === '') merged.delete(key);
        else merged.set(key, value);
      };
      put('q', next.q, '');
      put('status', next.status?.join(','), '');
      put('supplier', next.supplier?.join(','), '');
      put('sort', next.sort, 'newest');
      put('page', next.page === undefined ? undefined : String(next.page), '1');
      const href = merged.toString() ? `${pathname}?${merged}` : pathname ?? BASE;
      if (mode === 'replace') router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [params, pathname, router],
  );

  // Search while typing, 300 ms after the last key; a new search starts from page 1.
  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === query) return;
    const timer = window.setTimeout(() => setParams({ q: trimmed, page: 1 }, 'replace'), 300);
    return () => window.clearTimeout(timer);
  }, [searchText, query, setParams]);

  // Back/forward can change the URL's search under the box.
  const lastQuery = useRef(query);
  useEffect(() => {
    if (lastQuery.current !== query && query !== searchText.trim()) setSearchText(query);
    lastQuery.current = query;
  }, [query, searchText]);

  // Every supplier, a hundred per request, so the chip can filter any of them (TASK-0325 review F4).
  useEffect(() => {
    let active = true;
    (async () => {
      const first = await supplierModel.getSuppliers(1, 100, '');
      const all = [...first.data];
      for (let next = 2; next <= (first.meta?.last_page ?? 1); next += 1) {
        all.push(...(await supplierModel.getSuppliers(next, 100, '')).data);
      }
      if (active) setSuppliers(all.map((supplier) => ({ value: supplier.supplier_id, label: supplier.supplier_name })));
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // The fetch below must not rerun because setParams changed identity with the URL (TASK-0325 review F5).
  const setParamsRef = useRef(setParams);
  useEffect(() => {
    setParamsRef.current = setParams;
  }, [setParams]);

  const statusKey = statuses.join(',');
  const supplierKey = supplierIds.join(',');
  // While searching or filtering by supplier the page is applied here, so it is not part of the fetch.
  const requestPage = local ? 1 : page;
  const fetchKey = `${local ? 'local' : page}|${query}|${statusKey}|${supplierKey}|${sort}|${refreshKey}`;
  const loading = loadedKey !== fetchKey;

  useEffect(() => {
    let active = true;
    const filters = statusKey ? { purchase_receipt_status: JSON.stringify(statusKey.split(',')) } : undefined;
    // Here the latest receipts are loaded and sorted or filtered on the page; otherwise the API pages them.
    const { field, order } = local ? SORTS.newest : SORTS[sort];
    const request = local
      ? purchaseReceiptModel.getPurchaseReceipts(1, LOCAL_FILTER_LIMIT, undefined, field, order, filters)
      : purchaseReceiptModel.getPurchaseReceipts(requestPage, PAGE_SIZE, undefined, field, order, filters);
    request
      .then((response) => {
        if (!active) return;
        setRows((response.data ?? []) as Receipt[]);
        setMeta(response.meta ?? null);
        setCapped(local && (response.meta?.total ?? 0) > LOCAL_FILTER_LIMIT);
        setListError(null);
        // A page beyond the end (after a delete or an old link) falls back to the last one.
        if (!local && response.meta && response.meta.last_page > 0 && requestPage > response.meta.last_page) {
          setParamsRef.current({ page: response.meta.last_page }, 'replace');
        }
      })
      .catch((error: unknown) => {
        if (active) setListError(loadErrorText('รายการใบรับสินค้า', error));
      })
      .finally(() => {
        if (active) setLoadedKey(fetchKey);
      });
    return () => {
      active = false;
    };
  }, [fetchKey, local, requestPage, sort, statusKey]);

  // Searching by order code or supplier, or picking suppliers, filters the loaded receipts here.
  const filteredRows = useMemo(() => {
    if (!local) return rows;
    const supplierSet = new Set(supplierKey.split(',').filter(Boolean));
    const matched = rows.filter((row) => (!query || matchesText(row, query)) && (supplierSet.size === 0 || supplierSet.has(row.supplier_id)));
    // The API sorts totals by the line sum; here the grand total on screen decides.
    if (SORTS[sort].field === 'purchase_receipt_total') {
      const sign = SORTS[sort].order === 'DESC' ? -1 : 1;
      return [...matched].sort((a, b) => sign * (receiptVatSummary(a, vatRate).total - receiptVatSummary(b, vatRate).total));
    }
    return matched;
  }, [local, rows, query, supplierKey, sort, vatRate]);

  const total = local ? filteredRows.length : meta?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shownPage = local ? Math.min(page, lastPage) : page;
  const pageRows = local ? filteredRows.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE) : filteredRows;
  const pagerMeta: PaginationMeta | null = local ? { total, page: shownPage, last_page: lastPage, limit: PAGE_SIZE } : meta;
  const from = total === 0 ? 0 : (shownPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(shownPage * PAGE_SIZE, total);
  const filtered = Boolean(query) || supplierIds.length > 0 || statuses.length > 0;
  const nothingYet = !loading && !listError && total === 0 && !filtered;
  const noMatch = !loading && !listError && total === 0 && filtered;

  const refresh = () => setRefreshKey((key) => key + 1);

  const clearFilters = () => {
    setSearchText('');
    setParams({ q: '', status: [], supplier: [], page: 1 });
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      await purchaseReceiptModel.deletePurchaseReceipt(target.purchase_receipt_id);
      toast({ message: `ลบใบรับสินค้า ${target.purchase_receipt_code ?? ''} แล้ว`, tone: 'success' });
      refresh();
    } catch (error) {
      toast({ message: `ลบ ${target.purchase_receipt_code ?? ''} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    }
  };

  const menuFor = (receipt: Receipt): RowMenuItem[] => {
    const href = `${BASE}/${receipt.purchase_receipt_id}`;
    const pending = receipt.purchase_receipt_status === 'pending';
    const items: RowMenuItem[] = [{ label: 'ดูรายละเอียด', icon: 'view', onSelect: () => router.push(href) }];
    if (canEdit && pending) items.push({ label: 'แก้ไข', icon: 'edit', onSelect: () => router.push(`${href}/edit`) });
    // The receipt prints from its own page, which opens the print dialog for `?print=1`.
    items.push({ label: 'พิมพ์', onSelect: () => router.push(`${href}?print=1`) });
    if (canDelete && pending) items.push({ label: 'ลบ', icon: 'delete', tone: 'danger', onSelect: () => setToDelete(receipt) });
    return items;
  };

  const statusOptions: FilterChipOption[] = STATUS_KEYS.map((key) => ({ value: key, label: RECEIPT_STATUS_LABELS[key] }));

  return (
    <div className="ka-page-body ka-po ka-pr">
      <div className="ka-po-ph">
        <div className="ka-po-ph__main">
          <h1 className="ka-ph__title">ใบรับสินค้า</h1>
          <p className="ka-po-cap">รับวัตถุดิบตามใบสั่งซื้อที่อนุมัติแล้ว · สต็อกเพิ่มเมื่ออนุมัติใบรับ</p>
        </div>
      </div>

      <ReceiveQueue canAdd={canAdd} />

      <section className="ka-card ka-po-clip" aria-labelledby="pr-list-title">
        <div className="ka-po-chd">
          <div>
            <h2 id="pr-list-title" className="ka-po-h2">ใบรับสินค้าทั้งหมด</h2>
            <p className="ka-po-cap">บันทึกการรับที่ผ่านมา</p>
          </div>
        </div>

        <div className="ka-po-fbar ka-pr-fbar">
          <div className="ka-po-search">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
            </svg>
            <input
              type="search"
              className="ka-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="เลข PR, เลข PO หรือผู้จำหน่าย"
              aria-label="ค้นหาใบรับสินค้าด้วยเลข PR, เลข PO หรือผู้จำหน่าย"
            />
          </div>
          <FilterChip
            label="ผู้จำหน่าย"
            options={suppliers}
            selected={supplierIds}
            onChange={(values) => setParams({ supplier: values, page: 1 })}
            resultCount={loading ? undefined : total}
          />
          <FilterChip
            label="สถานะ"
            options={statusOptions}
            selected={statuses}
            onChange={(values) => setParams({ status: values, page: 1 })}
            resultCount={loading ? undefined : total}
          />
          <span className="ka-po-fbar__sp" />
          <RowMenu
            label={`เรียงลำดับ: ${SORTS[sort].label}`}
            triggerClassName="ka-chip ka-po-sortchip"
            trigger={
              <>
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M7 12h10M10 17h4" />
                </svg>
                {SORTS[sort].label}
              </>
            }
            items={SORT_KEYS.map((key) => ({
              label: key === sort ? `${SORTS[key].label} (ใช้อยู่)` : SORTS[key].label,
              onSelect: () => setParams({ sort: key, page: 1 }),
            }))}
          />
        </div>

        {capped && (
          <p className="ka-po-cap ka-pr-capped" role="note">
            ค้นหา กรองผู้จำหน่าย และเรียงตามยอด จาก {LOCAL_FILTER_LIMIT.toLocaleString('th-TH')} ใบรับล่าสุด
          </p>
        )}

        <div aria-busy={loading || undefined}>
          {listError && (
            <div className="ka-po-cp">
              <LoadErrorBanner message={listError} onRetry={refresh} />
            </div>
          )}

          {!listError && (loading || pageRows.length > 0) && (
            <>
              <div className="ka-po-tw ka-po-tw--list">
                <table className={`ka-po-lt ka-pr-lt${loading ? ' ka-po-lt--loading' : ''}`}>
                  <caption className="sr-only">ใบรับสินค้า หน้า {shownPage}</caption>
                  <thead>
                    <tr>
                      <th scope="col">ใบรับสินค้า</th>
                      <th scope="col">อ้างอิงใบสั่งซื้อ</th>
                      <th scope="col">ผู้จำหน่าย</th>
                      <th scope="col">วันที่รับ</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col" className="ka-po-r">ยอดรวม (บาท)</th>
                      <th scope="col" className="ka-po-lt__menu"><span className="sr-only">เมนู</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && pageRows.length === 0
                      ? Array.from({ length: 5 }, (_, index) => (
                          <tr key={index} aria-hidden="true">
                            <td colSpan={7}><span className="ka-skel" /></td>
                          </tr>
                        ))
                      : pageRows.map((receipt) => {
                          const vat = receiptVatSummary(receipt, vatRate);
                          const href = `${BASE}/${receipt.purchase_receipt_id}`;
                          const poCode = receipt.purchaseOrder?.purchase_order_code;
                          return (
                            <tr key={receipt.purchase_receipt_id}>
                              <td>
                                <Link href={href} className="ka-po-rowlink">
                                  <span className="ka-po-code"><DocumentCode code={receipt.purchase_receipt_code ?? '-'} legacyCode={receipt.legacy_code} search={query} /></span>
                                </Link>
                                {receipt.purchase_receipt_detail && <span className="ka-po-cap ka-po-lt__name">{receipt.purchase_receipt_detail}</span>}
                              </td>
                              <td className="ka-pr-above">
                                {poCode ? (
                                  <Link href={`/admin/purchase-orders/${receipt.purchase_order_id}`} className="ka-pr-pochip">
                                    {poCode}
                                    <span className="sr-only"> เปิดใบสั่งซื้อ</span>
                                  </Link>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td><span className="ka-po-sup__n">{receipt.supplier?.supplier_name ?? '-'}</span></td>
                              <td className="numeric ka-po-nowrap">{formatThaiDate(receipt.entry_date)}</td>
                              <td>
                                <StatusBadge tone={receiptStatusTone(receipt.purchase_receipt_status)}>{receiptStatusLabel(receipt.purchase_receipt_status)}</StatusBadge>
                              </td>
                              <td className="ka-po-r">
                                <span className="numeric ka-po-amt">{formatMoney(vat.total)}</span>
                                <span className="ka-po-cap ka-po-nowrap numeric">
                                  {vatShortText(receipt.vat_type)} · {receiptQuantityText(receipt, units)}
                                </span>
                              </td>
                              <td className="ka-po-lt__menu">
                                <RowMenu label={`ตัวเลือกของ ${receipt.purchase_receipt_code ?? 'ใบรับสินค้า'}`} items={menuFor(receipt)} />
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              <ul className="ka-po-mlist" aria-label="ใบรับสินค้า">
                {pageRows.map((receipt) => (
                  <li key={receipt.purchase_receipt_id}>
                    <Link href={`${BASE}/${receipt.purchase_receipt_id}`} className="ka-po-mc">
                      <span className="ka-po-mc__row">
                        <span className="ka-po-code"><DocumentCode code={receipt.purchase_receipt_code ?? '-'} legacyCode={receipt.legacy_code} search={query} /></span>
                        <span className="numeric ka-po-mc__amt">{formatBaht(receiptVatSummary(receipt, vatRate).total)}</span>
                      </span>
                      <span className="ka-po-cap ka-po-mc__meta numeric">
                        อ้างอิง {receipt.purchaseOrder?.purchase_order_code ?? '-'} · {formatThaiDate(receipt.entry_date)}
                      </span>
                      <span className="ka-po-mc__row">
                        <span className="ka-po-cap ka-po-mc__meta">{receipt.supplier?.supplier_name ?? '-'}</span>
                        <StatusBadge tone={receiptStatusTone(receipt.purchase_receipt_status)}>{receiptStatusLabel(receipt.purchase_receipt_status)}</StatusBadge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {nothingYet && (
            <div className="ka-po-empty">
              <p className="ka-po-empty__t">ยังไม่มีใบรับสินค้า</p>
              <p className="ka-po-cap">กด “รับสินค้า” ที่ใบสั่งซื้อด้านบนเมื่อของมาถึง ใบรับที่บันทึกแล้วจะแสดงที่นี่</p>
            </div>
          )}

          {noMatch && (
            <div className="ka-po-empty">
              <p className="ka-po-empty__t">{query ? `ไม่พบใบรับสินค้าที่ตรงกับ “${query}”` : 'ไม่พบใบรับสินค้าตามตัวกรองนี้'}</p>
              <p className="ka-po-cap">ลองค้นด้วยเลข PR, เลข PO หรือชื่อผู้จำหน่ายอื่น หรือล้างตัวกรอง</p>
              <button type="button" className="ka-btn" onClick={clearFilters}>ล้างตัวกรอง</button>
            </div>
          )}
        </div>

        {!listError && total > 0 && (
          <div className="ka-po-pager">
            <span className="ka-po-cap numeric" role="status">
              แสดง {from.toLocaleString('th-TH')}–{to.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} รายการ
            </span>
            {pagerMeta && pagerMeta.last_page > 1 && (
              <Pagination meta={pagerMeta} currentPage={shownPage} onPageChange={(next) => setParams({ page: next })} />
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(toDelete)}
        title="ลบใบรับสินค้า"
        message={`ลบ ${toDelete?.purchase_receipt_code ?? ''} จำนวนที่ใบนี้รับไว้จะคืนเป็นยอดคงเหลือของใบสั่งซื้อ ${toDelete?.purchaseOrder?.purchase_order_code ?? ''} ลบแล้วกู้คืนไม่ได้`}
        confirmLabel="ลบใบรับสินค้า"
        cancelLabel="ไม่ลบ"
        onCancel={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export default function PurchaseReceiptPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseReceiptList />
    </Suspense>
  );
}
