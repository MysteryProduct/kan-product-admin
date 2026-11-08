'use client';
import { useState } from 'react';
import Modal from '@/components/Modal';
import StoreLotModel from '@/models/store-lot';
import { ReleasedStoreLot, StoreLot } from '@/types/store-lot';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';
import { Icon } from './icons';

const storeLotModel = new StoreLotModel();

interface ReleaseLotModalProps {
  lot: StoreLot;
  onClose: () => void;
  onReleased: (released: ReleasedStoreLot) => void;
}

/** Whole days a lot has waited since production finished. */
export function waitedLabel(producedAt: string) {
  const days = Math.floor((Date.now() - new Date(producedAt).getTime()) / 86_400_000);
  return days < 1 ? 'วันนี้' : `${days.toLocaleString('th-TH')} วัน`;
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
      className="ka-stock-modal"
      isOpen
      onClose={pending ? () => undefined : onClose}
      title="เปิดขายล็อตนี้บนหน้าร้าน"
      description={`${lot.productName} / ${variantLabel(lot)}`}
      size="standard"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="ka-btn"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleRelease()}
            disabled={pending}
            className="ka-btn ka-btn--primary"
          >
            {pending ? 'กำลังเปิดขาย...' : 'ยืนยันเปิดขายทั้งล็อต'}
          </button>
        </>
      }
    >
      <div className="ka-stock-form">
        <dl className="dl">
          <div><dt>จำนวนทั้งล็อต</dt><dd className="num strong">{lot.remainingQty.toLocaleString('th-TH')}</dd></div>
          <div><dt>จากงานผลิต</dt><dd>{lot.sourceName || '-'}</dd></div>
          <div><dt>ผลิตเสร็จ</dt><dd>{formatThaiDate(lot.producedAt)}</dd></div>
          <div><dt>รอมาแล้ว</dt><dd>{waitedLabel(lot.producedAt)}</dd></div>
        </dl>
        <div className="ban inf">
          <Icon name="info" />
          <span>เปิดแล้วลูกค้าซื้อได้ทันที และย้อนกลับไม่ได้ ตรวจของก่อนกดยืนยัน</span>
        </div>
        <label className="f">
          <span className="lbl">หมายเหตุ (ถ้ามี)</span>
          <textarea
            className="ka-textarea"
            value={note}
            disabled={pending}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="เช่น ตรวจแล้ว 120 ใบ ไม่มีตำหนิ"
          />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
