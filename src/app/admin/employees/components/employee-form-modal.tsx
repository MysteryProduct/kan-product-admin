'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Modal from '@/components/Modal';
import CustomSelect from '@/components/CustomSelect';
import EmployeeModel from '@/models/employee';
import EmployeeLicenseModel from '@/models/employee-license';
import type { CreateEmployeeDto, Employee, UpdateEmployeeDto } from '@/types/employee';
import type { EmployeeLicense } from '@/types/employee-license';

interface EmployeeFormModalProps {
  isOpen: boolean;
  // Absent: add a new employee. Present: edit that employee (username stays fixed).
  employee?: Employee | null;
  // employee_permissions:edit. Without it the license can be seen but not changed.
  canAssignLicense: boolean;
  // Editing one's own row: moving oneself to another license is refused.
  isOwn?: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}

const employeeModel = new EmployeeModel();
const licenseModel = new EmployeeLicenseModel();

const MIN_PASSWORD_LENGTH = 8;
// The API caps a list page at 50.
const LICENSE_PAGE_SIZE = 50;
const EMPTY_FORM: CreateEmployeeDto = {
  employee_username: '',
  employee_password: '',
  employee_firstname: '',
  employee_lastname: '',
  employee_address: '',
  employee_phone: '',
  employee_email: '',
  license_id: '',
};

type FieldErrors = Partial<Record<keyof CreateEmployeeDto, string>>;

async function loadAllLicenses(): Promise<EmployeeLicense[]> {
  const first = await licenseModel.getLicenses(1, LICENSE_PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: Math.max(first.meta.last_page - 1, 0) }, (_, index) =>
      licenseModel.getLicenses(index + 2, LICENSE_PAGE_SIZE),
    ),
  );
  return [first, ...rest].flatMap((page) => page.data);
}

export default function EmployeeFormModal({
  isOpen,
  employee,
  canAssignLicense,
  isOwn = false,
  onClose,
  onSaved,
}: EmployeeFormModalProps) {
  const isEdit = !!employee;
  // The license select gives way to a read-only line, with the reason, when it cannot be used.
  const licenseLockedReason = !isEdit
    ? null
    : !canAssignLicense
      ? 'เปลี่ยนกลุ่มสิทธิ์ไม่ได้ เพราะบัญชีของคุณไม่มีสิทธิ์แก้ไขสิทธิ์รายเมนู (employee_permissions)'
      : isOwn
        ? 'เปลี่ยนกลุ่มสิทธิ์ของตัวเองไม่ได้ เพื่อไม่ให้เสียสิทธิ์ที่ใช้แก้ไขกลับ ให้ผู้ดูแลคนอื่นเป็นผู้ย้ายให้'
        : null;
  const [form, setForm] = useState<CreateEmployeeDto>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [licenses, setLicenses] = useState<EmployeeLicense[]>([]);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      employee
        ? {
            employee_username: employee.employee_username,
            employee_password: '',
            employee_firstname: employee.employee_firstname,
            employee_lastname: employee.employee_lastname,
            employee_address: employee.employee_address,
            employee_phone: employee.employee_phone,
            employee_email: employee.employee_email,
            license_id: employee.license_id,
          }
        : EMPTY_FORM,
    );
    setErrors({});
    setSubmitError(null);
    setLicenses([]);
    setLicenseError(null);
    if (licenseLockedReason) return;
    let cancelled = false;
    setLicenseLoading(true);
    setLicenseError(null);
    loadAllLicenses()
      .then((all) => {
        if (!cancelled) setLicenses(all);
      })
      .catch((error) => {
        if (cancelled) return;
        setLicenses([]);
        setLicenseError(
          axios.isAxiosError(error) && error.response?.status === 403
            ? 'เลือกกลุ่มสิทธิ์ไม่ได้ เพราะบัญชีของคุณไม่มีสิทธิ์ดูกลุ่มสิทธิ์ (employee_licenses) กรุณาติดต่อผู้ดูแลระบบ'
            : error instanceof Error
              ? `โหลดกลุ่มสิทธิ์ไม่สำเร็จ: ${error.message}`
              : 'โหลดกลุ่มสิทธิ์ไม่สำเร็จ',
        );
      })
      .finally(() => {
        if (!cancelled) setLicenseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, employee, licenseLockedReason]);

  const clearError = (field: keyof CreateEmployeeDto) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const set = (field: keyof CreateEmployeeDto) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    clearError(field);
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!isEdit) {
      if (!form.employee_username.trim()) next.employee_username = 'กรุณากรอกชื่อผู้ใช้';
      if (form.employee_password.length < MIN_PASSWORD_LENGTH)
        next.employee_password = `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
    }
    if (!form.employee_firstname.trim()) next.employee_firstname = 'กรุณากรอกชื่อ';
    if (!form.employee_lastname.trim()) next.employee_lastname = 'กรุณากรอกนามสกุล';
    if (!form.employee_email.trim()) next.employee_email = 'กรุณากรอกอีเมล';
    if (!licenseLockedReason && !form.license_id) next.license_id = 'กรุณาเลือกกลุ่มสิทธิ์';
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const username = form.employee_username.trim();
      const details: UpdateEmployeeDto = {
        employee_firstname: form.employee_firstname.trim(),
        employee_lastname: form.employee_lastname.trim(),
        employee_email: form.employee_email.trim(),
        employee_phone: form.employee_phone.trim(),
        employee_address: form.employee_address.trim(),
      };
      if (employee) {
        // license_id is only sent when it may be changed, so a locked field never trips the API.
        await employeeModel.updateEmployee(employee.employee_id, {
          ...details,
          ...(licenseLockedReason ? {} : { license_id: form.license_id }),
        });
      } else {
        await employeeModel.createEmployee({
          ...details,
          employee_username: username,
          employee_password: form.employee_password,
          license_id: form.license_id,
        } as CreateEmployeeDto);
      }
      onSaved(username);
    } catch (error) {
      // Everything typed stays in the form so it can be corrected and resent.
      setSubmitError(error instanceof Error ? error.message : isEdit ? 'แก้ไขพนักงานไม่สำเร็จ' : 'เพิ่มพนักงานไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    id: keyof CreateEmployeeDto,
    label: string,
    options: { type?: string; required?: boolean; autoComplete?: string; hint?: string } = {},
  ) => (
    <div className="ka-field" data-invalid={errors[id] ? '' : undefined}>
      <label htmlFor={id} className="ka-label">
        {label}
        {options.required && (
          <span className="ka-req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={options.type ?? 'text'}
        value={form[id]}
        onChange={set(id)}
        className="ka-input"
        disabled={saving}
        autoComplete={options.autoComplete ?? 'off'}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={errors[id] ? `${id}_error` : options.hint ? `${id}_hint` : undefined}
      />
      {options.hint && !errors[id] && (
        <p id={`${id}_hint`} className="ka-help">
          {options.hint}
        </p>
      )}
      {errors[id] && (
        <p id={`${id}_error`} role="alert" className="ka-error">
          {errors[id]}
        </p>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}
      description={
        isEdit
          ? 'ชื่อผู้ใช้แก้ไม่ได้ ส่วนรหัสผ่านตั้งใหม่ได้จากปุ่ม "ตั้งรหัสผ่านใหม่" ในรายการ'
          : 'พนักงานเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านที่ตั้งไว้ และได้สิทธิ์ตามกลุ่มที่เลือก'
      }
      size="lg"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="ka-btn min-h-11">
            ยกเลิก
          </button>
          <button
            type="submit"
            form="employee-form"
            disabled={saving || licenseLoading}
            aria-busy={saving}
            className="ka-btn ka-btn--primary min-h-11"
          >
            {saving ? 'กำลังบันทึก…' : isEdit ? 'บันทึก' : 'เพิ่มพนักงาน'}
          </button>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {submitError && (
          <div role="alert" className="ka-banner ka-banner--danger whitespace-pre-line">
            <span>{submitError}</span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isEdit ? (
            <div className="ka-field">
              <span className="ka-label">ชื่อผู้ใช้</span>
              <p className="ka-input flex items-center break-all opacity-80" aria-label="ชื่อผู้ใช้ (แก้ไม่ได้)">
                {form.employee_username}
              </p>
            </div>
          ) : (
            <>
              {field('employee_username', 'ชื่อผู้ใช้', { required: true })}
              {field('employee_password', 'รหัสผ่าน', {
                type: 'password',
                required: true,
                autoComplete: 'new-password',
                hint: `อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
              })}
            </>
          )}
          {field('employee_firstname', 'ชื่อ', { required: true })}
          {field('employee_lastname', 'นามสกุล', { required: true })}
          {field('employee_email', 'อีเมล', { type: 'email', required: true })}
          {field('employee_phone', 'เบอร์โทร', { type: 'tel' })}
        </div>
        <div className="ka-field">
          <label htmlFor="employee_address" className="ka-label">
            ที่อยู่
          </label>
          <textarea
            id="employee_address"
            value={form.employee_address}
            onChange={set('employee_address')}
            rows={2}
            className="ka-input"
            disabled={saving}
          />
        </div>
        <div className="ka-field" data-invalid={errors.license_id ? '' : undefined}>
          {licenseLockedReason ? (
            <>
              <span className="ka-label">กลุ่มสิทธิ์</span>
              <p className="ka-input flex items-center break-words opacity-80">{employee?.license_name ?? '-'}</p>
              <p className="ka-help">{licenseLockedReason}</p>
            </>
          ) : licenseError ? (
            <>
              <span className="ka-label">
                กลุ่มสิทธิ์
                <span className="ka-req" aria-hidden="true">
                  *
                </span>
              </span>
              <div role="alert" className="ka-banner ka-banner--danger">
                <span>{licenseError}</span>
              </div>
            </>
          ) : (
            <CustomSelect
              label="กลุ่มสิทธิ์"
              required
              value={form.license_id}
              onChange={(value) => {
                setForm((current) => ({ ...current, license_id: value }));
                clearError('license_id');
              }}
              options={licenses.map((license) => ({ value: license.license_id, label: license.license_name }))}
              placeholder={licenseLoading ? 'กำลังโหลดกลุ่มสิทธิ์…' : 'เลือกกลุ่มสิทธิ์'}
            />
          )}
          {errors.license_id && !licenseError && (
            <p role="alert" className="ka-error">
              {errors.license_id}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
