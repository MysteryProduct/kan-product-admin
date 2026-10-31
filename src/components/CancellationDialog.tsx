'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import Modal from '@/components/Modal';
import CustomSelect from '@/components/CustomSelect';

// The free-text choice; its note then becomes required.
const OTHER = 'อื่นๆ';

/**
 * Asks why before cancelling. With `presets` the reason is picked from a list and a note is
 * optional (required for "อื่นๆ"); the saved reason is "เหตุผล: หมายเหตุ". Without them it is free text.
 */
export default function CancellationDialog({ title, onClose, onConfirm, presets }: {
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  presets?: string[];
}) {
  const [preset, setPreset] = useState('');
  const [note, setNote] = useState('');
  const reason = presets
    ? preset === OTHER ? note.trim() : [preset, note.trim()].filter(Boolean).join(': ')
    : note;
  const setReason = setNote;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) onClose(); };
  const submit = async () => {
    if (submitting.current) return;
    if (!reason.trim()) { setError(preset === OTHER ? 'กรุณาเขียนหมายเหตุเมื่อเลือก “อื่นๆ”' : 'กรุณาระบุเหตุผลในการยกเลิก'); return; }
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
  return <Modal isOpen onClose={close} title={title} description="ระบุเหตุผลเพื่อบันทึกในประวัติเอกสาร" size="compact" closeOnEscape={!busy} closeOnBackdrop={!busy} footer={<>
    <button type="button" disabled={busy} onClick={close} className="ka-btn min-h-11">กลับ</button>
    <button type="button" disabled={busy || !reason.trim()} onClick={() => void submit()} className="ka-btn ka-btn--danger min-h-11">{busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}</button>
  </>}>
    {presets ? (
      <div className="grid gap-4">
        <div className="ka-field">
          <label htmlFor="cancel-reason" className="ka-label">เหตุผล <span className="ka-req">*</span></label>
          <CustomSelect
            id="cancel-reason"
            value={preset}
            onChange={setPreset}
            placeholder="เลือกเหตุผล"
            disabled={busy}
            options={[...presets, OTHER].map((item) => ({ value: item, label: item }))}
          />
        </div>
        <label className="ka-label block">หมายเหตุ{preset === OTHER ? ' (จำเป็น)' : ''}
          <textarea disabled={busy} value={note} onChange={event => setNote(event.target.value)} maxLength={400} rows={3} placeholder={preset === OTHER ? 'บอกเหตุผล' : 'ไม่บังคับ'} className="ka-textarea mt-1.5 font-normal" />
        </label>
      </div>
    ) : (
      <>
        <label className="ka-label block">เหตุผล (จำเป็น)
          <textarea required disabled={busy} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={4} className="ka-textarea mt-1.5 font-normal" />
        </label>
        <p className="ka-help mt-1 numeric">{reason.length}/500 ตัวอักษร</p>
      </>
    )}
    {error && <p role="alert" className="ka-banner ka-banner--danger mt-3 break-words">{error}</p>}
  </Modal>;
}
