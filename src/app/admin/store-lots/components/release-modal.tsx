'use client';
import { useState } from 'react';
import Modal from '@/components/Modal';
import StoreLotModel from '@/models/store-lot';
import { ReleasedStoreLot, StoreLot } from '@/types/store-lot';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';

const storeLotModel = new StoreLotModel();

interface ReleaseLotModalProps {
  lot: StoreLot;
  onClose: () => void;
  onReleased: (released: ReleasedStoreLot) => void;
}

export function variantLabel(lot: StoreLot) {
  return `${lot.colorName || 'ไม่ระบุสี'} / ${lot.sizeName || 'ไม่ระบุขนาด'}`;
}

export default function ReleaseLotModal({
  lot,
  onClose,
  onReleased,
}: ReleaseLotModalProps) {
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleRelease() {
    setPending(true);
    setError('');
    try {
      onReleased(
        await storeLotModel.releaseStoreLot(lot.stockProductId, note.trim()),
      );
    } catch (err) {
      // The note stays in the box so a retry does not lose it.
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={pending ? () => undefined : onClose}
      title="เปิดขายล็อตนี้บนหน้าร้าน"
      description={lot.productName}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="ka-btn min-h-11"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleRelease()}
            disabled={pending}
            className="ka-btn ka-btn--primary min-h-11"
          >
            {pending ? 'กำลังเปิดขาย...' : 'ยืนยันเปิดขายทั้งล็อต'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 text-[var(--color-text-primary)]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--color-text-secondary)]">สี / ขนาด</dt>
          <dd>{variantLabel(lot)}</dd>
          <dt className="text-[var(--color-text-secondary)]">งานผลิตที่มา</dt>
          <dd className="break-words">{lot.sourceName || '-'}</dd>
          <dt className="text-[var(--color-text-secondary)]">วันที่ผลิต</dt>
          <dd>{formatThaiDate(lot.producedAt)}</dd>
          <dt className="text-[var(--color-text-secondary)]">จำนวนคงเหลือ</dt>
          <dd>{lot.remainingQty.toLocaleString('th-TH')}</dd>
        </dl>

        <p className="text-sm text-[var(--color-text-secondary)]">
          เปิดได้ทั้งล็อตเท่านั้น และย้อนกลับไม่ได้ หลังเปิด
          สินค้าจากล็อตนี้ซื้อออนไลน์และใช้ในใบขายได้ทันที
          ตรวจสินค้าให้ผ่านก่อนยืนยัน
        </p>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">หมายเหตุการตรวจ (ไม่บังคับ)</span>
          <textarea
            value={note}
            disabled={pending}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            className="ka-textarea"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
