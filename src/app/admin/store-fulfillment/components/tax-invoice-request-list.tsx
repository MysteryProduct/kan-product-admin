'use client';
import { useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import StatusBadge from '@/components/StatusBadge';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  StoreOrderListStatus,
  StoreTaxInvoiceRequestList,
  StoreTaxInvoiceRequestListItem,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';
import { STORE_ORDER_STATUS_TONE } from '@/lib/status-tones';
import { STORE_ORDER_STATUS_LABELS } from '@/lib/store-order-list';
import { branchLabel } from './tax-invoice-card';

const storeFulfillmentModel = new StoreFulfillmentModel();
const PAGE_SIZE = 10;

const orderStatus = (row: StoreTaxInvoiceRequestListItem) => {
  const status = row.orderStatus as StoreOrderListStatus;
  return (
    <StatusBadge tone={STORE_ORDER_STATUS_TONE[status]}>
      {STORE_ORDER_STATUS_LABELS[status] ?? row.orderStatus}
    </StatusBadge>
  );
};

/**
 * TASK-0038: every tax invoice request, newest first. A request made after
 * payment is not otherwise easy to find; choosing a row opens that order.
 */
export default function TaxInvoiceRequestList({
  onOpen,
  refreshKey = 0,
  onTotal,
}: {
  onOpen: (storeOrderId: string) => void;
  /** Changes when an order was changed on the page, so the status beside each request follows. */
  refreshKey?: number;
  /** Told how many requests there are, for the number on the tab. */
  onTotal?: (total: number) => void;
}) {
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<StoreTaxInvoiceRequestList | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    storeFulfillmentModel
      .listTaxInvoiceRequests(page, PAGE_SIZE)
      .then((next) => {
        if (!active) return;
        setResult(next);
        setError('');
        onTotal?.(next.meta.total);
      })
      .catch((err) => {
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
  }, [page, reloads, refreshKey]);

  // Loading starts with the page change itself, not inside the effect.
  const changePage = (next: number) => {
    setLoading(true);
    setError('');
    setPage(next);
  };

  const openButton = (row: StoreTaxInvoiceRequestListItem) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(row.storeOrderId);
      }}
      className="ka-sf-open"
    >
      เปิดคำสั่งซื้อ
    </button>
  );

  const columns: DataTableColumn<StoreTaxInvoiceRequestListItem>[] = [
    {
      key: 'requestedAt',
      label: 'วันที่ขอ',
      render: (value) => <span className="whitespace-nowrap">{formatThaiDate(value as string)}</span>,
    },
    {
      key: 'buyerName',
      label: 'ชื่อบุคคลหรือบริษัท',
      render: (value) => <span className="break-words">{value as string}</span>,
    },
    {
      key: 'branchType',
      label: 'สาขา',
      render: (_, row) => <span className="whitespace-nowrap">{branchLabel(row)}</span>,
    },
    { key: 'orderStatus', label: 'สถานะคำสั่งซื้อ', render: (_, row) => orderStatus(row) },
    {
      key: 'storeOrderId',
      label: 'เปิดคำสั่งซื้อ',
      card: 'hide',
      render: (_, row) => openButton(row),
    },
  ];

  return (
    <div className="ka-sf-flat">
      {/* A page that failed to load shows only its error, never the rows of
          the page before it; the pagination stays so staff can move on. */}
      <LoadErrorBanner
        message={error ? `โหลดคำขอใบกำกับภาษีไม่สำเร็จ: ${error}` : null}
        onRetry={() => {
          setLoading(true);
          setReloads((count) => count + 1);
        }}
        className="m-4"
      />
      {error ? (
        <div className="ka-sf-pager">
          <Pagination meta={result?.meta ?? null} currentPage={page} onPageChange={changePage} />
        </div>
      ) : (
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
          cardTitleKey="buyerName"
          emptyHint="ยังไม่มีคำขอใบกำกับภาษี"
          renderCard={(row) => (
            <div className="ka-sf-rowcard">
              <div className="ka-sf-row ka-sf-row--between">
                <strong className="min-w-0 break-words font-semibold">{row.buyerName}</strong>
                {orderStatus(row)}
              </div>
              <p className="ka-sf-cap">
                {branchLabel(row)} · {formatThaiDate(row.requestedAt)}
              </p>
              {openButton(row)}
            </div>
          )}
        />
      )}
    </div>
  );
}
