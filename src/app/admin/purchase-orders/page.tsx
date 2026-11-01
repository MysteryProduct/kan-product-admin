'use client';

import { KeyboardEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import PurchaseOrderModel from '@/models/purchase-order';
import type { PurchaseOrder } from '@/types/purchase-order';
import type { PaginationMeta } from '@/types/pagination';
import axiosInstance from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import useVatRate from '@/hooks/useVatRate';
import { usePageCrumb } from '@/lib/page-crumb';
import { formatThaiDate } from '@/lib/date-format';
import { getApiErrorMessage } from '@/lib/api-error';
import { VAT_TYPE_LABELS } from '@/lib/vat';
import ConfirmDialog from '@/components/ConfirmDialog';
import CancellationDialog from '@/components/CancellationDialog';
import DocumentCode from '@/components/DocumentCode';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import Pagination from '@/components/Pagination';
import RowMenu, { RowMenuItem } from '@/components/RowMenu';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import {
  formatMoney,
  orderLines,
  orderVatSummary,
  PurchaseOrderStatus,
  statusLabel,
  statusTone,
  supplierInitials,
} from './lib/po-display';

const purchaseOrderModel = new PurchaseOrderModel();
const PAGE_SIZE = 10;
const BASE = '/admin/purchase-orders';

type TabKey = 'all' | PurchaseOrderStatus;
type SortKey = 'newest' | 'oldest';

// "ฉบับร่าง" (TASK-0320) sits before the approval queue and shows once there is a draft.
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'draft', label: 'ฉบับร่าง' },
  { key: 'pending', label: 'รออนุมัติ' },
  { key: 'active', label: 'รอรับสินค้า' },
  { key: 'partial', label: 'รับบางส่วน' },
  { key: 'completed', label: 'รับครบแล้ว' },
  { key: 'inactive', label: 'ยกเลิก' },
];
const TAB_KEYS = TABS.map((tab) => tab.key);

const SORTS: Record<SortKey, { label: string; order: 'ASC' | 'DESC' }> = {
  newest: { label: 'ล่าสุดก่อน', order: 'DESC' },
  oldest: { label: 'เก่าสุดก่อน', order: 'ASC' },
};

type Counts = Partial<Record<TabKey, number>>;

/** How many orders each tab holds: the API's `meta.total` for one row of each status. */
async function countByStatus(search: string): Promise<Counts> {
  const entries = await Promise.all(
    TABS.map(async ({ key }) => {
      const filters = key === 'all' ? undefined : { purchase_order_status: JSON.stringify([key]) };
      const response = await purchaseOrderModel.getPurchaseOrders(1, 1, search || undefined, null, undefined, filters);
      return [key, response.meta?.total ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function readTab(value: string | null): TabKey {
  return value && (TAB_KEYS as string[]).includes(value) ? (value as TabKey) : 'all';
}

function PurchaseOrdersList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const vatRate = useVatRate();
  const { can } = usePermissions();
  const canAdd = can('purchase_orders', 'add');
  const canEdit = can('purchase_orders', 'edit');
  const canDelete = can('purchase_orders', 'delete');
  const canReject = can('purchase_orders', 'reject');

  usePageCrumb({ parents: ['จัดซื้อ'], current: 'ใบสั่งซื้อ' });

  // The URL holds the search, tab, page and sort, so back/forward and a shared link keep them.
  const query = params?.get('q') ?? '';
  const tab = readTab(params?.get('tab') ?? null);
  const page = Math.max(1, Number(params?.get('page')) || 1);
  const sort: SortKey = params?.get('sort') === 'oldest' ? 'oldest' : 'newest';

  const [searchText, setSearchText] = useState(query);
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [tabCounts, setTabCounts] = useState<Counts>({});
  const [overall, setOverall] = useState<Counts | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toDelete, setToDelete] = useState<PurchaseOrder | null>(null);
  const [toReject, setToReject] = useState<PurchaseOrder | null>(null);

  const setParams = useCallback(
    (next: { q?: string; tab?: TabKey; page?: number; sort?: SortKey }, mode: 'push' | 'replace' = 'push') => {
      const merged = new URLSearchParams(params?.toString() ?? '');
      const put = (key: string, value: string | undefined, fallback: string) => {
        if (value === undefined) return;
        if (value === fallback || value === '') merged.delete(key);
        else merged.set(key, value);
      };
      put('q', next.q, '');
      put('tab', next.tab, 'all');
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

  useEffect(() => {
    let active = true;
    const filters = tab === 'all' ? undefined : { purchase_order_status: JSON.stringify([tab]) };
    purchaseOrderModel
      .getPurchaseOrders(page, PAGE_SIZE, query || undefined, 'purchase_date', SORTS[sort].order, filters)
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
        if (active) setListError(loadErrorText('รายการใบสั่งซื้อ', error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, sort, tab, refreshKey, setParams]);

  useEffect(() => {
    let active = true;
    countByStatus(query)
      .then((counts) => {
        if (!active) return;
        setTabCounts(counts);
        if (!query) setOverall(counts);
      })
      .catch(() => {
        // Counts are a hint; the list itself reports a failed load.
      });
    return () => {
      active = false;
    };
  }, [query, refreshKey]);

  // The summary cards count every order, whatever is typed in the search box.
  useEffect(() => {
    if (!query || overall) return;
    let active = true;
    countByStatus('')
      .then((counts) => active && setOverall(counts))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [query, overall]);

  const refresh = () => {
    setLoading(true);
    setOverall(null);
    setRefreshKey((key) => key + 1);
  };

  const pickTab = (key: TabKey) => {
    setLoading(true);
    setParams({ tab: key, page: 1 });
  };

  const clearFilters = () => {
    setSearchText('');
    setLoading(true);
    setParams({ q: '', tab: 'all', page: 1 });
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      await purchaseOrderModel.deletePurchaseOrder(target.purchase_order_id);
      toast({ message: `ลบใบสั่งซื้อ ${target.purchase_order_code} แล้ว`, tone: 'success' });
      refresh();
    } catch (error) {
      toast({ message: `ลบ ${target.purchase_order_code} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    }
  };

  const menuFor = (order: PurchaseOrder): RowMenuItem[] => {
    const status = order.purchase_order_status;
    const items: RowMenuItem[] = [
      { label: 'ดูรายละเอียด', icon: 'view', onSelect: () => router.push(`${BASE}/${order.purchase_order_id}`) },
    ];
    if (canEdit && (status === 'pending' || status === 'draft')) {
      items.push({ label: 'แก้ไข', icon: 'edit', onSelect: () => router.push(`${BASE}/${order.purchase_order_id}/edit`) });
    }
    if (canAdd) items.push({ label: 'สั่งซ้ำ', icon: 'copy', onSelect: () => router.push(`${BASE}/new?copy=${order.purchase_order_id}`) });
    if (canReject && (status === 'pending' || status === 'active')) {
      items.push({ label: 'ยกเลิกใบสั่งซื้อ', icon: 'cancel', tone: 'danger', onSelect: () => setToReject(order) });
    }
    if (canDelete) items.push({ label: 'ลบ', icon: 'delete', tone: 'danger', onSelect: () => setToDelete(order) });
    return items;
  };

  const visibleTabs = TABS.filter((item) => item.key !== 'draft' || (tabCounts.draft ?? 0) > 0 || tab === 'draft');

  const onTabsKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = visibleTabs.findIndex((item) => item.key === tab);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % visibleTabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + visibleTabs.length) % visibleTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = visibleTabs.length - 1;
    else return;
    event.preventDefault();
    pickTab(visibleTabs[next].key);
    requestAnimationFrame(() => document.getElementById(`po-tab-${visibleTabs[next].key}`)?.focus());
  };

  const kpis = useMemo(
    () => [
      { key: 'pending' as TabKey, label: 'รออนุมัติ', tone: 'warning', value: overall?.pending, note: 'รอผู้มีสิทธิ์อนุมัติ' },
      {
        key: 'active' as TabKey,
        label: 'รอรับสินค้า',
        tone: 'info',
        value: overall ? (overall.active ?? 0) + (overall.partial ?? 0) : undefined,
        note: 'รวมรับบางส่วน',
      },
      { key: 'completed' as TabKey, label: 'รับครบแล้ว', tone: 'success', value: overall?.completed, note: 'ทั้งหมดในระบบ' },
    ],
    [overall],
  );

  const total = meta?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const filtered = Boolean(query) || tab !== 'all';
  const nothingYet = !loading && !listError && total === 0 && !filtered;
  const noMatch = !loading && !listError && total === 0 && filtered;

  const createButton = canAdd && (
    <Link href={`${BASE}/new`} className="ka-btn ka-btn--primary">
      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
      สร้างใบสั่งซื้อ
    </Link>
  );

  return (
    <div className="ka-page-body ka-po">
      <div className="ka-po-ph">
        <div className="ka-po-ph__main">
          <h1 className="ka-ph__title">ใบสั่งซื้อ</h1>
          <p className="ka-po-cap">สั่งวัตถุดิบจากผู้จำหน่าย ติดตามการอนุมัติและการรับสินค้า</p>
        </div>
        {createButton && <div className="ka-po-ph__acts">{createButton}</div>}
      </div>

      <div className="ka-po-kpis">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            type="button"
            className="ka-po-kpi"
            aria-pressed={tab === kpi.key}
            onClick={() => pickTab(kpi.key)}
          >
            <span className="ka-po-kpi__k">
              <i className={`ka-po-dot ka-po-dot--${kpi.tone}`} aria-hidden="true" />
              {kpi.label}
            </span>
            <span className="ka-po-kpi__v numeric">{kpi.value === undefined ? '–' : kpi.value.toLocaleString('th-TH')}</span>
            <span className="ka-po-cap">{kpi.note}</span>
          </button>
        ))}
      </div>

      <section className="ka-card ka-po-clip" aria-label="รายการใบสั่งซื้อ">
        <div className="ka-po-tabs" role="tablist" aria-label="สถานะใบสั่งซื้อ" onKeyDown={onTabsKey}>
          {visibleTabs.map((item) => {
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                id={`po-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="po-list-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => pickTab(item.key)}
              >
                {item.label}
                <span className="numeric">{tabCounts[item.key] === undefined ? '–' : tabCounts[item.key]?.toLocaleString('th-TH')}</span>
              </button>
            );
          })}
        </div>

        <div className="ka-po-fbar">
          <div className="ka-po-search">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
            </svg>
            <input
              type="search"
              className="ka-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="ค้นหาเลข PO หรือชื่อเอกสาร"
              aria-label="ค้นหาใบสั่งซื้อด้วยเลข PO หรือชื่อเอกสาร"
            />
          </div>
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
            items={(Object.keys(SORTS) as SortKey[]).map((key) => ({
              label: key === sort ? `${SORTS[key].label} (ใช้อยู่)` : SORTS[key].label,
              onSelect: () => {
                setLoading(true);
                setParams({ sort: key, page: 1 });
              },
            }))}
          />
        </div>

        <div id="po-list-panel" role="tabpanel" aria-labelledby={`po-tab-${tab}`} aria-busy={loading || undefined}>
          {listError && (
            <div className="ka-po-cp">
              <LoadErrorBanner message={listError} onRetry={refresh} />
            </div>
          )}

          {!listError && (loading || rows.length > 0) && (
            <>
              <div className="ka-po-tw ka-po-tw--list">
                <table className={`ka-po-lt${loading ? ' ka-po-lt--loading' : ''}`}>
                  <caption className="sr-only">ใบสั่งซื้อ {statusLabelForTab(tab)} หน้า {page}</caption>
                  <thead>
                    <tr>
                      <th scope="col">ใบสั่งซื้อ</th>
                      <th scope="col">ผู้จำหน่าย</th>
                      <th scope="col">วันที่สั่ง</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col" className="ka-po-r">ยอดรวม (บาท)</th>
                      <th scope="col" className="ka-po-lt__menu"><span className="sr-only">เมนู</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && rows.length === 0
                      ? Array.from({ length: 5 }, (_, index) => (
                          <tr key={index} aria-hidden="true">
                            <td colSpan={6}><span className="ka-skel" /></td>
                          </tr>
                        ))
                      : rows.map((order) => {
                          const vat = orderVatSummary(order, vatRate);
                          const href = `${BASE}/${order.purchase_order_id}`;
                          return (
                            <tr key={order.purchase_order_id}>
                              <td>
                                <Link href={href} className="ka-po-rowlink">
                                  <span className="ka-po-code"><DocumentCode code={order.purchase_order_code} legacyCode={order.legacy_code} search={query} /></span>
                                </Link>
                                <span className="ka-po-cap ka-po-lt__name">{order.purchase_order_name}</span>
                              </td>
                              <td>
                                <span className="ka-po-sup">
                                  <span className="ka-po-sav" aria-hidden="true">{supplierInitials(order.supplier?.supplier_name)}</span>
                                  <span className="ka-po-sup__n">{order.supplier?.supplier_name ?? '-'}</span>
                                </span>
                              </td>
                              <td className="numeric ka-po-nowrap">{formatThaiDate(order.purchase_date)}</td>
                              <td>
                                <StatusBadge tone={statusTone(order.purchase_order_status)}>{statusLabel(order.purchase_order_status)}</StatusBadge>
                              </td>
                              <td className="ka-po-r">
                                <span className="numeric ka-po-amt">{formatMoney(vat.total)}</span>
                                <span className="ka-po-cap ka-po-nowrap">
                                  {VAT_TYPE_LABELS[order.vat_type || 'none']} · {orderLines(order).length} รายการ
                                </span>
                              </td>
                              <td className="ka-po-lt__menu">
                                <RowMenu label={`ตัวเลือกของ ${order.purchase_order_code}`} items={menuFor(order)} />
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              <ul className="ka-po-mlist" aria-label="ใบสั่งซื้อ">
                {rows.map((order) => (
                  <li key={order.purchase_order_id}>
                    <Link href={`${BASE}/${order.purchase_order_id}`} className="ka-po-mc">
                      <span className="ka-po-mc__row">
                        <span className="ka-po-code"><DocumentCode code={order.purchase_order_code} legacyCode={order.legacy_code} search={query} /></span>
                        <StatusBadge tone={statusTone(order.purchase_order_status)}>{statusLabel(order.purchase_order_status)}</StatusBadge>
                      </span>
                      <span className="ka-po-mc__name">{order.purchase_order_name}</span>
                      <span className="ka-po-mc__row">
                        <span className="ka-po-cap ka-po-mc__meta">
                          {order.supplier?.supplier_name ?? '-'} · {formatThaiDate(order.purchase_date)}
                        </span>
                        <span className="numeric ka-po-mc__amt">฿{formatMoney(orderVatSummary(order, vatRate).total)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {nothingYet && (
            <div className="ka-po-empty">
              <p className="ka-po-empty__t">ยังไม่มีใบสั่งซื้อ</p>
              <p className="ka-po-cap">สร้างใบสั่งซื้อเพื่อสั่งวัตถุดิบจากผู้จำหน่าย แล้วติดตามการอนุมัติและการรับสินค้าได้ที่นี่</p>
              {createButton}
            </div>
          )}

          {noMatch && (
            <div className="ka-po-empty">
              <p className="ka-po-empty__t">
                {query ? `ไม่พบใบสั่งซื้อที่ตรงกับ “${query}”` : `ไม่พบใบสั่งซื้อในสถานะ “${statusLabelForTab(tab)}”`}
              </p>
              <p className="ka-po-cap">ลองค้นด้วยเลข PO หรือชื่อเอกสารอื่น หรือดูทุกสถานะ</p>
              <button type="button" className="ka-btn" onClick={clearFilters}>ล้างตัวกรอง</button>
            </div>
          )}
        </div>

        {!listError && total > 0 && (
          <div className="ka-po-pager">
            <span className="ka-po-cap numeric" role="status">
              แสดง {from.toLocaleString('th-TH')}–{to.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} รายการ
            </span>
            {meta && meta.last_page > 1 && (
              <Pagination
                meta={meta}
                currentPage={page}
                onPageChange={(next) => {
                  setLoading(true);
                  setParams({ page: next });
                }}
              />
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(toDelete)}
        title="ลบใบสั่งซื้อ"
        message={`ลบ ${toDelete?.purchase_order_code ?? ''} “${toDelete?.purchase_order_name ?? ''}” และรายการวัตถุดิบทั้งหมดในใบนี้ ลบแล้วกู้คืนไม่ได้`}
        confirmLabel="ลบใบสั่งซื้อ"
        cancelLabel="ไม่ลบ"
        onCancel={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
      />

      {toReject && (
        <CancellationDialog
          title={`ยกเลิกใบสั่งซื้อ ${toReject.purchase_order_code}`}
          onClose={() => setToReject(null)}
          onConfirm={async (reason) => {
            await axiosInstance.post(`/purchase-order/${toReject.purchase_order_id}/reject`, { reason });
            toast({ message: `ยกเลิกใบสั่งซื้อ ${toReject.purchase_order_code} แล้ว`, tone: 'success' });
            refresh();
          }}
        />
      )}
    </div>
  );
}

function statusLabelForTab(tab: TabKey): string {
  return TABS.find((item) => item.key === tab)?.label ?? 'ทั้งหมด';
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseOrdersList />
    </Suspense>
  );
}
