'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import StatusBadge, { type BadgeTone } from '@/components/StatusBadge';
import AccessLogModel from '@/models/access-log';
import { adminMenu } from '@/lib/admin-menu';
import { ACCESS_LOG_TYPE_LABELS, describeAccessLog } from '@/lib/access-log';
import { formatThaiDateTime } from '@/lib/date-format';
import type { AccessLogEntry, AccessLogResponse, AccessLogType } from '@/types/access-log';

const accessLogModel = new AccessLogModel();
const PAGE_SIZE = 20;

// Thai page titles from the sidebar; menus without a page keep their API name.
const MENU_TITLES = new Map(
  adminMenu.flatMap((section) =>
    section.items.flatMap((item) => (item.subItems ?? []).map((leaf) => [leaf.menu_name, leaf.title] as const)),
  ),
);
const menuTitle = (menuName: string) => MENU_TITLES.get(menuName) ?? menuName;

// Removing access reads as danger, granting as success; everything else is a change.
const EVENT_TONES: Record<string, BadgeTone> = {
  created: 'success',
  enabled: 'success',
  deleted: 'danger',
  disabled: 'danger',
};

const FILTERS: { value: AccessLogType | null; label: string }[] = [
  { value: null, label: 'ทั้งหมด' },
  { value: 'employee_license', label: ACCESS_LOG_TYPE_LABELS.employee_license },
  { value: 'employee', label: ACCESS_LOG_TYPE_LABELS.employee },
];

export default function AccessLogsPage() {
  const [logs, setLogs] = useState<AccessLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [type, setType] = useState<AccessLogType | null>(null);
  // Only the latest request may fill the table: switching filters quickly must not let a
  // slower earlier response show the rows of a filter that is no longer selected.
  const requestVersion = useRef(0);

  const fetchLogs = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError(null);
      const response = await accessLogModel.getLogs(currentPage, PAGE_SIZE, type ?? undefined);
      if (version === requestVersion.current) setLogs(response);
    } catch (err) {
      if (version === requestVersion.current)
        setError(err instanceof Error ? err.message : 'โหลดประวัติไม่สำเร็จ');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [currentPage, type]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const columns: DataTableColumn<AccessLogEntry>[] = [
    {
      key: 'created_at',
      label: 'เวลา',
      width: '170px',
      render: (value) => <span className="numeric whitespace-nowrap">{formatThaiDateTime(value as string)}</span>,
    },
    {
      key: 'actor_name',
      label: 'ผู้ทำ',
      render: (_, row) => (
        <span>
          <span className="font-medium">{row.actor_name ?? 'ผู้ใช้ที่ไม่พบในระบบ'}</span>
          {row.actor_username && row.actor_username !== row.actor_name && (
            <span className="block text-[13px] leading-5 text-[var(--ink-muted)]">{row.actor_username}</span>
          )}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'เหตุการณ์',
      render: (_, row) => (
        <StatusBadge tone={EVENT_TONES[row.action] ?? 'info'}>{describeAccessLog(row).event}</StatusBadge>
      ),
    },
    {
      key: 'target_name',
      label: 'รายการ',
      render: (_, row) => {
        const { typeLabel, target } = describeAccessLog(row);
        return (
          <span>
            <span className="break-words font-medium">{target}</span>
            <span className="block text-[13px] leading-5 text-[var(--ink-muted)]">{typeLabel}</span>
          </span>
        );
      },
    },
    {
      key: 'next_value',
      label: 'สิ่งที่เปลี่ยน',
      // Wide enough that a permission change reads as one line per menu on a phone.
      width: '320px',
      render: (_, row) => {
        const { details } = describeAccessLog(row, menuTitle);
        if (!details.length) return <span className="text-[var(--ink-muted)]">-</span>;
        return (
          <ul className="space-y-1">
            {details.map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        );
      },
    },
  ];

  return (
    <div className="bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
      {loading && <LoadingSkeleton />}

      <section className="min-w-0 rounded-2xl bg-[var(--bg-surface)] shadow-sm" aria-labelledby="access-log-title">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="access-log-title" className="text-lg font-semibold text-[var(--ink)]">
              ประวัติสิทธิ์และพนักงาน
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              ใครเปลี่ยนกลุ่มสิทธิ์ สิทธิ์รายเมนู หรือการเข้าถึงของพนักงาน เมื่อไร ใหม่สุดอยู่บน
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามประเภท">
            {FILTERS.map((filter) => (
              <button
                key={filter.label}
                type="button"
                aria-pressed={type === filter.value}
                onClick={() => {
                  setType(filter.value);
                  setCurrentPage(1);
                }}
                className={`ka-btn ${type === filter.value ? 'ka-btn--primary' : ''}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="ka-banner ka-banner--danger mx-4 mt-4">
            <span>
              {error}{' '}
              <button type="button" className="font-semibold underline" onClick={() => void fetchLogs()}>
                ลองอีกครั้ง
              </button>
            </span>
          </div>
        )}

        <div className="p-2">
          <DataTable
            data={logs?.data ?? []}
            columns={columns}
            keyField="id"
            className="bg-[var(--bg-surface)]"
            paginationMeta={logs?.meta ?? null}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </section>
    </div>
  );
}
