'use client';

import { useEffect, useState } from 'react';
import StoreLotModel from '@/models/store-lot';
import { StoreLot, StoreLotStatus } from '@/types/store-lot';
import { PaginationMeta } from '@/types/pagination';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { formatThaiDate, formatThaiDateTime } from '@/lib/date-format';
import { getApiErrorMessage } from '@/lib/api-error';
import ReleaseLotModal, { variantLabel } from './components/release-modal';

const storeLotModel = new StoreLotModel();

const statusLabels: Record<StoreLotStatus, string> = {
  unreleased: 'รอเปิดขาย',
  released: 'เปิดขายแล้ว',
};

export default function StoreLotsPage() {
  const { can } = usePermissions();
  const canView = can('store_fulfillment', 'view');
  const canEdit = can('store_fulfillment', 'edit');

  const [status, setStatus] = useState<StoreLotStatus>('unreleased');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [lots, setLots] = useState<StoreLot[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<StoreLot | null>(null);

  useEffect(() => {
    if (!canView) return;
    void fetchLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, status, search, canView]);

  async function fetchLots() {
    try {
      setLoading(true);
      setError('');
      const result = await storeLotModel.getStoreLots(
        currentPage,
        20,
        status,
        search || undefined,
      );
      setLots(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const productColumn: DataTableColumn<StoreLot> = {
    key: 'productName',
    label: 'สินค้า',
    render: (value, row) => (
      <div>
        <p className="font-medium">{value as string}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {variantLabel(row)}
        </p>
      </div>
    ),
  };
  const sharedColumns: DataTableColumn<StoreLot>[] = [
    productColumn,
    {
      key: 'sourceName',
      label: 'งานผลิตที่มา',
      render: (value) => (value as string | null) || '-',
    },
    {
      key: 'remainingQty',
      label: 'คงเหลือ',
      render: (value) => (value as number).toLocaleString('th-TH'),
    },
    {
      key: 'producedAt',
      label: 'วันที่ผลิต',
      render: (value) => formatThaiDate(value as string),
    },
  ];
  const columns: DataTableColumn<StoreLot>[] =
    status === 'unreleased'
      ? [
          ...sharedColumns,
          {
            key: 'stockProductId',
            label: 'การจัดการ',
            render: (_value, row) =>
              canEdit ? (
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="ka-btn ka-btn--primary min-h-11"
                >
                  เปิดขาย
                </button>
              ) : (
                <span className="text-sm text-[var(--color-text-secondary)]">
                  ดูได้อย่างเดียว
                </span>
              ),
          },
        ]
      : [
          ...sharedColumns,
          {
            key: 'releasedAt',
            label: 'เปิดขายโดย',
            render: (value, row) => (
              <div>
                {/* Lots released before TASK-0108 have no releaser on record. */}
                <p>
                  {row.releasedBy
                    ? row.releasedBy.name || 'ไม่พบชื่อพนักงาน'
                    : 'ไม่มีบันทึกผู้เปิด'}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {formatThaiDateTime(value as string)}
                </p>
              </div>
            ),
          },
          {
            key: 'releaseNote',
            label: 'หมายเหตุการตรวจ',
            render: (value) => (
              <span className="whitespace-pre-wrap break-words">
                {(value as string | null) || '-'}
              </span>
            ),
          },
        ];

  if (!canView) {
    return (
      <div className="min-h-full bg-[var(--bg-page)] p-4 sm:p-6">
        <p className="text-[var(--color-text-secondary)]">
          คุณไม่มีสิทธิ์เข้าถึงการเปิดล็อตขาย กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
      <div className="ka-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-3 sm:p-4 md:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              เปิดล็อตขายหน้าร้าน
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              ผลผลิตที่ตรวจผ่านแล้วต้องเปิดขายทั้งล็อตก่อน
              จึงซื้อออนไลน์และใช้ในใบขายได้
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              aria-label="สถานะล็อต"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StoreLotStatus);
                setCurrentPage(1);
                setNotice('');
              }}
              className="ka-input min-h-11"
            >
              {(Object.keys(statusLabels) as StoreLotStatus[]).map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </select>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput.trim());
                setCurrentPage(1);
              }}
              className="flex gap-2"
            >
              <input
                type="search"
                aria-label="ค้นหาสินค้าหรืองานผลิต"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ชื่อสินค้าหรืองานผลิต"
                maxLength={100}
                className="ka-input min-h-11 w-full sm:w-64"
              />
              <button
                type="submit"
                disabled={loading}
                className="ka-btn min-h-11"
              >
                ค้นหา
              </button>
            </form>
          </div>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-4 text-[var(--color-success)]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-[var(--color-error)]">
          {error}
        </p>
      )}
      {loading && <LoadingSkeletonProps />}
      <div className="relative mt-4">
        <DataTable
          data={lots}
          columns={columns}
          keyField="stockProductId"
          disabled={loading}
          paginationMeta={meta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {selected && (
        <ReleaseLotModal
          lot={selected}
          onClose={() => setSelected(null)}
          onReleased={(released) => {
            setSelected(null);
            setNotice(
              released.alreadyReleased
                ? `ล็อตนี้ถูกเปิดขายไปแล้วโดย ${released.releasedBy?.name || 'พนักงานคนอื่น'}`
                : `เปิดขาย ${released.productName} (${variantLabel(released)}) แล้ว`,
            );
            void fetchLots();
          }}
        />
      )}
    </div>
  );
}
