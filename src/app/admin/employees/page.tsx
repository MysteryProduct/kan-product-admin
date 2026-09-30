'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatusBadge from '@/components/StatusBadge';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeModel from '@/models/employee';
import type { Employee, EmployeeResponse } from '@/types/employee';
import EmployeeFormModal from './components/employee-form-modal';

const employeeModel = new EmployeeModel();

type ResultState = { isOpen: boolean; status: 'success' | 'error'; action: ActionResultDialogAction; message: string };

export default function EmployeesPage() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const canEdit = can('employees', 'edit');
  // Assigning a license grants that license's rights, so adding an employee also takes
  // employee_permissions:edit (TASK-0069); the API enforces the same pair.
  const canAdd = can('employees', 'add') && can('employee_permissions', 'edit');

  const [employees, setEmployees] = useState<EmployeeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [employeeToDisable, setEmployeeToDisable] = useState<Employee | null>(null);
  const [result, setResult] = useState<ResultState>({ isOpen: false, status: 'success', action: 'insert', message: '' });

  const fetchEmployees = useCallback(
    async (page = currentPage, query = appliedSearch) => {
      try {
        setLoading(true);
        setListError(null);
        setEmployees(await employeeModel.getEmployees(page, 10, query));
      } catch (error) {
        setListError(error instanceof Error ? error.message : 'โหลดรายการพนักงานไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, appliedSearch],
  );

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  const handleSearch = () => {
    setCurrentPage(1);
    setAppliedSearch(search.trim());
  };

  const handleClearSearch = () => {
    setSearch('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  const handleSaved = (username: string) => {
    setFormOpen(false);
    setResult({ isOpen: true, status: 'success', action: 'insert', message: `เพิ่มพนักงาน ${username} แล้ว` });
    if (currentPage === 1) void fetchEmployees(1);
    else setCurrentPage(1);
  };

  const setDisabled = async (employee: Employee, disabled: boolean) => {
    try {
      await employeeModel.setDisabled(employee.employee_id, disabled);
      setResult({
        isOpen: true,
        status: 'success',
        action: 'update',
        message: `${disabled ? 'ปิด' : 'เปิด'}ใช้งานพนักงาน ${employee.employee_username} แล้ว`,
      });
      await fetchEmployees();
    } catch (error) {
      setResult({
        isOpen: true,
        status: 'error',
        action: 'update',
        message: error instanceof Error ? error.message : 'เปลี่ยนสถานะพนักงานไม่สำเร็จ',
      });
    }
  };

  const columns: DataTableColumn<Employee>[] = [
    {
      key: 'employee_username',
      label: 'ชื่อผู้ใช้',
      render: (value) => <span className="font-medium break-words">{String(value)}</span>,
    },
    {
      key: 'employee_firstname',
      label: 'ชื่อ-นามสกุล',
      render: (_, row) => (
        <span className="break-words">
          {row.employee_firstname} {row.employee_lastname}
        </span>
      ),
    },
    { key: 'employee_email', label: 'อีเมล', render: (value) => <span className="break-all">{String(value)}</span> },
    { key: 'employee_phone', label: 'เบอร์โทร', render: (value) => String(value || '-') },
    {
      key: 'license_name',
      label: 'กลุ่มสิทธิ์',
      render: (value) => (value ? <span className="ka-badge ka-badge--info">{String(value)}</span> : '-'),
    },
    {
      key: 'employee_disabled_at',
      label: 'สถานะ',
      render: (value) => (
        <StatusBadge tone={value ? 'neutral' : 'success'}>{value ? 'ปิดใช้งาน' : 'ใช้งาน'}</StatusBadge>
      ),
    },
    ...(canEdit
      ? [
          {
            key: 'employee_id' as const,
            label: 'การจัดการ',
            width: '132px',
            render: (_: unknown, row: Employee) => {
              const disabled = !!row.employee_disabled_at;
              const isOwn = row.employee_id === user?.employee_id;
              // Disabling one's own account would lock the admin out, so the API refuses it too.
              if (isOwn && !disabled) return <span className="text-sm text-[var(--ink-muted)]">บัญชีของคุณ</span>;
              return (
                <button
                  type="button"
                  className="ka-btn"
                  onClick={() => (disabled ? void setDisabled(row, false) : setEmployeeToDisable(row))}
                  aria-label={`${disabled ? 'เปิด' : 'ปิด'}ใช้งาน ${row.employee_username}`}
                >
                  {disabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </button>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
      {loading && <LoadingSkeleton />}

      <section className="min-w-0 rounded-2xl bg-[var(--bg-surface)] shadow-sm" aria-labelledby="employee-list-title">
        <div className="border-b border-[var(--border)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="employee-list-title" className="text-lg font-semibold text-[var(--ink)]">
                พนักงาน
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">รายชื่อพนักงานและกลุ่มสิทธิ์ที่ใช้งานอยู่</p>
            </div>
            {canAdd && (
              <button type="button" onClick={() => setFormOpen(true)} className="ka-btn ka-btn--primary">
                เพิ่มพนักงาน
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="ค้นหาจากชื่อผู้ใช้ ชื่อ นามสกุล หรืออีเมล"
              aria-label="ค้นหาพนักงาน"
              className="ka-input min-w-0 flex-1"
            />
            <div className="flex gap-2">
              <button type="button" onClick={handleSearch} className="ka-btn ka-btn--primary">
                ค้นหา
              </button>
              <button type="button" onClick={handleClearSearch} className="ka-btn">
                ล้าง
              </button>
            </div>
          </div>
        </div>

        {listError && (
          <div role="alert" className="ka-banner ka-banner--danger mx-4 mt-4">
            <span>
              {listError}{' '}
              <button type="button" className="font-semibold underline" onClick={() => void fetchEmployees()}>
                ลองอีกครั้ง
              </button>
            </span>
          </div>
        )}

        <div className="p-2">
          <DataTable
            data={employees?.data || []}
            columns={columns}
            keyField="employee_id"
            className="bg-[var(--bg-surface)]"
            paginationMeta={employees?.meta ?? null}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </section>

      {canAdd && <EmployeeFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSaved={handleSaved} />}

      <ConfirmDialog
        isOpen={!!employeeToDisable}
        title="ยืนยันการปิดใช้งานพนักงาน"
        message={`ปิดใช้งาน "${employeeToDisable?.employee_username ?? ''}"? พนักงานจะเข้าสู่ระบบไม่ได้และ session ที่ใช้อยู่จะหมดผลทันที ข้อมูลและเอกสารที่เกี่ยวข้องยังอยู่ครบ เปิดใช้งานกลับได้ภายหลัง`}
        onConfirm={() => employeeToDisable && void setDisabled(employeeToDisable, true)}
        onCancel={() => setEmployeeToDisable(null)}
      />

      <ActionResultDialog
        isOpen={result.isOpen}
        status={result.status}
        action={result.action}
        message={result.message}
        onClose={() => setResult((previous) => ({ ...previous, isOpen: false }))}
      />
    </div>
  );
}
