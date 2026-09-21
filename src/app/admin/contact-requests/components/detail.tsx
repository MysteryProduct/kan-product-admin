'use client';
import { useState } from 'react';
import Modal from '@/components/Modal';
import { usePermissions } from '@/hooks/usePermissions';
import ContactRequestModel from '@/models/contact-request';
import { ContactRequest, ContactRequestStatus } from '@/types/contact-request';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';

const contactRequestModel = new ContactRequestModel();

const statusLabels: Record<ContactRequestStatus, string> = {
  new: 'ใหม่',
  contacting: 'กำลังติดต่อ',
  closed: 'ปิดคำขอ',
};

interface ContactRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated: ContactRequest) => void;
  contactRequest: ContactRequest;
}

export default function ContactRequestDetailModal({
  isOpen,
  onClose,
  onSuccess,
  contactRequest,
}: ContactRequestDetailModalProps) {
  const { can } = usePermissions();
  const canEdit = can('contact_requests', 'edit');

  const [status, setStatus] = useState<ContactRequestStatus>(
    contactRequest.status,
  );
  const [contactResult, setContactResult] = useState(
    contactRequest.contactResult ?? '',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setPending(true);
    setError('');
    try {
      // Sent even when blank: the API clears a recorded result on an empty
      // value, which is how staff remove one typed onto the wrong request.
      const updated = await contactRequestModel.updateContactRequest(
        contactRequest.contactRequestId,
        { status, contact_result: contactResult.trim() },
      );
      onSuccess?.(updated);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="รายละเอียดคำขอติดต่อกลับ"
      description={contactRequest.productName}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
          >
            ปิด
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={pending}
              className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          )}
        </>
      }
    >
      <div className="grid gap-4 text-[var(--color-text-primary)]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--color-text-secondary)]">ชื่อผู้ติดต่อ</dt>
          <dd>{contactRequest.contactName}</dd>
          <dt className="text-[var(--color-text-secondary)]">เบอร์โทร</dt>
          <dd>{contactRequest.contactPhone}</dd>
          <dt className="text-[var(--color-text-secondary)]">จำนวนที่สนใจ</dt>
          <dd>{contactRequest.quantity}</dd>
          <dt className="text-[var(--color-text-secondary)]">รายละเอียด</dt>
          <dd className="whitespace-pre-wrap">
            {contactRequest.message || '-'}
          </dd>
          <dt className="text-[var(--color-text-secondary)]">วันที่ส่งคำขอ</dt>
          <dd>{formatThaiDate(contactRequest.createdAt)}</dd>
        </dl>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">สถานะ</span>
          <select
            value={status}
            disabled={!canEdit || pending}
            onChange={(e) => setStatus(e.target.value as ContactRequestStatus)}
            className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2"
          >
            {(Object.keys(statusLabels) as ContactRequestStatus[])
              // R4: a closed request never returns to 'new', so the option is
              // not offered rather than letting the API reject the save.
              .filter(
                (value) =>
                  !(contactRequest.status === 'closed' && value === 'new'),
              )
              .map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">ผลการติดต่อ</span>
          <textarea
            value={contactResult}
            disabled={!canEdit || pending}
            onChange={(e) => setContactResult(e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2"
          />
        </label>

        {!canEdit && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            คุณมีสิทธิ์ดูอย่างเดียว ไม่สามารถแก้ไขสถานะได้
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
