'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import Modal from '@/components/Modal';

export default function CancellationDialog({ title, onClose, onConfirm }: {
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) onClose(); };
  const submit = async () => {
    if (submitting.current) return;
    if (!reason.trim()) { setError('กรุณาระบุเหตุผลในการยกเลิก'); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (cause) {
      const message = axios.isAxiosError(cause) ? cause.response?.data?.message : undefined;
      setError(Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return <Modal isOpen onClose={close} title={title} description="ระบุเหตุผลเพื่อบันทึกในประวัติเอกสาร" size="sm" closeOnEscape={!busy} closeOnBackdrop={!busy} footer={<>
    <button type="button" disabled={busy} onClick={close} className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2">กลับ</button>
    <button type="button" disabled={busy || !reason.trim()} onClick={() => void submit()} className="min-h-11 rounded-lg bg-[var(--color-error)] px-4 py-2 text-white disabled:opacity-50">{busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}</button>
  </>}>
    <label className="block text-sm font-medium">เหตุผล (จำเป็น)
      <textarea required disabled={busy} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={4} className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2" />
    </label>
    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{reason.length}/500 ตัวอักษร</p>
    {error && <p role="alert" className="mt-3 break-words text-[var(--color-error)]">{error}</p>}
  </Modal>;
}
