'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeLicenseModel from '@/models/employee-license';
import type { EmployeeLicense, EmployeeLicenseResponse } from '@/types/employee-license';
import LicenseFormModal from './components/license-form-modal';
import PermissionMatrix from './components/permission-matrix';

const licenseModel = new EmployeeLicenseModel();

type ResultState = { isOpen: boolean; status: 'success' | 'error'; action: ActionResultDialogAction; message: string };

export default function LicensePage() {
  const { can } = usePermissions();
  const { user, refreshSession } = useAuth();
  const canAddLicense = can('employee_licenses', 'add');
  const canEditLicense = can('employee_licenses', 'edit');
  const canDeleteLicense = can('employee_licenses', 'delete');
  const canViewPermissions = can('employee_permissions', 'view');
  const canEditPermissions = can('employee_permissions', 'edit');

  const [licenses, setLicenses] = useState<EmployeeLicenseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [selected, setSelected] = useState<EmployeeLicense | null>(null);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [pendingSelect, setPendingSelect] = useState<EmployeeLicense | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formLicense, setFormLicense] = useState<EmployeeLicense | null>(null);
  const [licenseToDelete, setLicenseToDelete] = useState<EmployeeLicense | null>(null);
  const [result, setResult] = useState<ResultState>({ isOpen: false, status: 'success', action: 'insert', message: '' });
  const matrixRef = useRef<HTMLDivElement>(null);

  const fetchLicenses = useCallback(
    async (page = currentPage, query = appliedSearch) => {
      try {
        setLoading(true);
        setListError(null);
        setLicenses(await licenseModel.getLicenses(page, 10, query));
      } catch (error) {
        setListError(error instanceof Error ? error.message : 'โหลดรายการกลุ่มสิทธิ์ไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, appliedSearch],
  );

  useEffect(() => {
    void fetchLicenses();
  }, [fetchLicenses]);

  const select = (license: EmployeeLicense) => {
    setSelected(license);
    setMatrixDirty(false);
    // On a phone the matrix sits under the list.
    requestAnimationFrame(() => matrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const requestSelect = (license: EmployeeLicense) => {
    if (license.license_id === selected?.license_id) return;
    if (matrixDirty) setPendingSelect(license);
    else select(license);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setAppliedSearch(search.trim());
  };

  const handleClearSearch = () => {
    setSearch('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  const handleSaved = (saved: EmployeeLicense) => {
    const renamed = !!formLicense;
    setFormOpen(false);
    setFormLicense(null);
    setResult({
      isOpen: true,
      status: 'success',
      action: renamed ? 'update' : 'insert',
      message: renamed ? `แก้ชื่อกลุ่มสิทธิ์เป็น ${saved.license_name} แล้ว` : `สร้างกลุ่มสิทธิ์ ${saved.license_name} แล้ว`,
    });
    if (renamed) {
      if (selected?.license_id === saved.license_id) setSelected((current) => current && { ...current, ...saved });
    } else if (canViewPermissions && !matrixDirty) {
      // Straight on to ticking the new group's permissions.
      select(saved);
    }
    void fetchLicenses();
  };

  const handleDelete = async () => {
    const license = licenseToDelete;
    if (!license) return;
    try {
      await licenseModel.deleteLicense(license.license_id);
      if (selected?.license_id === license.license_id) {
        setSelected(null);
        setMatrixDirty(false);
      }
      setResult({ isOpen: true, status: 'success', action: 'delete', message: `ลบกลุ่มสิทธิ์ ${license.license_name} แล้ว` });
      const lastOnPage = currentPage > 1 && (licenses?.data.length ?? 0) === 1;
      if (lastOnPage) setCurrentPage(currentPage - 1);
      else await fetchLicenses();
    } catch (error) {
      setResult({
        isOpen: true,
        status: 'error',
        action: 'delete',
        message: error instanceof Error ? error.message : 'ลบกลุ่มสิทธิ์ไม่สำเร็จ',
      });
    }
  };

  const isOwn = (license: EmployeeLicense) => !!user?.license_id && user.license_id === license.license_id;

  const columns: DataTableColumn<EmployeeLicense>[] = [
    {
      key: 'license_name',
      label: 'กลุ่มสิทธิ์',
      render: (_, row) => {
        const isSelected = row.license_id === selected?.license_id;
        const label = (
          <>
            <span className="break-words">{row.license_name}</span>
            {isOwn(row) && <span className="ka-badge ka-badge--info ml-2 align-middle">ของคุณ</span>}
          </>
        );
        return canViewPermissions ? (
          <button
            type="button"
            onClick={() => requestSelect(row)}
            aria-current={isSelected ? 'true' : undefined}
            className={`text-left font-medium hover:text-[var(--brand-ink)] hover:underline ${
              isSelected ? 'text-[var(--brand-ink)]' : ''
            }`}
          >
            {label}
          </button>
        ) : (
          <span className="font-medium">{label}</span>
        );
      },
    },
    {
      key: 'employee_count',
      label: 'พนักงาน',
      width: '96px',
      render: (value) => <span className="numeric">{Number(value ?? 0)} คน</span>,
    },
    {
      key: 'license_id',
      label: 'การจัดการ',
      width: '132px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {canViewPermissions && (
            <button
              type="button"
              onClick={() => requestSelect(row)}
              className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--brand-ink)]"
              title="ดูสิทธิ์รายเมนู"
              aria-label={`ดูสิทธิ์รายเมนูของ ${row.license_name}`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </button>
          )}
          {canEditLicense && (
            <button
              type="button"
              onClick={() => {
                setFormLicense(row);
                setFormOpen(true);
              }}
              className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--brand-ink)]"
              title="แก้ชื่อ"
              aria-label={`แก้ชื่อ ${row.license_name}`}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
              </svg>
            </button>
          )}
          {canDeleteLicense && (
            <button
              type="button"
              onClick={() => setLicenseToDelete(row)}
              className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--danger)]"
              title="ลบ"
              aria-label={`ลบ ${row.license_name}`}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
      {loading && <LoadingSkeleton />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] xl:items-start">
        <section className="min-w-0 rounded-2xl bg-[var(--bg-surface)] shadow-sm" aria-labelledby="license-list-title">
          <div className="border-b border-[var(--border)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="license-list-title" className="text-lg font-semibold text-[var(--ink)]">
                  กลุ่มสิทธิ์
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {canViewPermissions ? 'เลือกกลุ่มเพื่อดูหรือกำหนดสิทธิ์รายเมนู' : 'รายชื่อกลุ่มสิทธิ์ของพนักงาน'}
                </p>
              </div>
              {canAddLicense && (
                <button
                  type="button"
                  onClick={() => {
                    setFormLicense(null);
                    setFormOpen(true);
                  }}
                  className="ka-btn ka-btn--primary"
                >
                  สร้างกลุ่มสิทธิ์
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
                placeholder="ค้นหาจากชื่อกลุ่มสิทธิ์"
                aria-label="ค้นหากลุ่มสิทธิ์"
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
                <button type="button" className="font-semibold underline" onClick={() => void fetchLicenses()}>
                  ลองอีกครั้ง
                </button>
              </span>
            </div>
          )}

          <div className="p-2">
            <DataTable
              data={licenses?.data || []}
              columns={columns}
              keyField="license_id"
              className="bg-[var(--bg-surface)]"
              paginationMeta={licenses?.meta ?? null}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </section>

        <div ref={matrixRef} className="min-w-0 scroll-mt-20">
          {!canViewPermissions ? (
            <div className="ka-card ka-empty">
              <strong>ไม่มีสิทธิ์ดูสิทธิ์รายเมนู</strong>
              <span>ต้องมีสิทธิ์ดูของเมนู employee_permissions กรุณาติดต่อผู้ดูแลระบบ</span>
            </div>
          ) : selected ? (
            <PermissionMatrix
              key={selected.license_id}
              license={selected}
              canEdit={canEditPermissions}
              isOwnLicense={isOwn(selected)}
              onDirtyChange={setMatrixDirty}
              onSaved={() => {
                // Menus and buttons follow the new set at once for the saver's own group.
                if (isOwn(selected)) void refreshSession();
              }}
            />
          ) : (
            <div className="ka-card ka-empty">
              <div className="ka-empty__art" aria-hidden="true">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <strong>ยังไม่ได้เลือกกลุ่มสิทธิ์</strong>
              <span>เลือกกลุ่มจากรายการเพื่อดูสิทธิ์รายเมนู</span>
            </div>
          )}
        </div>
      </div>

      {(canAddLicense || canEditLicense) && (
        <LicenseFormModal
          isOpen={formOpen}
          license={formLicense}
          onClose={() => {
            setFormOpen(false);
            setFormLicense(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        isOpen={!!licenseToDelete}
        title="ยืนยันการลบกลุ่มสิทธิ์"
        message={`ลบกลุ่มสิทธิ์ "${licenseToDelete?.license_name ?? ''}" และสิทธิ์รายเมนูทั้งหมดของกลุ่มนี้? ลบได้เฉพาะกลุ่มที่ไม่มีพนักงานใช้อยู่`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setLicenseToDelete(null)}
      />

      <ConfirmDialog
        isOpen={!!pendingSelect}
        title="ทิ้งการเปลี่ยนแปลงที่ยังไม่บันทึก?"
        message={`สิทธิ์ของกลุ่ม "${selected?.license_name ?? ''}" มีการเปลี่ยนที่ยังไม่บันทึก ถ้าเปลี่ยนไปกลุ่ม "${pendingSelect?.license_name ?? ''}" การเปลี่ยนนั้นจะหายไป`}
        bottom_className="ka-btn ka-btn--primary min-h-11"
        onConfirm={() => pendingSelect && select(pendingSelect)}
        onCancel={() => setPendingSelect(null)}
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
