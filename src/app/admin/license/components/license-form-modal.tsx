'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import EmployeeLicenseModel from '@/models/employee-license';
import type { EmployeeLicense } from '@/types/employee-license';

interface LicenseFormModalProps {
  isOpen: boolean;
  // Absent: create a new license. Present: rename it.
  license?: EmployeeLicense | null;
  onClose: () => void;
  onSaved: (license: EmployeeLicense) => void;
}

const licenseModel = new EmployeeLicenseModel();

export default function LicenseFormModal({ isOpen, license, onClose, onSaved }: LicenseFormModalProps) {
  const isRename = !!license;
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(license?.license_name ?? '');
    setError(null);
  }, [isOpen, license]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('กรุณากรอกชื่อกลุ่มสิทธิ์');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isRename
        ? await licenseModel.renameLicense(license.license_id, trimmed)
        : await licenseModel.createLicense(trimmed);
      onSaved(saved);
    } catch (err) {
      // The typed name stays in the field.
      setError(err instanceof Error ? err.message : 'บันทึกกลุ่มสิทธิ์ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRename ? 'แก้ชื่อกลุ่มสิทธิ์' : 'สร้างกลุ่มสิทธิ์'}
      description={isRename ? 'ชื่อใหม่มีผลกับพนักงานทุกคนในกลุ่มนี้' : 'สร้างกลุ่มแล้วกำหนดสิทธิ์รายเมนูต่อได้ทันที'}
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
            form="license-form"
            disabled={saving}
            aria-busy={saving}
            className="ka-btn ka-btn--primary min-h-11"
          >
            {saving ? 'กำลังบันทึก…' : isRename ? 'บันทึกชื่อ' : 'สร้างกลุ่มสิทธิ์'}
          </button>
        </>
      }
    >
      <form id="license-form" onSubmit={handleSubmit} className="ka-field" data-invalid={error ? '' : undefined} noValidate>
        <label htmlFor="license_name" className="ka-label">
          ชื่อกลุ่มสิทธิ์<span className="ka-req" aria-hidden="true">*</span>
        </label>
        <input
          id="license_name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="เช่น ฝ่ายจัดซื้อ"
          className="ka-input"
          disabled={saving}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'license_name_error' : undefined}
          required
        />
        {error && (
          <p id="license_name_error" role="alert" className="ka-error whitespace-pre-line">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
