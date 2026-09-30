'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import EmployeeModel from '@/models/employee';
import type { Employee } from '@/types/employee';

interface EmployeePasswordModalProps {
  isOpen: boolean;
  employee: Employee | null;
  // Resetting one's own password signs this session out too.
  isOwn: boolean;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
}

const employeeModel = new EmployeeModel();
const MIN_PASSWORD_LENGTH = 8;

export default function EmployeePasswordModal({ isOpen, employee, isOwn, onClose, onSaved }: EmployeePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
    setConfirm('');
    setError(null);
  }, [isOpen, employee]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employee) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      return;
    }
    if (password !== confirm) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await employeeModel.setPassword(employee.employee_id, password);
      onSaved(employee);
    } catch (err) {
      // What was typed stays in the fields.
      setError(err instanceof Error ? err.message : 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ตั้งรหัสผ่านใหม่"
      description={employee ? `พนักงาน ${employee.employee_username}` : undefined}
      size="sm"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="ka-btn min-h-11">
            ยกเลิก
          </button>
          <button
            type="submit"
            form="employee-password-form"
            disabled={saving}
            aria-busy={saving}
            className="ka-btn ka-btn--primary min-h-11"
          >
            {saving ? 'กำลังบันทึก…' : 'ตั้งรหัสผ่านใหม่'}
          </button>
        </>
      }
    >
      <form id="employee-password-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div role="note" className="ka-banner ka-banner--warning">
          <span>
            {isOwn
              ? 'นี่คือบัญชีของคุณ เมื่อบันทึกแล้วคุณจะถูกออกจากระบบทุกเครื่องและต้องเข้าสู่ระบบใหม่ด้วยรหัสผ่านนี้'
              : 'เมื่อบันทึกแล้ว พนักงานจะถูกออกจากระบบทุกเครื่องและต้องเข้าสู่ระบบใหม่ด้วยรหัสผ่านนี้'}
          </span>
        </div>
        <div className="ka-field" data-invalid={error ? '' : undefined}>
          <label htmlFor="new_password" className="ka-label">
            รหัสผ่านใหม่
            <span className="ka-req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="new_password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="ka-input"
            autoComplete="new-password"
            disabled={saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'password_error' : undefined}
          />
          <p className="ka-help">อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร</p>
        </div>
        <div className="ka-field" data-invalid={error ? '' : undefined}>
          <label htmlFor="confirm_password" className="ka-label">
            ยืนยันรหัสผ่านใหม่
            <span className="ka-req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="confirm_password"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="ka-input"
            autoComplete="new-password"
            disabled={saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'password_error' : undefined}
          />
          {error && (
            <p id="password_error" role="alert" className="ka-error whitespace-pre-line">
              {error}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
