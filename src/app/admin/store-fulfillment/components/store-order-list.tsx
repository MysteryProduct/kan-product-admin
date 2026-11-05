'use client';
import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import FilterChip from '@/components/FilterChip';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import Pagination from '@/components/Pagination';
import Popover from '@/components/Popover';
import StatusBadge from '@/components/StatusBadge';
import DocumentCode from '@/components/DocumentCode';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  StoreOrderList as StoreOrderListResult,
  StoreOrderListFilters,
  StoreOrderListItem,
  StoreOrderListStatus,
  StoreOrderQueue,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate, formatThaiDateTime } from '@/lib/date-format';
import { STORE_ORDER_STATUS_TONE } from '@/lib/status-tones';
import {
  STORE_CUSTOMER_TYPE_LABELS,
  STORE_ORDER_METHOD_LABELS,
  STORE_ORDER_SEARCH_MAX_LENGTH,
  STORE_ORDER_STATUS_LABELS,
} from '@/lib/store-order-list';
import SfIcon from './sf-icon';

const storeFulfillmentModel = new StoreFulfillmentModel();
const PAGE_SIZE = 20;

type ListFilters = Omit<StoreOrderListFilters, 'queue'>;

const NO_FILTERS: ListFilters = {
  search: '',
  status: '',
  fulfillmentMethod: '',
  dateFrom: '',
  dateTo: '',
};

const METHODS = [
  { value: '', label: 'ทุกวิธี' },
  { value: 'delivery', label: STORE_ORDER_METHOD_LABELS.delivery, icon: 'truck' },
  { value: 'pickup', label: STORE_ORDER_METHOD_LABELS.pickup, icon: 'store' },
] as const;

const formatBaht = (amount: number) =>
  new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const statusBadge = (status: StoreOrderListStatus) => (
  <StatusBadge tone={STORE_ORDER_STATUS_TONE[status]}>
    {STORE_ORDER_STATUS_LABELS[status] ?? status}
  </StatusBadge>
);

const method = (row: StoreOrderListItem) => (
  <span className="ka-sf-method">
    <SfIcon name={row.fulfillmentMethod === 'delivery' ? 'truck' : 'store'} small />
    {STORE_ORDER_METHOD_LABELS[row.fulfillmentMethod]}
  </span>
);

/**
 * TASK-0088: every Store order, newest first, found by phone, name, member
 * email or sale order code (the old one too) and narrowed by status, method,
 * day and work queue. Choosing a row opens that order, so staff never need
 * its id (ADR-0001).
 */
export default function StoreOrderList({
  onOpen,
  refreshKey = 0,
  queue = '',
  onClearQueue,
  onTotal,
}: {
  onOpen: (storeOrderId: string) => void;
  /** Changes when an order was changed elsewhere on the page, so the list reloads. */
  refreshKey?: number;
  /** The work queue chosen on the page's tiles. */
  queue?: StoreOrderQueue | '';
  onClearQueue?: () => void;
  /** Told how many orders the filters found, for the number on the tab. */
  onTotal?: (total: number) => void;
}) {
  // What the box holds is not what was asked until it is submitted or another
  // filter is changed; `filters` is what the list on screen answers.
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<ListFilters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<StoreOrderListResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [datesOpen, setDatesOpen] = useState(false);
  const datesRef = useRef<HTMLButtonElement>(null);

  // A new queue is a new list: back to its first page, as any other filter does.
  const [shownQueue, setShownQueue] = useState(queue);
  if (shownQueue !== queue) {
    setShownQueue(queue);
    setPage(1);
    setLoading(true);
    setError('');
  }

  useEffect(() => {
    let active = true;
    storeFulfillmentModel
      .listOrders({ ...filters, queue }, page, PAGE_SIZE)
      .then((next) => {
        if (!active) return;
        setResult(next);
        setError('');
        onTotal?.(next.meta.total);
      })
      .catch((err: unknown) => {
        if (active) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // `onTotal` only reports; a new function from the parent is no reason to read the list again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, queue, page, reloads, refreshKey]);

  // Loading starts with the change itself, not inside the effect.
  const apply = (next: Partial<ListFilters>) => {
    setLoading(true);
    setError('');
    setPage(1);
    setFilters({ ...filters, search: searchDraft.trim(), ...next });
  };
  const changePage = (next: number) => {
    setLoading(true);
    setError('');
    setPage(next);
  };
  const retry = () => {
    setLoading(true);
    setReloads((count) => count + 1);
  };
  const clear = () => {
    setSearchDraft('');
    setLoading(true);
    setError('');
    setPage(1);
    setFilters(NO_FILTERS);
    onClearQueue?.();
  };

  const filtered =
    queue !== '' ||
    searchDraft.trim() !== '' ||
    Object.values(filters).some((value) => value !== '');

  const dateLabel =
    filters.dateFrom || filters.dateTo
      ? [filters.dateFrom, filters.dateTo].filter(Boolean).map((date) => formatThaiDate(date)).join(' – ')
      : 'วันที่สั่งซื้อ';

  // The button holds only the code, so its name is the code; the note that the
  // search matched an old number sits beside it, unclickable. The order is its
  // sale order (ADR-0001): the id is only what the click passes on.
  const orderCode = (row: StoreOrderListItem) => {
    const code = row.saleOrderCode ?? '-';
    return (
      <DocumentCode
        code={
          <button
            type="button"
            onClick={(event) => {
              // The row opens the order too; once is enough.
              event.stopPropagation();
              onOpen(row.storeOrderId);
            }}
            aria-label={`เปิดคำสั่งซื้อ ${code}`}
            className="ka-sf-link whitespace-nowrap"
          >
            {code}
          </button>
        }
        legacyCode={row.legacySaleOrderCode}
        search={filters.search}
      />
    );
  };

  const columns: DataTableColumn<StoreOrderListItem>[] = [
    {
      key: 'saleOrderCode',
      label: 'คำสั่งซื้อ',
      render: (_, row) => (
        <>
          {orderCode(row)}
          <span className="ka-sf-cap block whitespace-nowrap">{formatThaiDateTime(row.createdAt)}</span>
        </>
      ),
    },
    {
      key: 'name',
      label: 'ลูกค้า',
      render: (_, row) => (
        <span className="ka-sf-person">
          <span className="ka-sf-avatar" aria-hidden="true">
            {row.name?.trim().charAt(0) || '-'}
          </span>
          <span className="min-w-0">
            <span className="block break-words">{row.name ?? '-'}</span>
            <span className="ka-sf-cap ka-sf-num block">
              {row.phone ?? '-'} · {STORE_CUSTOMER_TYPE_LABELS[row.customerType]}
            </span>
          </span>
        </span>
      ),
    },
    { key: 'fulfillmentMethod', label: 'วิธีรับ', render: (_, row) => method(row) },
    { key: 'status', label: 'สถานะ', render: (_, row) => statusBadge(row.status) },
    {
      key: 'total',
      label: 'ยอดรวม (บาท)',
      render: (value) => (
        <span className="numeric block whitespace-nowrap text-right font-semibold">{formatBaht(value as number)}</span>
      ),
    },
    {
      key: 'storeOrderId',
      label: 'เปิด',
      card: 'hide',
      render: () => (
        <span className="ka-sf-go">
          <SfIcon name="right" small />
        </span>
      ),
    },
  ];

  return (
    <div>
      <form
        role="search"
        className="ka-sf-fbar"
        onSubmit={(event) => {
          event.preventDefault();
          apply({});
        }}
      >
        <label className="ka-sf-search">
          <SfIcon name="search" small />
          <input
            type="search"
            aria-label="ค้นหาคำสั่งซื้อ"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            maxLength={STORE_ORDER_SEARCH_MAX_LENGTH}
            placeholder="เบอร์โทร ชื่อ อีเมลสมาชิก หรือเลขคำสั่งซื้อ"
            className="ka-input"
          />
        </label>
        <div className="ka-seg" role="group" aria-label="วิธีรับสินค้า">
          {METHODS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filters.fulfillmentMethod === option.value}
              onClick={() => apply({ fulfillmentMethod: option.value })}
            >
              {'icon' in option && <SfIcon name={option.icon} small />}
              {option.label}
            </button>
          ))}
        </div>
        <FilterChip
          label="สถานะ"
          single
          options={(Object.keys(STORE_ORDER_STATUS_LABELS) as StoreOrderListStatus[]).map((value) => ({
            value,
            label: STORE_ORDER_STATUS_LABELS[value],
          }))}
          selected={filters.status ? [filters.status] : []}
          onChange={(values) => apply({ status: (values[0] ?? '') as ListFilters['status'] })}
          resultCount={result?.meta.total}
        />
        <button
          ref={datesRef}
          type="button"
          className="ka-chip"
          data-active={filters.dateFrom || filters.dateTo ? true : undefined}
          aria-expanded={datesOpen}
          onClick={() => setDatesOpen((open) => !open)}
        >
          {dateLabel}
          <SfIcon name="down" small />
        </button>
        <Popover open={datesOpen} onClose={() => setDatesOpen(false)} anchorRef={datesRef} title="วันที่สั่งซื้อ" width={280}>
          <div className="ka-sf-dates">
            <div className="ka-field">
              <label htmlFor="store-order-date-from" className="ka-label">
                สั่งซื้อตั้งแต่วันที่
              </label>
              <input
                id="store-order-date-from"
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(event) => apply({ dateFrom: event.target.value })}
                className="ka-input min-w-0"
              />
            </div>
            <div className="ka-field">
              <label htmlFor="store-order-date-to" className="ka-label">
                ถึงวันที่
              </label>
              <input
                id="store-order-date-to"
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(event) => apply({ dateTo: event.target.value })}
                className="ka-input min-w-0"
              />
            </div>
          </div>
        </Popover>
        <span className="ka-sf-found" aria-live="polite">
          {loading ? 'กำลังโหลด...' : result && !error ? `พบ ${result.meta.total} รายการ` : ''}
        </span>
        {filtered && (
          <button type="button" onClick={clear} className="ka-btn ka-btn--ghost">
            ล้างตัวกรอง
          </button>
        )}
      </form>

      {/* A page that failed to load shows only its error, never the rows of
          the page before it; the pagination stays so staff can move on. */}
      <LoadErrorBanner
        message={error ? `โหลดรายการคำสั่งซื้อไม่สำเร็จ: ${error}` : null}
        onRetry={retry}
        className="m-4"
      />
      {error ? (
        <div className="ka-sf-pager">
          <Pagination meta={result?.meta ?? null} currentPage={page} onPageChange={changePage} />
        </div>
      ) : (
        <div className="ka-sf-flat ka-sf-list">
          <DataTable
            data={result?.data ?? []}
            columns={columns}
            keyField="storeOrderId"
            pageSize={PAGE_SIZE}
            loading={loading && !result}
            disabled={loading}
            onRowClick={(row) => onOpen(row.storeOrderId)}
            paginationMeta={result?.meta ?? null}
            currentPage={page}
            onPageChange={changePage}
            cardTitleKey="saleOrderCode"
            emptyHint="ยังไม่มีคำสั่งซื้อ"
            activeFilters={filtered ? ['ตัวกรองที่เลือก'] : []}
            onClearFilters={clear}
            renderCard={(row) => (
              <div className="ka-sf-rowcard">
                <div className="ka-sf-row ka-sf-row--between">
                  {orderCode(row)}
                  {statusBadge(row.status)}
                </div>
                <div className="ka-sf-row ka-sf-row--between">
                  <span className="min-w-0">
                    <span className="block break-words">{row.name ?? '-'}</span>
                    <span className="ka-sf-cap ka-sf-num block">
                      {row.phone ?? '-'} · {STORE_CUSTOMER_TYPE_LABELS[row.customerType]}
                    </span>
                  </span>
                  <span className="numeric whitespace-nowrap font-semibold">฿{formatBaht(row.total)}</span>
                </div>
                <div className="ka-sf-row ka-sf-row--between ka-sf-cap">
                  {method(row)}
                  <span>{formatThaiDateTime(row.createdAt)}</span>
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
