'use client';

import { KeyboardEvent, ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SaleOrderModel from '@/models/sale-order';
import type {
  FetchSaleOrder,
  SaleOrder,
  SaleOrderStatus,
  SaleOrderSummary,
} from '@/types/sale-order';
import type { PaginationMeta } from '@/types/pagination';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageCrumb } from '@/lib/page-crumb';
import { formatThaiDate } from '@/lib/date-format';
import DocumentCode from '@/components/DocumentCode';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import Pagination from '@/components/Pagination';
import RowMenu, { RowMenuItem } from '@/components/RowMenu';
import StatusBadge from '@/components/StatusBadge';
import { useOrderActions } from './hooks/useOrderActions';
import {
  allows,
  formatBaht,
  formatMoney,
  paymentState,
  payable,
  SALE_ORDER_TYPE_OPTIONS,
  statusLabel,
  statusTone,
  typeLabel,
} from './lib/so-display';

const saleOrderModel = new SaleOrderModel();
const PAGE_SIZE = 10;
const BASE = '/admin/sale-orders';
const READY_PEEK = 4;
const READY_PAGE = 8;

type TabKey = 'all' | 'pending' | 'approved' | 'partial' | 'paid' | 'returns' | 'cancelled';
type SortKey = 'newest' | 'oldest' | 'total_desc' | 'total_asc';
type RangeKey = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom';

const TABS: { key: TabKey; label: string; statuses?: SaleOrderStatus[] }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รออนุมัติ', statuses: ['pending'] },
  { key: 'approved', label: 'อนุมัติแล้ว', statuses: ['approved'] },
  { key: 'partial', label: 'ชำระบางส่วน', statuses: ['partial'] },
  { key: 'paid', label: 'ชำระครบแล้ว', statuses: ['paid'] },
  { key: 'returns', label: 'คืนสินค้า', statuses: ['partially_returned', 'returned'] },
  { key: 'cancelled', label: 'ยกเลิก', statuses: ['cancelled'] },
];
const TAB_KEYS = TABS.map((tab) => tab.key);

const SORTS: Record<SortKey, { label: string; field: 'create_date' | 'sale_order_total'; order: 'ASC' | 'DESC' }> = {
  newest: { label: 'ล่าสุดก่อน', field: 'create_date', order: 'DESC' },
  oldest: { label: 'เก่าสุดก่อน', field: 'create_date', order: 'ASC' },
  total_desc: { label: 'ยอดมากไปน้อย', field: 'sale_order_total', order: 'DESC' },
  total_asc: { label: 'ยอดน้อยไปมาก', field: 'sale_order_total', order: 'ASC' },
};

const RANGES: { value: RangeKey; label: string }[] = [
  { value: 'all', label: 'ทุกช่วงเวลา' },
  { value: 'today', label: 'วันนี้' },
  { value: '7d', label: '7 วันล่าสุด' },
  { value: '30d', label: '30 วันล่าสุด' },
  { value: 'month', label: 'เดือนนี้' },
  { value: 'custom', label: 'กำหนดเอง' },
];

const pad = (value: number) => String(value).padStart(2, '0');
function isoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
const isDay = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

/** The `date_start` / `date_end` a range preset stands for, counted in local days. */
function rangeDates(range: RangeKey, from: string, to: string): { dateStart?: string; dateEnd?: string } {
  const now = new Date();
  const back = (days: number) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
  if (range === 'today') return { dateStart: isoDay(now), dateEnd: isoDay(now) };
  if (range === '7d') return { dateStart: back(6), dateEnd: isoDay(now) };
  if (range === '30d') return { dateStart: back(29), dateEnd: isoDay(now) };
  if (range === 'month') return { dateStart: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), dateEnd: isoDay(now) };
  if (range === 'custom') return { dateStart: from || undefined, dateEnd: to || undefined };
  return {};
}

function readTab(value: string | null): TabKey {
  return value && (TAB_KEYS as string[]).includes(value) ? (value as TabKey) : 'all';
}
function readRange(value: string | null): RangeKey {
  return RANGES.some((item) => item.value === value) ? (value as RangeKey) : 'all';
}
function readSort(value: string | null): SortKey {
  return value && value in SORTS ? (value as SortKey) : 'newest';
}

function tabCount(summary: SaleOrderSummary | null, key: TabKey): number | undefined {
  if (!summary) return undefined;
  if (key === 'all') return summary.counts.all;
  if (key === 'returns') return (summary.counts.partially_returned ?? 0) + (summary.counts.returned ?? 0);
  return summary.counts[key];
}

function SaleOrdersList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can } = usePermissions();
  const canAdd = can('sale_orders', 'add');
  const canEdit = can('sale_orders', 'edit');
  const canApprove = can('sale_orders', 'approve');
  const canReject = can('sale_orders', 'reject');
  const canDelete = can('sale_orders', 'delete');
  const canReceive = can('payment_receipts', 'add');

  usePageCrumb({ parents: ['งานขาย'], current: 'ใบสั่งขาย' });

  // The URL holds every filter, so back/forward, reload and a shared link keep them.
  const query = params?.get('q') ?? '';
  const tab = readTab(params?.get('tab') ?? null);
  const type = params?.get('type') ?? '';
  const range = readRange(params?.get('range') ?? null);
  const customFrom = isDay(params?.get('from') ?? null) ? (params?.get('from') as string) : '';
  const customTo = isDay(params?.get('to') ?? null) ? (params?.get('to') as string) : '';
  const page = Math.max(1, Number(params?.get('page')) || 1);
  const sort = readSort(params?.get('sort') ?? null);

  const [searchText, setSearchText] = useState(query);
  const [rows, setRows] = useState<SaleOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  // Loading until the rows for the current URL and refresh have arrived, so picking the view that is
  // already shown never leaves it waiting for a fetch that does not happen.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SaleOrderSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [ready, setReady] = useState<FetchSaleOrder[]>([]);
  const [readyMeta, setReadyMeta] = useState<PaginationMeta | null>(null);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [readyLoaded, setReadyLoaded] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [readyPage, setReadyPage] = useState(1);
  const [readySearch, setReadySearch] = useState('');
  const [readyQuery, setReadyQuery] = useState('');
  const [picked, setPicked] = useState<Record<string, FetchSaleOrder>>({});
  // Small screens: the ready goods and the filters open on request.
  const [phoneReady, setPhoneReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setParams = useCallback(
    (
      next: Partial<{ q: string; tab: TabKey; type: string; range: RangeKey; from: string; to: string; page: number; sort: SortKey }>,
      mode: 'push' | 'replace' = 'push',
    ) => {
      const merged = new URLSearchParams(params?.toString() ?? '');
      const put = (key: string, value: string | undefined, fallback: string) => {
        if (value === undefined) return;
        if (value === fallback || value === '') merged.delete(key);
        else merged.set(key, value);
      };
      put('q', next.q, '');
      put('tab', next.tab, 'all');
      put('type', next.type, '');
      put('range', next.range, 'all');
      put('from', next.from, '');
      put('to', next.to, '');
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

  const statuses = TABS.find((item) => item.key === tab)?.statuses;
  const dates = useMemo(() => rangeDates(range, customFrom, customTo), [range, customFrom, customTo]);
  const badRange = Boolean(dates.dateStart && dates.dateEnd && dates.dateStart > dates.dateEnd);

  const fetchKey = `${page}|${query}|${sort}|${tab}|${type}|${range}|${customFrom}|${customTo}|${refreshKey}`;
  const loading = loadedKey !== fetchKey;

  useEffect(() => {
    let active = true;
    const queryKey = fetchKey;
    saleOrderModel
      .getSaleOrders(page, PAGE_SIZE, query || undefined, SORTS[sort].field, SORTS[sort].order, type || undefined, {
        statuses,
        dateStart: badRange ? undefined : dates.dateStart,
        dateEnd: badRange ? undefined : dates.dateEnd,
      })
      .then((response) => {
        if (!active) return;
        setRows(response.data ?? []);
        setMeta(response.meta ?? null);
        setListError(null);
        // A page beyond the end (after a delete or an old link) falls back to the last one.
        if (response.meta && response.meta.last_page > 0 && page > response.meta.last_page) {
          setParams({ page: response.meta.last_page }, 'replace');
        }
      })
      .catch((error: unknown) => {
        if (active) setListError(loadErrorText('รายการใบสั่งขาย', error));
      })
      .finally(() => {
        if (active) setLoadedKey(queryKey);
      });
    return () => {
      active = false;
    };
    // fetchKey stands for every input the request reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  useEffect(() => {
    let active = true;
    saleOrderModel
      .getSaleOrderSummary(type || undefined)
      .then((loaded) => {
        if (!active) return;
        setSummary(loaded);
        setSummaryError(false);
      })
      .catch(() => {
        if (active) setSummaryError(true);
      });
    return () => {
      active = false;
    };
  }, [type, refreshKey]);

  // Ready-to-sell goods: a short row first, the whole list with search and pages once opened.
  useEffect(() => {
    let active = true;
    const size = readyOpen ? READY_PAGE : READY_PEEK;
    saleOrderModel
      .getFetchSaleOrders(readyOpen ? readyPage : 1, size, readyOpen ? readyQuery : undefined)
      .then((response) => {
        if (!active) return;
        setReady(response.data ?? []);
        setReadyMeta(response.meta ?? null);
        setReadyError(null);
      })
      .catch((error: unknown) => {
        if (active) setReadyError(loadErrorText('สินค้าพร้อมขาย', error));
      })
      .finally(() => {
        if (active) setReadyLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [readyOpen, readyPage, readyQuery, refreshKey]);

  // The Dashboard's "สร้างใบขาย" opens this page at #ready: once the goods have loaded, bring them into
  // view, move focus to the heading and drop the hash so later loads leave the user where they are.
  const readyJumpDone = useRef(false);
  useEffect(() => {
    if (readyJumpDone.current) return;
    if (window.location.hash !== '#ready') {
      readyJumpDone.current = true;
      return;
    }
    if (!readyLoaded) return;
    readyJumpDone.current = true;
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
    const heading = document.getElementById('ready-title');
    if (!heading) return;
    heading.scrollIntoView({ block: 'start' });
    heading.focus({ preventScroll: true });
  }, [readyLoaded]);

  // Arriving at #ready on a phone opens the ready goods, which are folded away there.
  const [readyHashSeen, setReadyHashSeen] = useState(false);
  if (readyLoaded && !readyHashSeen) {
    setReadyHashSeen(true);
    if (window.location.hash === '#ready') setPhoneReady(true);
  }

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const actions = useOrderActions({
    onChanged: refresh,
    onDeleted: refresh,
  });

  const pickTab = (key: TabKey) => setParams({ tab: key, page: 1 });
  const clearFilters = () => {
    setSearchText('');
    setParams({ q: '', tab: 'all', type: '', range: 'all', from: '', to: '', page: 1 });
  };

  const menuFor = (order: SaleOrder): RowMenuItem[] => {
    const items: RowMenuItem[] = [
      { label: 'ดูรายละเอียด', icon: 'view', onSelect: () => router.push(`${BASE}/${order.sale_order_id}`) },
    ];
    if (canApprove && allows.approve(order)) items.push({ label: 'อนุมัติ', icon: 'status', onSelect: () => actions.request('approve', order) });
    if (canReceive && allows.pay(order)) items.push({ label: 'รับชำระ', icon: 'status', onSelect: () => actions.request('pay', order) });
    if (canEdit && allows.edit(order)) items.push({ label: 'แก้ไข', icon: 'edit', onSelect: () => router.push(`${BASE}/${order.sale_order_id}/edit`) });
    if (canEdit && allows.return(order)) items.push({ label: 'คืนสินค้า', icon: 'copy', onSelect: () => router.push(`${BASE}/${order.sale_order_id}?return=1`) });
    if (canReject && allows.cancel(order)) items.push({ label: 'ยกเลิกเอกสาร', icon: 'cancel', tone: 'danger', onSelect: () => actions.request('cancel', order) });
    if (canDelete && allows.remove(order)) items.push({ label: 'ลบ', icon: 'delete', tone: 'danger', onSelect: () => actions.request('delete', order) });
    return items;
  };

  const onTabsKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TAB_KEYS.indexOf(tab);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TAB_KEYS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TAB_KEYS.length - 1;
    else return;
    event.preventDefault();
    pickTab(TAB_KEYS[next]);
    requestAnimationFrame(() => document.getElementById(`so-tab-${TAB_KEYS[next]}`)?.focus());
  };

  const pickedList = Object.values(picked);
  const togglePicked = (item: FetchSaleOrder) =>
    setPicked((current) => {
      const next = { ...current };
      if (next[item.fetch_sale_order_id]) delete next[item.fetch_sale_order_id];
      else next[item.fetch_sale_order_id] = item;
      return next;
    });

  const total = meta?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const filtered = Boolean(query) || tab !== 'all' || Boolean(type) || range !== 'all';
  const nothingYet = !loading && !listError && total === 0 && !filtered;
  const noMatch = !loading && !listError && total === 0 && filtered;
  const monthDelta =
    summary && summary.received_this_month !== null && summary.received_last_month
      ? Math.round(((summary.received_this_month - summary.received_last_month) / summary.received_last_month) * 100)
      : null;

  const createButton = canAdd && (
    <Link href={`${BASE}/new`} className="ka-btn ka-btn--primary">
      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
      สร้างใบสั่งขาย
    </Link>
  );

  const money = (value: number | null | undefined) =>
    value === null || value === undefined ? <span aria-label="ไม่มีสิทธิ์ดูยอดนี้">—</span> : formatBaht(value);
  const count = (value: number | undefined) => (value === undefined ? '–' : value.toLocaleString('th-TH'));

  const typeName = type ? SALE_ORDER_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type : 'ทั้งหมด';
  const rangeName = RANGES.find((item) => item.value === range)?.label ?? 'ทุกช่วงเวลา';
  const activeFilters = (type ? 1 : 0) + (range !== 'all' ? 1 : 0);
  const chevron = (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
  const typeMenu = (
    <RowMenu
      label={`ประเภท: ${typeName}`}
      triggerClassName="ka-so-chip"
      trigger={<>ประเภท: {typeName}{chevron}</>}
      items={[{ value: '', label: 'ทั้งหมด' }, ...SALE_ORDER_TYPE_OPTIONS].map((option) => ({
        label: option.value === type ? `${option.label} (ใช้อยู่)` : option.label,
        onSelect: () => setParams({ type: option.value, page: 1 }),
      }))}
    />
  );
  const dateMenu = (
    <span className="ka-so-fbar__menu" data-active={range !== 'all' || undefined}>
      <RowMenu
        label={`ช่วงวันที่: ${rangeName}`}
        triggerClassName={`ka-so-chip${range !== 'all' ? ' ka-so-chip--on' : ''}`}
        trigger={
          <>
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {rangeName}
          </>
        }
        items={RANGES.map((item) => ({
          label: item.value === range ? `${item.label} (ใช้อยู่)` : item.value === 'custom' ? 'กำหนดเอง…' : item.label,
          onSelect: () => setParams({ range: item.value, page: 1 }),
        }))}
      />
    </span>
  );
  const sortHead = (field: 'create_date' | 'sale_order_total', label: string) => {
    const on = SORTS[sort].field === field;
    const next: SortKey = field === 'create_date' ? (sort === 'newest' ? 'oldest' : 'newest') : sort === 'total_desc' ? 'total_asc' : 'total_desc';
    return (
      <button type="button" className="ka-so-sort" data-on={on || undefined} onClick={() => setParams({ sort: next, page: 1 })}>
        {label}
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={on && SORTS[sort].order === 'ASC' ? 'm4.5 15.75 7.5-7.5 7.5 7.5' : 'm19.5 8.25-7.5 7.5-7.5-7.5'} />
        </svg>
      </button>
    );
  };
  const ariaSort = (field: 'create_date' | 'sale_order_total') =>
    SORTS[sort].field === field ? (SORTS[sort].order === 'ASC' ? 'ascending' : 'descending') : undefined;

  const KPI_ICONS = {
    clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    cash: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    trend: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
    cube: 'm21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
  };
  const kpiBody = (tone: string, icon: string, label: string, value: ReactNode, foot: ReactNode, footClass = '') => (
    <>
      <span className="ka-so-tone ka-so-kpi__ic" data-tone={tone} aria-hidden="true">
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
      </span>
      <span className="ka-so-kpi__k">{label}</span>
      <span className="ka-so-kpi__v">{value}</span>
      <span className={`ka-so-kpi__f${footClass}`}>{foot}</span>
    </>
  );

  const readyTotal = readyMeta?.total;
  const pageCount = meta?.last_page ?? 1;

  return (
    <div className="ka-page-body ka-so">
      <div className="ka-so-ph">
        <div className="ka-so-ph__main">
          <h1 className="ka-ph__title">ใบสั่งขาย</h1>
          <p className="ka-so-ph__sub ka-so-ph__sub--wide">จองสินค้า อนุมัติตัดสต็อก รับชำระ และคืนสินค้า ในที่เดียว</p>
          {summary && (
            <p className="ka-so-ph__sub ka-so-ph__sub--phone">
              {count(summary.counts.all)} ใบ · {count(summary.counts.pending)} ใบรออนุมัติ
            </p>
          )}
        </div>
        {createButton && <div className="ka-so-ph__acts ka-so-ph__acts--top">{createButton}</div>}
      </div>

      {summaryError && <p role="status" className="ka-so-cap">โหลดตัวเลขสรุปไม่สำเร็จ รายการด้านล่างยังใช้งานได้</p>}

      <div className="ka-so-kpis">
        <button type="button" className="ka-so-kpi" aria-pressed={tab === 'pending'} onClick={() => pickTab('pending')}>
          {kpiBody('warning', KPI_ICONS.clock, 'รออนุมัติ', summary ? `${count(summary.counts.pending)} ใบ` : '–', summary ? `รวม ${formatBaht(summary.pending_total)} · จองสต็อกไว้แล้ว` : '')}
        </button>
        <div className="ka-so-kpi">
          {kpiBody('brand', KPI_ICONS.cash, 'ยอดค้างรับ', summary ? formatBaht(summary.outstanding_total) : '–', summary ? `จาก ${count(summary.outstanding_count)} ใบที่อนุมัติแล้ว` : '')}
        </div>
        <div className="ka-so-kpi">
          {kpiBody(
            'success',
            KPI_ICONS.trend,
            'รับชำระเดือนนี้',
            summary ? money(summary.received_this_month) : '–',
            monthDelta === null ? '' : `${monthDelta >= 0 ? '▲' : '▼'} ${Math.abs(monthDelta)}% จากเดือนก่อน`,
            monthDelta === null ? '' : monthDelta >= 0 ? ' ka-so-up' : ' ka-so-down',
          )}
        </div>
        <div className="ka-so-kpi">
          {kpiBody('info', KPI_ICONS.cube, 'สินค้าพร้อมขาย', readyTotal === undefined ? '–' : `${count(readyTotal)} รายการ`, 'จากใบสั่งผลิตที่ผลิตเสร็จแล้ว')}
        </div>
      </div>

      <button type="button" className="ka-so-readylink" aria-expanded={phoneReady} aria-controls="ready" onClick={() => setPhoneReady((open) => !open)}>
        <span className="ka-so-readylink__ic" aria-hidden="true">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={KPI_ICONS.cube} /></svg>
        </span>
        <span className="ka-so-readylink__b">
          <span className="ka-so-readylink__t">สินค้าพร้อมขาย {readyTotal === undefined ? '' : `${count(readyTotal)} รายการ`}</span>
          <span className="ka-so-readylink__s">เลือกสินค้าแล้วสร้างใบสั่งขาย</span>
        </span>
        <svg className="ka-so-readylink__ch" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      <div className="ka-so-readywrap" data-open={phoneReady || undefined}>
        <section id="ready" className="ka-so-card ka-so-ready" aria-labelledby="ready-title">
          <div className="ka-so-ready__head">
            <h2 id="ready-title" tabIndex={-1} className="ka-so-h2">สินค้าพร้อมขาย</h2>
            {readyTotal !== undefined && <span className="ka-so-pill">{count(readyTotal)} รายการ</span>}
            <span className="ka-so-ready__hint ka-so-ready__hint--head">จากใบสั่งผลิตที่ผลิตเสร็จ เลือกแล้วสร้างใบสั่งขายได้ทันที</span>
            {(readyTotal ?? 0) > READY_PEEK && (
              <button type="button" className="ka-so-link" aria-expanded={readyOpen} onClick={() => setReadyOpen((open) => !open)}>
                {readyOpen ? 'แสดงน้อยลง' : 'ดูทั้งหมด'}
              </button>
            )}
          </div>
          {readyOpen && (
            <form
              className="ka-so-ready__search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setReadyPage(1);
                setReadyQuery(readySearch.trim());
              }}
            >
              <input type="search" className="ka-input" value={readySearch} onChange={(event) => setReadySearch(event.target.value)} placeholder="ค้นหาสินค้าพร้อมขาย" aria-label="ค้นหาสินค้าพร้อมขาย" />
              <button type="submit" className="ka-btn">ค้นหา</button>
            </form>
          )}
          {readyError && <LoadErrorBanner message={readyError} onRetry={refresh} />}
          {!readyError && readyLoaded && ready.length === 0 && (
            <p className="ka-so-cap">{readyQuery ? `ไม่พบสินค้าพร้อมขายที่ตรงกับ “${readyQuery}”` : 'ยังไม่มีสินค้าพร้อมขาย เมื่อใบสั่งผลิตเสร็จ สินค้าจะมาแสดงที่นี่'}</p>
          )}
          {ready.length > 0 && (
            <ul className="ka-so-ready__grid" aria-label="สินค้าพร้อมขาย">
              {ready.map((item) => {
                const checked = Boolean(picked[item.fetch_sale_order_id]);
                return (
                  <li key={item.fetch_sale_order_id}>
                    <label className="ka-so-rc" data-checked={checked || undefined}>
                      <input type="checkbox" className="ka-check" checked={checked} disabled={!canAdd} onChange={() => togglePicked(item)} />
                      <span className="ka-so-rc__b">
                        <span className="ka-so-rc__n">{item.fetch_sale_order_name}</span>
                        {item.jobOrder?.job_order_code && <span className="ka-so-cap">{item.jobOrder.job_order_code}</span>}
                        <span className="ka-so-rc__m">
                          <span className="ka-so-ok">พร้อมขาย {Number(item.fetch_sale_order_qty).toLocaleString('th-TH')}</span>
                          <span>{formatBaht(Number(item.fetch_sale_order_price))} / ชิ้น</span>
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {readyOpen && readyMeta && readyMeta.last_page > 1 && (
            <div className="ka-so-ready__pager">
              <Pagination meta={readyMeta} currentPage={readyPage} onPageChange={setReadyPage} />
            </div>
          )}
          {canAdd && (
            <div className="ka-so-ready__foot">
              <span className="ka-so-ready__hint" role="status">เลือกแล้ว <strong>{pickedList.length.toLocaleString('th-TH')} รายการ</strong></span>
              <span className="ka-so-ready__sp" />
              {pickedList.length > 0 && (
                <button type="button" className="ka-btn" onClick={() => setPicked({})}>ล้างที่เลือก</button>
              )}
              {pickedList.length > 0 ? (
                <Link href={`${BASE}/new?ready=${pickedList.map((item) => item.fetch_sale_order_id).join(',')}`} className="ka-btn ka-btn--primary">
                  สร้างใบสั่งขายจาก {pickedList.length.toLocaleString('th-TH')} รายการ
                </Link>
              ) : (
                <button type="button" className="ka-btn ka-btn--primary" disabled>สร้างใบสั่งขายจากที่เลือก</button>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="ka-so-card ka-so-list" aria-label="รายการใบสั่งขาย">
        <div className="ka-so-tabs" role="tablist" aria-label="สถานะใบสั่งขาย" onKeyDown={onTabsKey}>
          {TABS.map((item) => {
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                id={`so-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="so-list-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => pickTab(item.key)}
              >
                {item.label}
                <span>{count(tabCount(summary, item.key))}</span>
              </button>
            );
          })}
        </div>

        <div className="ka-so-fbar">
          <div className="ka-so-search">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="search"
              className="ka-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="ค้นหาเลขที่หรือชื่อใบสั่งขาย"
              aria-label="ค้นหาใบสั่งขายด้วยเลขที่หรือชื่อ"
            />
          </div>
          <span className="ka-so-fbar__menu">{typeMenu}</span>
          {dateMenu}
          <button
            type="button"
            className="ka-so-ftoggle"
            aria-expanded={filtersOpen}
            aria-label={`ตัวกรอง${activeFilters ? ` (ใช้อยู่ ${activeFilters})` : ''}`}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            {activeFilters > 0 && <span className="ka-so-ftoggle__n" aria-hidden="true">{activeFilters}</span>}
          </button>
          <span className="ka-so-fbar__count" role="status">
            {total > 0 ? `แสดง ${from.toLocaleString('th-TH')}–${to.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')} ใบ` : ''}
          </span>
        </div>

        {filtersOpen && (
          <div className="ka-so-fpanel">
            {typeMenu}
            {dateMenu}
            <RowMenu
              label={`เรียงลำดับ: ${SORTS[sort].label}`}
              triggerClassName="ka-so-chip"
              trigger={<>{SORTS[sort].label}{chevron}</>}
              items={(Object.keys(SORTS) as SortKey[]).map((key) => ({
                label: key === sort ? `${SORTS[key].label} (ใช้อยู่)` : SORTS[key].label,
                onSelect: () => setParams({ sort: key, page: 1 }),
              }))}
            />
          </div>
        )}

        {range === 'custom' && (
          <div className="ka-so-dates">
            <label className="ka-so-date">
              <span className="ka-label">ตั้งแต่วันที่</span>
              <input type="date" className="ka-input" value={customFrom} max={customTo || undefined} onChange={(event) => setParams({ from: event.target.value, page: 1 }, 'replace')} />
            </label>
            <label className="ka-so-date">
              <span className="ka-label">ถึงวันที่</span>
              <input type="date" className="ka-input" value={customTo} min={customFrom || undefined} onChange={(event) => setParams({ to: event.target.value, page: 1 }, 'replace')} />
            </label>
            {badRange && <span role="alert" className="ka-error">วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด</span>}
          </div>
        )}

        <div id="so-list-panel" role="tabpanel" aria-labelledby={`so-tab-${tab}`} aria-busy={loading || undefined}>
          {listError && (
            <div className="ka-so-cp">
              <LoadErrorBanner message={listError} onRetry={refresh} />
            </div>
          )}

          {!listError && (loading || rows.length > 0) && (
            <>
              <div className="ka-so-tw ka-so-tw--list">
                <table className={`ka-so-lt${loading ? ' ka-so-lt--loading' : ''}`}>
                  <caption className="sr-only">ใบสั่งขาย {TABS.find((item) => item.key === tab)?.label} หน้า {page}</caption>
                  <thead>
                    <tr>
                      <th scope="col">เลขที่ / ชื่อใบสั่งขาย</th>
                      <th scope="col" className="ka-so-lt__type">ประเภท</th>
                      <th scope="col" className="ka-so-lt__date" aria-sort={ariaSort('create_date')}>{sortHead('create_date', 'วันที่')}</th>
                      <th scope="col" className="ka-so-r" aria-sort={ariaSort('sale_order_total')}>{sortHead('sale_order_total', 'ยอดรวม (บาท)')}</th>
                      <th scope="col" className="ka-so-lt__pay">การชำระ</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col" className="ka-so-lt__menu"><span className="sr-only">เมนู</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && rows.length === 0
                      ? Array.from({ length: 5 }, (_, index) => (
                          <tr key={index} aria-hidden="true">
                            <td colSpan={7}><span className="ka-skel" /></td>
                          </tr>
                        ))
                      : rows.map((order) => {
                          const pay = paymentState(order);
                          return (
                            <tr key={order.sale_order_id}>
                              <td>
                                <Link href={`${BASE}/${order.sale_order_id}`} className="ka-so-rowlink ka-so-code">
                                  <DocumentCode code={order.sale_order_code} legacyCode={order.legacy_code} search={query} />
                                </Link>
                                <span className="ka-so-lt__name">{order.sale_order_name}</span>
                                <span className="ka-so-lt__sub">{typeLabel(order.sale_order_type)} · {formatThaiDate(order.create_date)}</span>
                              </td>
                              <td className="ka-so-lt__type ka-so-lt__muted">{typeLabel(order.sale_order_type)}</td>
                              <td className="ka-so-lt__date ka-so-lt__muted">{formatThaiDate(order.create_date)}</td>
                              <td className="ka-so-r ka-so-lt__amt">{formatMoney(payable(order))}</td>
                              <td className="ka-so-lt__pay">
                                <span className="ka-so-meter" data-tone={pay.tone} aria-hidden="true"><i style={{ width: `${pay.percent}%` }} /></span>
                                <span className="ka-so-pay">{pay.text}</span>
                              </td>
                              <td>
                                <StatusBadge tone={statusTone(order.sale_order_status)}>{statusLabel(order.sale_order_status)}</StatusBadge>
                              </td>
                              <td className="ka-so-lt__menu">
                                <RowMenu label={`ตัวเลือกของ ${order.sale_order_code ?? order.sale_order_name}`} items={menuFor(order)} />
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              <ul className="ka-so-mlist" aria-label="ใบสั่งขาย">
                {rows.map((order) => {
                  const pay = paymentState(order);
                  return (
                    <li key={order.sale_order_id}>
                      <Link href={`${BASE}/${order.sale_order_id}`} className="ka-so-mc">
                        <span className="ka-so-mc__row">
                          <span className="ka-so-mc__code"><DocumentCode code={order.sale_order_code} legacyCode={order.legacy_code} search={query} /></span>
                          <StatusBadge tone={statusTone(order.sale_order_status)}>{statusLabel(order.sale_order_status)}</StatusBadge>
                        </span>
                        <span className="ka-so-mc__name">{order.sale_order_name}</span>
                        <span className="ka-so-cap">{typeLabel(order.sale_order_type)} · {formatThaiDate(order.create_date)}</span>
                        <span className="ka-so-mc__row ka-so-mc__row--pay">
                          <span className="ka-so-meter" data-tone={pay.tone} aria-hidden="true"><i style={{ width: `${pay.percent}%` }} /></span>
                          <span className="ka-so-mc__amt">{formatBaht(payable(order))}</span>
                        </span>
                        <span className="sr-only">{pay.text}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {nothingYet && (
            <div className="ka-so-empty">
              <p className="ka-so-empty__t">ยังไม่มีใบสั่งขาย</p>
              <p className="ka-so-cap">สร้างใบสั่งขายจากสินค้าพร้อมขาย แล้วติดตามการอนุมัติ การรับชำระ และการคืนสินค้าได้ที่นี่</p>
              {createButton}
            </div>
          )}

          {noMatch && (
            <div className="ka-so-empty">
              <p className="ka-so-empty__t">ไม่พบใบสั่งขายที่ตรงกับตัวกรอง</p>
              <p className="ka-so-cap">ลองค้นด้วยเลขที่หรือชื่ออื่น เปลี่ยนช่วงวันที่ หรือดูทุกสถานะ</p>
              <button type="button" className="ka-btn" onClick={clearFilters}>ล้างตัวกรอง</button>
            </div>
          )}
        </div>

        {!listError && total > 0 && (
          <div className="ka-so-pager">
            <span className="ka-so-pager__t">
              <span className="ka-so-pager__lg">หน้า {page.toLocaleString('th-TH')} จาก {pageCount.toLocaleString('th-TH')}</span>
              <span className="ka-so-pager__md">{from.toLocaleString('th-TH')}–{to.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} ใบ</span>
            </span>
            {meta && meta.last_page > 1 && <Pagination meta={meta} currentPage={page} onPageChange={(next) => setParams({ page: next })} />}
          </div>
        )}
      </section>

      {createButton && <div className="ka-so-fab">{createButton}</div>}
      {actions.dialogs}
    </div>
  );
}

export default function SaleOrdersPage() {
  return (
    <Suspense fallback={null}>
      <SaleOrdersList />
    </Suspense>
  );
}
