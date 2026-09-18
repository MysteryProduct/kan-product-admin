'use client';

import { useEffect, useState } from 'react';
import ContactRequestModel from '@/models/contact-request';
import { ContactRequest, ContactRequestStatus } from '@/types/contact-request';
import { PaginationMeta } from '@/types/pagination';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { formatThaiDate } from '@/lib/date-format';
import { getApiErrorMessage } from '@/lib/api-error';
import ContactRequestDetailModal from './components/detail';

const contactRequestModel = new ContactRequestModel();

const statusLabels: Record<ContactRequestStatus, string> = {
  new: 'ใหม่',
  contacting: 'กำลังติดต่อ',
  closed: 'ปิดคำขอ',
};
const statusClassMap: Record<ContactRequestStatus, string> = {
  new: 'bg-blue-50 text-blue-700',
  contacting: 'bg-amber-50 text-amber-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default function ContactRequestsPage() {
  const { can } = usePermissions();
  const canView = can('contact_requests', 'view');

  const [statusFilter, setStatusFilter] = useState<ContactRequestStatus | ''>(
    '',
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ContactRequest | null>(null);

  useEffect(() => {
    if (!canView) return;
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, canView]);

  async function fetchRequests() {
    try {
      setLoading(true);
      setError('');
      const result = await contactRequestModel.getContactRequests(
        currentPage,
        20,
        statusFilter || undefined,
      );
      setRequests(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const columns: DataTableColumn<ContactRequest>[] = [
    { key: 'productName', label: 'สินค้า' },
    { key: 'contactName', label: 'ชื่อผู้ติดต่อ' },
    { key: 'contactPhone', label: 'เบอร์โทร' },
    { key: 'quantity', label: 'จำนวน' },
    {
      key: 'status',
      label: 'สถานะ',
      render: (value) => {
        const status = value as ContactRequestStatus;
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassMap[status]}`}
          >
            {statusLabels[status]}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'วันที่ส่งคำขอ',
      render: (value) => formatThaiDate(value as string),
    },
    {
      key: 'contactRequestId',
      label: 'การจัดการ',
      render: (_value, row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="text-blue-600 hover:underline"
        >
          ดู/จัดการ
        </button>
      ),
    },
  ];

  if (!canView) {
    return (
      <div className="min-h-full bg-[#F5F7FA] p-4 dark:bg-slate-950 sm:p-6">
        <p className="text-[var(--color-text-secondary)]">
          คุณไม่มีสิทธิ์เข้าถึงคำขอติดต่อกลับ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F5F7FA] p-2 dark:bg-slate-950 sm:p-4 md:p-6 lg:p-8">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 sm:rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:p-4 md:p-6">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            คำขอติดต่อกลับ
          </h1>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ContactRequestStatus | '');
              setCurrentPage(1);
            }}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
          >
            <option value="">ทุกสถานะ</option>
            {(Object.keys(statusLabels) as ContactRequestStatus[]).map(
              (value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[var(--color-error)]">
          {error}
        </p>
      )}
      {loading && <LoadingSkeletonProps />}
      <div className="relative mt-4">
        <DataTable
          data={requests}
          columns={columns}
          keyField="contactRequestId"
          disabled={loading}
          className="bg-white dark:bg-gray-800 p-1"
          headerClassName="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
          rowClassName="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/60"
          paginationMeta={meta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {selected && (
        <ContactRequestDetailModal
          isOpen
          onClose={() => setSelected(null)}
          contactRequest={selected}
          onSuccess={() => {
            setSelected(null);
            void fetchRequests();
          }}
        />
      )}
    </div>
  );
}
