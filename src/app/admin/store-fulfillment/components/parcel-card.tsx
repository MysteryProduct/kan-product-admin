'use client';
import { useState } from 'react';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import { ParcelAddressHistoryEntry, StoreParcel } from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';

const storeFulfillmentModel = new StoreFulfillmentModel();

const statusLabels: Record<StoreParcel['status'], string> = {
  preparing: 'กำลังเตรียม',
  held: 'พักส่ง',
  shipped: 'จัดส่งแล้ว',
  voided: 'ยกเลิกแล้ว',
};
const statusClassMap: Record<StoreParcel['status'], string> = {
  preparing: 'bg-blue-50 text-blue-700',
  held: 'bg-amber-50 text-amber-700',
  shipped: 'bg-green-50 text-green-700',
  voided: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
};

const inputClass =
  'min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2';

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
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [history, setHistory] = useState<ParcelAddressHistoryEntry[] | null>(null);
  const [addressForm, setAddressForm] = useState({
    recipient_name: parcel.recipientName,
    recipient_phone: parcel.recipientPhone,
    address_line1: parcel.addressLine1 ?? '',
    address_line2: parcel.addressLine2 ?? '',
    district: parcel.district ?? '',
    province: parcel.province ?? '',
    postal_code: parcel.postalCode ?? '',
    reason: '',
  });

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

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {parcel.carrierName} · {parcel.trackingNumber}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            บันทึกเมื่อ {formatThaiDate(parcel.createdAt)}
            {parcel.shippedAt && ` · จัดส่งเมื่อ ${formatThaiDate(parcel.shippedAt)}`}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassMap[parcel.status]}`}
        >
          {statusLabels[parcel.status]}
        </span>
      </div>

      <ul className="mt-3 grid gap-1 text-sm">
        {parcel.items.map((item, index) => (
          <li key={index}>
            {item.productName} × {item.quantity}
          </li>
        ))}
      </ul>

      <div className="mt-3 text-sm text-[var(--color-text-secondary)]">
        {editing ? null : (
          <p>
            {parcel.recipientName} · {parcel.recipientPhone}
            {parcel.addressLine1 &&
              ` · ${parcel.addressLine1}${parcel.addressLine2 ? ' ' + parcel.addressLine2 : ''} ${parcel.district ?? ''} ${parcel.province ?? ''} ${parcel.postalCode ?? ''}`}
          </p>
        )}
      </div>

      {editing && (
        <div className="mt-3 grid gap-3 rounded-lg border border-[var(--color-border)] p-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>ชื่อผู้รับ</span>
            <input
              value={addressForm.recipient_name}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, recipient_name: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>เบอร์โทรผู้รับ</span>
            <input
              value={addressForm.recipient_phone}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, recipient_phone: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span>ที่อยู่ บรรทัดที่ 1</span>
            <input
              value={addressForm.address_line1}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, address_line1: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span>ที่อยู่ บรรทัดที่ 2 (ไม่บังคับ)</span>
            <input
              value={addressForm.address_line2}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, address_line2: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>อำเภอ/เขต</span>
            <input
              value={addressForm.district}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, district: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>จังหวัด</span>
            <input
              value={addressForm.province}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, province: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>รหัสไปรษณีย์</span>
            <input
              value={addressForm.postal_code}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, postal_code: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span>เหตุผลที่แก้ (บังคับ)</span>
            <input
              value={addressForm.reason}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, reason: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={pending || !addressForm.reason.trim()}
              onClick={() =>
                void run(async () => {
                  await storeFulfillmentModel.editParcelAddress(
                    parcel.parcelId,
                    addressForm,
                  );
                  setEditing(false);
                })
              }
              className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              บันทึกที่อยู่ใหม่
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {canEdit && parcel.status !== 'voided' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {parcel.status === 'preparing' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void run(() => storeFulfillmentModel.holdParcel(parcel.parcelId))}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-bg-tertiary)]"
            >
              พักส่งเพื่อแก้ที่อยู่
            </button>
          )}
          {parcel.status === 'held' && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-bg-tertiary)]"
            >
              แก้ที่อยู่
            </button>
          )}
          {parcel.status !== 'shipped' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void run(() => storeFulfillmentModel.shipParcel(parcel.parcelId))}
              className="min-h-11 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              ยืนยันจัดส่งแล้ว
            </button>
          )}
          {/* Only before it ships: once a parcel is on its way, undoing the
              record here would not bring it back. */}
          {parcel.status !== 'shipped' && !voiding && (
            <button
              type="button"
              onClick={() => setVoiding(true)}
              className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              ยกเลิกพัสดุนี้
            </button>
          )}
          <button
            type="button"
            onClick={() => void toggleHistory()}
            className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-bg-tertiary)]"
          >
            {history ? 'ซ่อนประวัติที่อยู่' : 'ดูประวัติที่อยู่'}
          </button>
        </div>
      )}

      {canEdit && voiding && (
        <div className="mt-3 grid gap-2 border-t border-[var(--color-border)] pt-3">
          <p className="text-sm">
            ยกเลิกพัสดุนี้แล้วจำนวนสินค้าจะกลับไปเป็นยอดที่ยังไม่ได้ส่ง
            เพื่อบันทึกใหม่ให้ถูกต้อง พัสดุใบนี้จะยังอยู่ในระบบเป็นประวัติ
          </p>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">เหตุผล</span>
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              maxLength={500}
              placeholder="เช่น คีย์จำนวนผิด"
              className={inputClass}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || voidReason.trim() === ''}
              onClick={() =>
                void run(async () => {
                  await storeFulfillmentModel.voidParcel(
                    parcel.parcelId,
                    voidReason.trim(),
                  );
                  setVoiding(false);
                  setVoidReason('');
                })
              }
              className="min-h-11 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              ยืนยันยกเลิกพัสดุ
            </button>
            <button
              type="button"
              onClick={() => {
                setVoiding(false);
                setVoidReason('');
              }}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-bg-tertiary)]"
            >
              ไม่ยกเลิก
            </button>
          </div>
        </div>
      )}

      {history && (
        <ul className="mt-3 grid gap-2 border-t border-[var(--color-border)] pt-3 text-sm">
          {history.length === 0 && (
            <li className="text-[var(--color-text-secondary)]">ไม่มีประวัติการแก้ไข</li>
          )}
          {history.map((entry) => (
            <li key={entry.historyId}>
              <p className="text-[var(--color-text-secondary)]">
                {formatThaiDate(entry.createdAt)} · เหตุผล: {entry.reason}
              </p>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
