'use client';
import { useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import StatusBadge from '@/components/StatusBadge';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  StoreOrderList as StoreOrderListResult,
  StoreOrderListFilters,
  StoreOrderListItem,
  StoreOrderListStatus,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDateTime } from '@/lib/date-format';
import { STORE_ORDER_STATUS_TONE } from '@/lib/status-tones';
import {
  STORE_CUSTOMER_TYPE_LABELS,
  STORE_ORDER_METHOD_LABELS,
  STORE_ORDER_SEARCH_MAX_LENGTH,
  STORE_ORDER_STATUS_LABELS,
} from '@/lib/store-order-list';

const storeFulfillmentModel = new StoreFulfillmentModel();
const PAGE_SIZE = 20;

const NO_FILTERS: StoreOrderListFilters = {
  search: '',
  status: '',
  fulfillmentMethod: '',
  dateFrom: '',
  dateTo: '',
};

const formatBaht = (amount: number) =>
  new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

/**
 * TASK-0088: every Store order, newest first, found by phone, name, member
 * email, sale order code or order id and narrowed by status, method and day.
 * Choosing a row opens that order on the page, so staff never need its id.
 */
export default function StoreOrderList({
  onOpen,
  refreshKey = 0,
}: {
  onOpen: (storeOrderId: string) => void;
  /** Changes when an order was changed elsewhere on the page, so the list reloads. */
  refreshKey?: number;
}) {
  // What the box holds is not what was asked until it is submitted or another
  // filter is changed; `filters` is what the list on screen answers.
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<StoreOrderListFilters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<StoreOrderListResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    storeFulfillmentModel
      .listOrders(filters, page, PAGE_SIZE)
      .then((next) => {
        if (!active) return;
        setResult(next);
        setError('');
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
  }, [filters, page, reloads, refreshKey]);

  // Loading starts with the change itself, not inside the effect.
  const apply = (next: Partial<StoreOrderListFilters>) => {
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
  };

  const filtered =
    searchDraft.trim() !== '' ||
    Object.values(filters).some((value) => value !== '');

  const columns: DataTableColumn<StoreOrderListItem>[] = [
    {
      key: 'createdAt',
      label: 'วันที่สั่งซื้อ',
      render: (value) => (
        <span className="whitespace-nowrap">
          {formatThaiDateTime(value as string)}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'ชื่อ',
      render: (value) => <span className="break-words">{(value as string | null) ?? '-'}</span>,
    },
    {
      key: 'phone',
      label: 'เบอร์โทร',
      render: (value) => (
        <span className="whitespace-nowrap">{(value as string | null) ?? '-'}</span>
      ),
    },
    {
      key: 'status',
      label: 'สถานะ',
      render: (value) => {
        const status = value as StoreOrderListStatus;
        return (
          <StatusBadge tone={STORE_ORDER_STATUS_TONE[status]}>
            {STORE_ORDER_STATUS_LABELS[status] ?? status}
          </StatusBadge>
        );
      },
    },
    {
      key: 'total',
      label: 'ยอดรวม (บาท)',
      render: (value) => (
        <span className="numeric whitespace-nowrap">{formatBaht(value as number)}</span>
      ),
    },
    {
      key: 'fulfillmentMethod',
      label: 'วิธีรับ',
      render: (value) => (
        <span className="whitespace-nowrap">
          {STORE_ORDER_METHOD_LABELS[value as StoreOrderListItem['fulfillmentMethod']]}
        </span>
      ),
    },
    {
      key: 'customerType',
      label: 'ผู้ซื้อ',
      render: (value) =>
        STORE_CUSTOMER_TYPE_LABELS[value as StoreOrderListItem['customerType']],
    },
    {
      key: 'saleOrderCode',
      label: 'รหัสใบขาย',
      render: (value) => (
        <span className="whitespace-nowrap">{(value as string | null) ?? '-'}</span>
      ),
    },
    {
      key: 'storeOrderId',
      label: 'เลขคำสั่งซื้อ',
      render: (_value, row) => (
        <button
          type="button"
          onClick={(event) => {
            // The row opens the order too; once is enough.
            event.stopPropagation();
            onOpen(row.storeOrderId);
          }}
          title={row.storeOrderId}
          aria-label={`เปิดคำสั่งซื้อ ${row.storeOrderId}`}
          className="ka-btn ka-btn--ghost min-h-11 whitespace-nowrap text-[var(--brand-ink)]"
        >
          เปิด #{row.storeOrderId.slice(0, 8)}
        </button>
      ),
    },
  ];

  return (
    <section aria-labelledby="store-order-list-heading" className="mt-4">
      <div className="ka-card overflow-hidden">
        <div className="border-b border-[var(--border)] p-3 sm:p-4 md:p-6">
          <h2 id="store-order-list-heading" className="font-medium">
            รายการคำสั่งซื้อหน้าร้าน
          </h2>
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              apply({});
            }}
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="ka-field sm:col-span-2 lg:col-span-4">
              <label htmlFor="store-order-search" className="ka-label">
                ค้นหา
              </label>
              <div className="flex gap-2">
                <input
                  id="store-order-search"
                  type="search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  maxLength={STORE_ORDER_SEARCH_MAX_LENGTH}
                  placeholder="เบอร์โทร ชื่อ อีเมลสมาชิก รหัสใบขาย หรือเลขคำสั่งซื้อ"
                  className="ka-input min-h-11 min-w-0 flex-1"
                />
                <button type="submit" className="ka-btn ka-btn--primary min-h-11">
                  ค้นหา
                </button>
              </div>
            </div>

            <div className="ka-field">
              <label htmlFor="store-order-status" className="ka-label">
                สถานะ
              </label>
              <select
                id="store-order-status"
                value={filters.status}
                onChange={(event) =>
                  apply({ status: event.target.value as StoreOrderListFilters['status'] })
                }
                className="ka-input min-h-11"
              >
                <option value="">ทุกสถานะ</option>
                {(Object.keys(STORE_ORDER_STATUS_LABELS) as StoreOrderListStatus[]).map(
                  (value) => (
                    <option key={value} value={value}>
                      {STORE_ORDER_STATUS_LABELS[value]}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="ka-field">
              <label htmlFor="store-order-method" className="ka-label">
                วิธีรับสินค้า
              </label>
              <select
                id="store-order-method"
                value={filters.fulfillmentMethod}
                onChange={(event) =>
                  apply({
                    fulfillmentMethod: event.target
                      .value as StoreOrderListFilters['fulfillmentMethod'],
                  })
                }
                className="ka-input min-h-11"
              >
                <option value="">ทุกวิธี</option>
                <option value="delivery">{STORE_ORDER_METHOD_LABELS.delivery}</option>
                <option value="pickup">{STORE_ORDER_METHOD_LABELS.pickup}</option>
              </select>
            </div>

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
                className="ka-input min-h-11 min-w-0"
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
                className="ka-input min-h-11 min-w-0"
              />
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p
              aria-live="polite"
              className="text-sm text-[var(--color-text-secondary)]"
            >
              {loading
                ? 'กำลังโหลด...'
                : result && !error
                  ? `พบ ${result.meta.total} รายการ`
                  : ''}
            </p>
            {filtered && (
              <button
                type="button"
                onClick={clear}
                className="ka-btn ka-btn--ghost min-h-11"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      </div>

      {/* A page that failed to load shows only its error, never the rows of
          the page before it; the pagination stays so staff can move on. */}
      <LoadErrorBanner
        message={error ? `โหลดรายการคำสั่งซื้อไม่สำเร็จ: ${error}` : null}
        onRetry={retry}
        className="mt-4"
      />
      {/* Nothing is drawn before the first answer: an empty table would read
          as "no orders". */}
      {(result || error) && (
        <div className="mt-4">
          <DataTable
            data={error ? [] : (result?.data ?? [])}
            columns={columns}
            keyField="storeOrderId"
            pageSize={PAGE_SIZE}
            disabled={loading}
            onRowClick={(row) => onOpen(row.storeOrderId)}
            paginationMeta={result?.meta ?? null}
            currentPage={page}
            onPageChange={changePage}
          />
        </div>
      )}
    </section>
  );
}
