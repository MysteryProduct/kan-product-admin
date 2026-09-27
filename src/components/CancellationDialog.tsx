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
    <button type="button" disabled={busy} onClick={close} className="ka-btn min-h-11">กลับ</button>
    <button type="button" disabled={busy || !reason.trim()} onClick={() => void submit()} className="ka-btn ka-btn--danger min-h-11">{busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}</button>
  </>}>
    <label className="ka-label block">เหตุผล (จำเป็น)
      <textarea required disabled={busy} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={4} className="ka-textarea mt-1.5 font-normal" />
    </label>
    <p className="ka-help mt-1 numeric">{reason.length}/500 ตัวอักษร</p>
    {error && <p role="alert" className="ka-banner ka-banner--danger mt-3 break-words">{error}</p>}
  </Modal>;
}
