'use client';
import { useEffect, useState } from 'react';
import Pagination from '@/components/Pagination';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import { StoreTaxInvoiceRequestList } from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';
import { branchLabel } from './tax-invoice-card';

const storeFulfillmentModel = new StoreFulfillmentModel();
const PAGE_SIZE = 10;

/**
 * TASK-0038: every tax invoice request, newest first. The page otherwise
 * finds an order only by its id, which staff would not know for a request
 * made after payment; choosing a row opens that order below.
 */
export default function TaxInvoiceRequestList({
  onOpen,
}: {
  onOpen: (storeOrderId: string) => void;
}) {
  const [page, setPage] = useState(1);
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
  }, [page]);

  // Loading starts with the page change itself, not inside the effect.
  const changePage = (next: number) => {
    setLoading(true);
    setError('');
    setPage(next);
  };

  return (
    <section
      aria-labelledby="tax-invoice-requests-heading"
      className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 sm:p-6"
    >
      <h2 id="tax-invoice-requests-heading" className="font-medium">
        คำขอใบกำกับภาษี
      </h2>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}
      {!error && loading && !result && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">กำลังโหลด...</p>
      )}
      {!error && result && result.data.length === 0 && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          ยังไม่มีคำขอใบกำกับภาษี
        </p>
      )}
      {/* A page that failed to load shows only its error, never the rows of
          the page before it; the pagination stays so staff can move on. */}
      {!error && result && result.data.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th className="py-2 pr-3 font-normal">วันที่ขอ</th>
                  <th className="py-2 pr-3 font-normal">ชื่อบุคคลหรือบริษัท</th>
                  <th className="py-2 pr-3 font-normal">สาขา</th>
                  <th className="py-2 font-normal">
                    <span className="sr-only">เปิดคำสั่งซื้อ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((row) => (
                  <tr
                    key={row.storeOrderId}
                    className="border-b border-gray-50 dark:border-gray-700"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatThaiDate(row.requestedAt)}
                    </td>
                    <td className="py-2 pr-3 break-words">{row.buyerName}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{branchLabel(row)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onOpen(row.storeOrderId)}
                        className="min-h-11 rounded-lg px-3 py-2 font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700"
                      >
                        เปิดคำสั่งซื้อ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      )}
      {result && result.meta.total > 0 && (
        <Pagination meta={result.meta} currentPage={page} onPageChange={changePage} />
      )}
    </section>
  );
}
