'use client';

import { useId, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { apiReason } from '../lib/api-reason';

const REASON_LIMIT = 500;

/**
 * Deleting a paid invoice needs a reason, which the API keeps in the document history
 * (TASK-0329 R3). Same flow as CancellationDialog, with delete wording.
 */
export default function PaidDeleteDialog({
  code,
  receiptCode,
  onClose,
  onConfirm,
}: {
  code: string;
  receiptCode: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const fieldId = useId();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const missing = !reason.trim();

  const close = () => {
    if (!submitting.current) onClose();
  };
  const submit = async () => {
    if (submitting.current) return;
    setAttempted(true);
    if (missing) {
      field.current?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (cause) {
      // Like the edit form: a danger toast with the API's reason; the dialog stays with the reason typed (review F4).
      const message = `ลบไม่สำเร็จ ${apiReason(cause)}`;
      toast({ message, tone: 'danger' });
      setError(message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={close}
      title={`ลบ ${code} ที่ชำระครบแล้ว`}
      description={`ใบนี้ชำระครบแล้ว การลบจะบันทึกในประวัติเอกสารพร้อมเหตุผล ถ้าใบรับสินค้า ${receiptCode} ไม่มีใบชำระหนี้อื่น จะกลับไปรอออกใบชำระหนี้ ลบแล้วกู้คืนไม่ได้`}
      size="compact"
      closeOnEscape={!busy}
      closeOnBackdrop={!busy}
      footer={
        <>
          <button type="button" disabled={busy} onClick={close} className="ka-btn min-h-11">
            ไม่ลบ
          </button>
          <button type="button" disabled={busy} onClick={() => void submit()} className="ka-btn ka-btn--danger min-h-11" aria-busy={busy || undefined}>
            {busy ? 'กำลังลบ…' : 'ลบใบชำระหนี้'}
          </button>
        </>
      }
    >
      <label className="ka-label block" htmlFor={fieldId}>
        เหตุผลที่ลบ <span className="ka-req" aria-hidden="true">*</span>
      </label>
      <textarea
        id={fieldId}
        ref={field}
        required
        disabled={busy}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={REASON_LIMIT}
        rows={4}
        className="ka-textarea mt-1.5"
        aria-invalid={(attempted && missing) || undefined}
        aria-describedby={`${fieldId}-help${attempted && missing ? ` ${fieldId}-err` : ''}`}
      />
      <p id={`${fieldId}-help`} className="ka-help mt-1 numeric">
        {reason.length}/{REASON_LIMIT} ตัวอักษร
      </p>
      {attempted && missing && (
        <p id={`${fieldId}-err`} className="ka-is-err">
          ระบุเหตุผลที่ลบใบชำระหนี้ที่ชำระครบแล้ว
        </p>
      )}
      {error && (
        <p className="ka-banner ka-banner--danger mt-3 break-words">
          {error}
        </p>
      )}
    </Modal>
  );
}
