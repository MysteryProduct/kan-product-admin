'use client';
import { useState } from 'react';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  ParcelAddressHistoryEntry,
  RecordParcelReturnDto,
  StoreParcel,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';
import { STORE_PARCEL_STATUS_TONE } from '@/lib/status-tones';
import StatusBadge from '@/components/StatusBadge';
import CustomSelect from '@/components/CustomSelect';
import Modal from '@/components/Modal';
import SfIcon, { type SfIconName } from './sf-icon';

const storeFulfillmentModel = new StoreFulfillmentModel();

const statusLabels: Record<StoreParcel['status'], string> = {
  preparing: 'กำลังเตรียม',
  held: 'พักส่ง',
  shipped: 'จัดส่งแล้ว',
  voided: 'ยกเลิกแล้ว',
  returned: 'ตีกลับ',
};

const statusIcons: Record<StoreParcel['status'], SfIconName> = {
  preparing: 'cube',
  held: 'clock',
  shipped: 'truck',
  voided: 'xCircle',
  returned: 'undo',
};

const contactOutcomeLabels: Record<RecordParcelReturnDto['contact_outcome'], string> = {
  reached: 'ติดต่อได้',
  unreachable: 'ติดต่อไม่ได้',
  other: 'อื่น ๆ',
};

const addressFields = [
  { key: 'recipient_name', label: 'ชื่อผู้รับ', autoComplete: 'name' },
  { key: 'recipient_phone', label: 'เบอร์โทรผู้รับ', autoComplete: 'tel', inputMode: 'tel' },
  { key: 'address_line1', label: 'ที่อยู่ บรรทัดที่ 1', autoComplete: 'address-line1', wide: true },
  { key: 'address_line2', label: 'ที่อยู่ บรรทัดที่ 2 (ไม่บังคับ)', autoComplete: 'address-line2', wide: true },
  { key: 'district', label: 'อำเภอ/เขต', autoComplete: 'address-level2' },
  { key: 'province', label: 'จังหวัด', autoComplete: 'address-level1' },
  { key: 'postal_code', label: 'รหัสไปรษณีย์', autoComplete: 'postal-code', inputMode: 'numeric' },
] as const;

const inputClass = 'ka-input';
const RETURN_FORM_ID = 'ka-sf-parcel-return';

const emptyReturn = {
  reason: '',
  contact_outcome: 'reached' as RecordParcelReturnDto['contact_outcome'],
  contact_note: '',
};

const parcelAddress = (parcel: StoreParcel) => ({
  recipient_name: parcel.recipientName,
  recipient_phone: parcel.recipientPhone,
  address_line1: parcel.addressLine1 ?? '',
  address_line2: parcel.addressLine2 ?? '',
  district: parcel.district ?? '',
  province: parcel.province ?? '',
  postal_code: parcel.postalCode ?? '',
  reason: '',
});

export default function ParcelCard({
  parcel,
  canEdit,
  onChanged,
}: {
  parcel: StoreParcel;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [returning, setReturning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [returnForm, setReturnForm] = useState(emptyReturn);
  const [history, setHistory] = useState<ParcelAddressHistoryEntry[] | null>(null);
  const [addressForm, setAddressForm] = useState(() => parcelAddress(parcel));

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError('');
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  // A dialog stays open on failure, with what was typed and the reason beside it.
  async function save(action: () => Promise<void>, close: () => void) {
    setPending(true);
    setDialogError('');
    try {
      await action();
      close();
      onChanged();
    } catch (err) {
      setDialogError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  // Not while saving: a failure must have an open dialog to appear in. Closing
  // drops what was typed, as the "ทิ้งการแก้ไข" question says.
  function closeDialog(close: () => void) {
    if (pending) return;
    setDialogError('');
    setVoidReason('');
    setReturnForm(emptyReturn);
    setAddressForm(parcelAddress(parcel));
    close();
  }

  async function toggleHistory() {
    if (history) {
      setHistory(null);
      return;
    }
    try {
      setHistory(await storeFulfillmentModel.getAddressHistory(parcel.parcelId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function copyTracking() {
    try {
      await navigator.clipboard.writeText(parcel.trackingNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('คัดลอกเลขพัสดุไม่สำเร็จ เลือกข้อความแล้วคัดลอกเองได้');
    }
  }

  const items = parcel.items.map((item) => `${item.productName} × ${item.quantity}`);

  if (parcel.status === 'voided') {
    return (
      <div className="ka-sf-voided">
        <StatusBadge tone={STORE_PARCEL_STATUS_TONE.voided}>{statusLabels.voided}</StatusBadge>
        <span>
          {parcel.carrierName} <span className="ka-sf-code-text">{parcel.trackingNumber}</span> · {items.join(', ')}
          {parcel.voidReason ? ` · เหตุผล: ${parcel.voidReason}` : ''}
        </span>
      </div>
    );
  }

  const tone = STORE_PARCEL_STATUS_TONE[parcel.status];

  return (
    <article className="ka-sf-parcel">
      <span className={`ka-sf-parcel__icon ka-sf-tone--${tone}`}>
        <SfIcon name={statusIcons[parcel.status]} />
      </span>
      <div className="ka-sf-parcel__top">
        <h3>{parcel.carrierName}</h3>
        <span className="ka-sf-code-text">{parcel.trackingNumber}</span>
        <button
          type="button"
          className="ka-sf-copy"
          aria-label={`คัดลอกเลขพัสดุ ${parcel.trackingNumber}`}
          onClick={() => void copyTracking()}
        >
          <SfIcon name={copied ? 'tick' : 'copy'} small />
        </button>
        <span className="sr-only" role="status">
          {copied ? 'คัดลอกเลขพัสดุแล้ว' : ''}
        </span>
        <StatusBadge tone={tone} live={parcel.status === 'preparing'}>
          {statusLabels[parcel.status]}
        </StatusBadge>
      </div>
      <ul className="ka-sf-chips">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      <p className="ka-sf-sub mt-1">
        บันทึกเมื่อ {formatThaiDate(parcel.createdAt)}
        {parcel.shippedAt && ` · จัดส่งเมื่อ ${formatThaiDate(parcel.shippedAt)}`}
        {parcel.returnedAt && ` · ตีกลับเมื่อ ${formatThaiDate(parcel.returnedAt)}`}
        <br />
        {parcel.recipientName} · {parcel.recipientPhone}
        {parcel.addressLine1 &&
          ` · ${parcel.addressLine1}${parcel.addressLine2 ? ' ' + parcel.addressLine2 : ''} ${parcel.district ?? ''} ${parcel.province ?? ''} ${parcel.postalCode ?? ''}`}
      </p>

      {parcel.status === 'returned' && (
        <p className="ka-sf-sub col-start-2">
          เหตุผลที่ตีกลับ: {parcel.returnReason ?? '-'}
          {parcel.returnContactOutcome &&
            ` · ${contactOutcomeLabels[parcel.returnContactOutcome]}`}
          {parcel.returnContactNote && ` — ${parcel.returnContactNote}`}
        </p>
      )}

      {canEdit && parcel.status !== 'returned' && (
        <div className="ka-sf-actions">
          {parcel.status !== 'shipped' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void run(() => storeFulfillmentModel.shipParcel(parcel.parcelId))}
              className="ka-btn ka-btn--primary"
            >
              <SfIcon name="tick" small />
              ยืนยันจัดส่งแล้ว
            </button>
          )}
          {parcel.status === 'preparing' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void run(() => storeFulfillmentModel.holdParcel(parcel.parcelId))}
              className="ka-btn"
            >
              พักส่งเพื่อแก้ที่อยู่
            </button>
          )}
          {parcel.status === 'held' && (
            <button type="button" onClick={() => setEditing(true)} className="ka-btn">
              แก้ที่อยู่
            </button>
          )}
          {parcel.status === 'shipped' && (
            <button type="button" onClick={() => setReturning(true)} className="ka-btn ka-btn--danger">
              บันทึกพัสดุตีกลับ
            </button>
          )}
          {/* Only before it ships: once a parcel is on its way, undoing the
              record here would not bring it back. */}
          {parcel.status !== 'shipped' && (
            <button type="button" onClick={() => setVoiding(true)} className="ka-btn ka-btn--danger">
              ยกเลิกพัสดุนี้
            </button>
          )}
          <button type="button" onClick={() => void toggleHistory()} className="ka-btn ka-btn--ghost">
            {history ? 'ซ่อนประวัติที่อยู่' : 'ดูประวัติที่อยู่'}
          </button>
        </div>
      )}

      {history && (
        <ul className="ka-sf-history ka-sf-sub">
          {history.length === 0 && <li>ไม่มีประวัติการแก้ไข</li>}
          {history.map((entry) => (
            <li key={entry.historyId}>
              {formatThaiDate(entry.createdAt)} · เหตุผล: {entry.reason}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="ka-sf-error col-start-2">
          {error}
        </p>
      )}

      <Modal
        isOpen={editing}
        closeOnBackdrop={!pending}
        closeOnEscape={!pending}
        onClose={() => closeDialog(() => setEditing(false))}
        title="แก้ที่อยู่"
        description={`${parcel.carrierName} ${parcel.trackingNumber}`}
        size="wide"
        guardUnsaved={!pending}
        className="ka-sf-modal ka-sf-modal--wide"
        footer={
          <>
            <button type="button" disabled={pending} onClick={() => closeDialog(() => setEditing(false))} className="ka-btn">
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={pending || !addressForm.reason.trim()}
              onClick={() =>
                void save(
                  () => storeFulfillmentModel.editParcelAddress(parcel.parcelId, addressForm).then(() => undefined),
                  () => {
                    setEditing(false);
                    setAddressForm((prev) => ({ ...prev, reason: '' }));
                  },
                )
              }
              className="ka-btn ka-btn--primary"
            >
              บันทึกที่อยู่ใหม่
            </button>
          </>
        }
      >
        <div className="ka-sf-form2">
          {addressFields.map((field) => (
            <label key={field.key} className={`ka-field ${'wide' in field ? 'ka-sf-wide' : ''}`}>
              <span className="ka-label">{field.label}</span>
              <input
                value={addressForm[field.key]}
                autoComplete={field.autoComplete}
                inputMode={'inputMode' in field ? field.inputMode : undefined}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className={inputClass}
              />
            </label>
          ))}
          <label className="ka-field ka-sf-wide">
            <span className="ka-label">เหตุผลที่แก้ (บังคับ)</span>
            <input
              value={addressForm.reason}
              onChange={(e) => setAddressForm((prev) => ({ ...prev, reason: e.target.value }))}
              className={inputClass}
            />
          </label>
          {dialogError && (
            <p role="alert" className="ka-sf-error ka-sf-wide">
              {dialogError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={voiding}
        closeOnBackdrop={!pending}
        closeOnEscape={!pending}
        onClose={() => closeDialog(() => setVoiding(false))}
        title="ยกเลิกพัสดุนี้"
        size="standard"
        guardUnsaved={!pending}
        className="ka-sf-modal"
        footer={
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => closeDialog(() => setVoiding(false))}
              className="ka-btn"
            >
              ไม่ยกเลิก
            </button>
            <button
              type="button"
              disabled={pending || voidReason.trim() === ''}
              onClick={() =>
                void save(
                  () => storeFulfillmentModel.voidParcel(parcel.parcelId, voidReason.trim()).then(() => undefined),
                  () => {
                    setVoiding(false);
                    setVoidReason('');
                  },
                )
              }
              className="ka-btn ka-btn--danger"
            >
              ยืนยันยกเลิกพัสดุ
            </button>
          </>
        }
      >
        <div className="ka-sf-form">
          <p className="m-0">
            ยกเลิกพัสดุนี้แล้วจำนวนสินค้าจะกลับไปเป็นยอดที่ยังไม่ได้ส่ง
            เพื่อบันทึกใหม่ให้ถูกต้อง พัสดุใบนี้จะยังอยู่ในระบบเป็นประวัติ
          </p>
          <label className="ka-field">
            <span className="ka-label">เหตุผล</span>
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              maxLength={500}
              placeholder="เช่น คีย์จำนวนผิด"
              className={inputClass}
            />
          </label>
          {dialogError && (
            <p role="alert" className="ka-sf-error">
              {dialogError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={returning}
        closeOnBackdrop={!pending}
        closeOnEscape={!pending}
        onClose={() => closeDialog(() => setReturning(false))}
        title="บันทึกพัสดุตีกลับ"
        size="standard"
        guardUnsaved={!pending}
        className="ka-sf-modal"
        footer={
          <>
            <button type="button" disabled={pending} onClick={() => closeDialog(() => setReturning(false))} className="ka-btn">
              ยกเลิก
            </button>
            <button
              type="submit"
              form={`${RETURN_FORM_ID}-${parcel.parcelId}`}
              disabled={pending || returnForm.reason.trim() === ''}
              className="ka-btn ka-btn--danger"
            >
              ยืนยันพัสดุตีกลับ
            </button>
          </>
        }
      >
        <form
          id={`${RETURN_FORM_ID}-${parcel.parcelId}`}
          className="ka-sf-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              () =>
                storeFulfillmentModel
                  .recordParcelReturn(parcel.parcelId, {
                    reason: returnForm.reason.trim(),
                    contact_outcome: returnForm.contact_outcome,
                    contact_note: returnForm.contact_note.trim() || undefined,
                  })
                  .then(() => undefined),
              () => {
                setReturning(false);
                setReturnForm(emptyReturn);
              },
            );
          }}
        >
          <p className="ka-sf-ban ka-sf-tone--warning">
            <SfIcon name="warn" />
            จำนวนสินค้าจะกลับไปเป็นยอดที่ยังไม่ได้ส่ง และระบบจะเรียกเก็บค่าจัดส่ง
            50 บาทก่อนส่งใหม่ แม้รอบแรกจะส่งฟรี
          </p>
          <label className="ka-field">
            <span className="ka-label">เหตุผลที่ตีกลับ</span>
            <input
              required
              maxLength={500}
              value={returnForm.reason}
              onChange={(e) => setReturnForm((prev) => ({ ...prev, reason: e.target.value }))}
              className={inputClass}
            />
          </label>
          <div className="ka-field">
            <span className="ka-label">ผลการติดต่อลูกค้า</span>
            <CustomSelect
              aria-label="ผลการติดต่อลูกค้า"
              value={returnForm.contact_outcome}
              onChange={(value) =>
                setReturnForm((prev) => ({
                  ...prev,
                  contact_outcome: value as RecordParcelReturnDto['contact_outcome'],
                }))
              }
              options={Object.entries(contactOutcomeLabels).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <label className="ka-field">
            <span className="ka-label">บันทึกเพิ่มเติม (ไม่บังคับ)</span>
            <textarea
              maxLength={500}
              rows={2}
              value={returnForm.contact_note}
              onChange={(e) => setReturnForm((prev) => ({ ...prev, contact_note: e.target.value }))}
              className="ka-textarea"
            />
          </label>
          {dialogError && (
            <p role="alert" className="ka-sf-error">
              {dialogError}
            </p>
          )}
        </form>
      </Modal>
    </article>
  );
}
