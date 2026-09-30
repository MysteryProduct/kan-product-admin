'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordModal({ isOpen, onClose, onChanged }: ChangePasswordModalProps) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!current || !next || !confirm) {
      setError('กรุณากรอกให้ครบทุกช่อง');
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      return;
    }
    if (next !== confirm) {
      setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      onChanged();
    } catch (err) {
      // What was typed stays in the fields; the API's own wording covers a wrong current password
      // and a throttled attempt.
      setError(err instanceof Error ? err.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    autoComplete: string,
    hint?: string,
  ) => (
    <div className="ka-field" data-invalid={error ? '' : undefined}>
      <label htmlFor={id} className="ka-label">
        {label}
        <span className="ka-req" aria-hidden="true">
          *
        </span>
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ka-input"
        autoComplete={autoComplete}
        disabled={saving}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'change_password_error' : undefined}
      />
      {hint && <p className="ka-help">{hint}</p>}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="เปลี่ยนรหัสผ่าน"
      description="เครื่องที่ใช้อยู่ทำงานต่อได้ ส่วนเครื่องอื่นที่เข้าสู่ระบบค้างไว้จะต้องเข้าสู่ระบบใหม่"
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
            form="change-password-form"
            disabled={saving}
            aria-busy={saving}
            className="ka-btn ka-btn--primary min-h-11"
          >
            {saving ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {field('current_password', 'รหัสผ่านเดิม', current, setCurrent, 'current-password')}
        {field('new_password', 'รหัสผ่านใหม่', next, setNext, 'new-password', `อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)}
        {field('confirm_new_password', 'ยืนยันรหัสผ่านใหม่', confirm, setConfirm, 'new-password')}
        {error && (
          <p id="change_password_error" role="alert" className="ka-error whitespace-pre-line">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
