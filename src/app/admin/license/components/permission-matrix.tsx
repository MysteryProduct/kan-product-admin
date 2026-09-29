'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EmployeeLicenseModel from '@/models/employee-license';
import ActionResultDialog from '@/components/ActionResultDialog';
import { adminMenu } from '@/lib/admin-menu';
import { getPathsForMenu } from '@/lib/permission-routes';
import {
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
  PermissionDraft,
  SelectionState,
  changedMenuIds,
  columnState,
  draftFromMenus,
  groupMenus,
  rowState,
  setColumn,
  setRow,
  toSavePayload,
  toggleCell,
} from '@/lib/permission-matrix';
import type { EmployeeLicense, LicensePermissionMatrix } from '@/types/employee-license';

interface PermissionMatrixProps {
  license: EmployeeLicense;
  canEdit: boolean;
  isOwnLicense: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}

const licenseModel = new EmployeeLicenseModel();

const SIDEBAR_LEAVES = adminMenu.flatMap((section) => section.items.flatMap((item) => item.subItems ?? []));

// Thai page titles from the sidebar; menus without a page keep their API name.
const MENU_TITLES = new Map(SIDEBAR_LEAVES.map((leaf) => [leaf.menu_name, leaf.title] as const));

// The Admin pages a menu actually controls: its sidebar link and the routes gated on it. The
// menu_url column is not used: `license` stores /admin/license, but that page checks
// employee_licenses.
const adminPagesFor = (menuName: string) => [
  ...new Set([
    ...SIDEBAR_LEAVES.filter((leaf) => leaf.menu_name.toLowerCase() === menuName.toLowerCase()).map((leaf) => leaf.href),
    ...getPathsForMenu(menuName),
  ]),
];

function TriStateCheckbox({
  state,
  label,
  disabled,
  onChange,
}: {
  state: SelectionState;
  label: string;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <label className="ka-check-hit">
      <input
        ref={ref}
        type="checkbox"
        className="ka-check"
        checked={state === 'all'}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export default function PermissionMatrix({
  license,
  canEdit,
  isOwnLicense,
  onDirtyChange,
  onSaved,
}: PermissionMatrixProps) {
  const [matrix, setMatrix] = useState<LicensePermissionMatrix | null>(null);
  const [original, setOriginal] = useState<PermissionDraft>({});
  const [draft, setDraft] = useState<PermissionDraft>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  const apply = (next: LicensePermissionMatrix) => {
    const loaded = draftFromMenus(next.menus);
    setMatrix(next);
    setOriginal(loaded);
    setDraft(loaded);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      apply(await licenseModel.getPermissions(license.license_id));
    } catch (error) {
      setMatrix(null);
      setLoadError(error instanceof Error ? error.message : 'โหลดสิทธิ์ของกลุ่มนี้ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [license.license_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = useMemo(() => changedMenuIds(original, draft), [original, draft]);
  const dirty = changed.length > 0;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const groups = useMemo(() => groupMenus(matrix?.menus ?? []), [matrix]);
  const menuTitle = (menuName: string) => MENU_TITLES.get(menuName) ?? menuName;
  const editable = canEdit && !saving;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      apply(await licenseModel.savePermissions(license.license_id, toSavePayload(draft)));
      setSavedOpen(true);
      onSaved();
    } catch (error) {
      // The ticks stay as they are so the change can be corrected and resent.
      setSaveError(error instanceof Error ? error.message : 'บันทึกสิทธิ์ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ka-card min-w-0" aria-labelledby="permission-matrix-title" aria-busy={loading}>
      <div className="ka-card__head flex-wrap">
        <div className="min-w-0">
          <h2 id="permission-matrix-title" className="ka-card__title break-words">
            สิทธิ์รายเมนู: {license.license_name}
          </h2>
          <p className="ka-help mt-1">
            {canEdit
              ? 'ติ๊กสิ่งที่กลุ่มนี้ทำได้ในแต่ละเมนู แล้วกดบันทึกครั้งเดียว มีผลกับพนักงานในกลุ่มตั้งแต่คำขอถัดไป'
              : 'ดูได้อย่างเดียว คุณไม่มีสิทธิ์แก้ไขสิทธิ์รายเมนู'}
          </p>
        </div>
        {isOwnLicense && <span className="ka-badge ka-badge--info">กลุ่มสิทธิ์ของคุณ</span>}
      </div>

      {loading && (
        <div className="space-y-3 p-6" aria-label="กำลังโหลดสิทธิ์">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="ka-skel h-8 w-full" />
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div className="space-y-3 p-6">
          <div role="alert" className="ka-banner ka-banner--danger">
            <span>{loadError}</span>
          </div>
          <button type="button" className="ka-btn" onClick={() => void load()}>
            ลองโหลดอีกครั้ง
          </button>
        </div>
      )}

      {!loading && matrix && (
        <>
          {saveError && (
            <div role="alert" className="ka-banner ka-banner--danger mx-4 mt-4 whitespace-pre-line">
              <span>
                <strong>บันทึกไม่สำเร็จ</strong> {saveError} ค่าที่ติ๊กไว้ยังอยู่
              </span>
            </div>
          )}

          <div className="ka-table-scroll max-h-[70vh]">
            <table className="ka-table">
              <caption className="sr-only">สิทธิ์ของกลุ่ม {license.license_name} แยกตามเมนูและการกระทำ</caption>
              <thead>
                <tr>
                  <th scope="col" className="left-0 z-[2] min-w-40 sm:min-w-56">
                    เมนู
                  </th>
                  <th scope="col" className="text-center">
                    ทั้งแถว
                  </th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th key={action} scope="col" className="text-center">
                      <span className="flex flex-col items-center gap-1">
                        {PERMISSION_ACTION_LABELS[action]}
                        {canEdit && (
                          <TriStateCheckbox
                            state={columnState(draft, action)}
                            label={`${PERMISSION_ACTION_LABELS[action]} ทุกเมนู`}
                            disabled={!editable}
                            onChange={(checked) => setDraft((current) => setColumn(current, action, checked))}
                          />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <MatrixGroup key={group.group} group={group.group}>
                    {group.menus.map((menu) => {
                      const title = menuTitle(menu.menu_name);
                      const pages = adminPagesFor(menu.menu_name);
                      const flags = draft[menu.menu_id];
                      const isChanged = changed.includes(menu.menu_id);
                      const granted = rowState(draft, menu.menu_id) !== 'none';
                      return (
                        <tr key={menu.menu_id}>
                          {/* Stays in view while the actions scroll sideways on a phone; its ground
                              matches the row tint the table gives rows with a ticked box. */}
                          <th
                            scope="row"
                            className={`sticky top-auto left-0 z-[1] font-normal text-[var(--ink)] whitespace-normal ${
                              granted ? 'bg-[var(--brand-soft)]' : 'bg-[var(--bg-surface)]'
                            }`}
                          >
                            <span className="font-medium">{title}</span>
                            {isChanged && <span className="ka-badge ka-badge--warning ml-2 align-middle">แก้แล้ว</span>}
                            <span className="block text-[13px] leading-5 text-[var(--ink-muted)]">
                              {title !== menu.menu_name && <>{menu.menu_name} · </>}
                              {pages.length ? `หน้า ${pages.join(', ')}` : 'ไม่ได้คุมหน้าใดใน Admin'}
                            </span>
                          </th>
                          <td className="text-center">
                            <TriStateCheckbox
                              state={rowState(draft, menu.menu_id)}
                              label={`ทุกการกระทำของ ${title}`}
                              disabled={!editable}
                              onChange={(checked) => setDraft((current) => setRow(current, menu.menu_id, checked))}
                            />
                          </td>
                          {PERMISSION_ACTIONS.map((action) => (
                            <td key={action} className="text-center">
                              <label className="ka-check-hit">
                                <input
                                  type="checkbox"
                                  className="ka-check"
                                  checked={flags?.[`permission_${action}`] === true}
                                  disabled={!editable}
                                  aria-label={`${PERMISSION_ACTION_LABELS[action]} ${title}`}
                                  onChange={() => setDraft((current) => toggleCell(current, menu.menu_id, action))}
                                />
                              </label>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </MatrixGroup>
                ))}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <div className="flex flex-col gap-3 border-t border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--ink-muted)]" aria-live="polite">
                {dirty ? (
                  <strong className="text-[var(--warning)]">มีการเปลี่ยน {changed.length} เมนูที่ยังไม่บันทึก</strong>
                ) : (
                  'ไม่มีการเปลี่ยนแปลง'
                )}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  className="ka-btn min-h-11"
                  disabled={!dirty || saving}
                  onClick={() => {
                    setDraft(original);
                    setSaveError(null);
                  }}
                >
                  คืนค่าเดิม
                </button>
                <button
                  type="button"
                  className="ka-btn ka-btn--primary min-h-11"
                  disabled={!dirty || saving}
                  aria-busy={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? 'กำลังบันทึก…' : 'บันทึกสิทธิ์'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ActionResultDialog
        isOpen={savedOpen}
        status="success"
        action="update"
        message={`บันทึกสิทธิ์ของกลุ่ม ${license.license_name} แล้ว`}
        onClose={() => setSavedOpen(false)}
      />
    </section>
  );
}

function MatrixGroup({ group, children }: { group: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <th
          scope="colgroup"
          colSpan={2 + PERMISSION_ACTIONS.length}
          className="static py-2 text-[13px] tracking-wide"
        >
          {group}
        </th>
      </tr>
      {children}
    </>
  );
}
