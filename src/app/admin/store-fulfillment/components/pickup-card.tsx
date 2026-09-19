'use client';
import { useState } from 'react';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  PickupContactLogDto,
  StorePickup,
  StorePickupStatus,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';

const storeFulfillmentModel = new StoreFulfillmentModel();

const statusLabels: Record<StorePickupStatus, string> = {
  awaiting_ready: 'ยังไม่ได้แจ้งพร้อมรับ',
  ready: 'พร้อมรับ',
  rescheduled: 'นัดรับครั้งที่สอง',
  overdue: 'เกินกำหนดรับ',
  pending_review: 'รอพิจารณากรณีไม่รับสินค้า',
  picked_up: 'รับสินค้าแล้ว',
};
const statusClassMap: Record<StorePickupStatus, string> = {
  awaiting_ready: 'bg-gray-100 text-gray-700',
  ready: 'bg-blue-50 text-blue-700',
  rescheduled: 'bg-indigo-50 text-indigo-700',
  overdue: 'bg-amber-50 text-amber-700',
  pending_review: 'bg-red-50 text-red-700',
  picked_up: 'bg-green-50 text-green-700',
};

const channelLabels: Record<string, string> = {
  phone: 'โทรศัพท์',
  sms: 'SMS',
  email: 'อีเมล',
  in_person: 'พบที่ร้าน',
  other: 'อื่น ๆ',
};
const outcomeLabels: Record<string, string> = {
  reached: 'ติดต่อได้',
  unreachable: 'ติดต่อไม่ได้',
  other: 'อื่น ๆ',
};

const inputClass =
  'min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2';

export default function PickupCard({
  storeOrderId,
  pickup,
  orderPaid,
  canEdit,
  onChanged,
}: {
  storeOrderId: string;
  pickup: StorePickup;
  orderPaid: boolean;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [appointment, setAppointment] = useState({ scheduled_at: '', note: '' });
  const [contact, setContact] = useState<PickupContactLogDto>({
    channel: 'phone',
    outcome: 'unreachable',
    note: '',
  });
  const [handover, setHandover] = useState({ phone: '', recipient_name: '' });

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

  const announced = pickup.status !== 'awaiting_ready';
  const collected = pickup.status === 'picked_up';
  const actionable = canEdit && orderPaid && !collected;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">การรับสินค้าที่ร้าน</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm ${statusClassMap[pickup.status]}`}
        >
          {statusLabels[pickup.status]}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-text-secondary)]">แจ้งพร้อมรับเมื่อ</dt>
          <dd>{pickup.readyAt ? formatThaiDate(pickup.readyAt) : '-'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">ครบกำหนดรับ</dt>
          <dd>{pickup.dueAt ? formatThaiDate(pickup.dueAt) : '-'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">เก็บสินค้าถึง</dt>
          <dd>{pickup.holdUntil ? formatThaiDate(pickup.holdUntil) : '-'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">นัดรับครั้งที่สอง</dt>
          <dd>
            {pickup.secondAppointmentAt
              ? formatThaiDate(pickup.secondAppointmentAt)
              : '-'}
            {pickup.secondAppointmentNote ? ` · ${pickup.secondAppointmentNote}` : ''}
          </dd>
        </div>
        {collected && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--color-text-secondary)]">ส่งมอบแล้ว</dt>
            <dd>
              {formatThaiDate(pickup.pickedUpAt!)} · ผู้มารับ: {pickup.recipientName}
            </dd>
          </div>
        )}
      </dl>

      {error && (
        <p role="alert" className="mt-3 text-[var(--color-error)]">
          {error}
        </p>
      )}

      {!orderPaid && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          คำสั่งซื้อยังไม่ชำระเงิน จึงยังแจ้งพร้อมรับหรือส่งมอบไม่ได้
        </p>
      )}

      {actionable && !announced && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(() => storeFulfillmentModel.markPickupReady(storeOrderId))}
          className="mt-4 min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          แจ้งลูกค้าว่าพร้อมรับ (เริ่มนับ 7 วัน)
        </button>
      )}

      {actionable && announced && (
        <div className="mt-4 grid gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await storeFulfillmentModel.scheduleSecondAppointment(storeOrderId, {
                  scheduled_at: new Date(appointment.scheduled_at).toISOString(),
                  note: appointment.note || undefined,
                });
                setAppointment({ scheduled_at: '', note: '' });
              });
            }}
            className="grid gap-2 border-t border-[var(--color-border)] pt-4 sm:grid-cols-[auto_1fr_auto]"
          >
            <input
              type="datetime-local"
              required
              value={appointment.scheduled_at}
              onChange={(e) =>
                setAppointment((prev) => ({ ...prev, scheduled_at: e.target.value }))
              }
              className={inputClass}
            />
            <input
              placeholder="บันทึกข้อตกลงกับลูกค้า"
              value={appointment.note}
              onChange={(e) =>
                setAppointment((prev) => ({ ...prev, note: e.target.value }))
              }
              className={inputClass}
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-medium hover:bg-[var(--color-bg-tertiary)] disabled:opacity-60"
            >
              บันทึกนัดครั้งที่สอง
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await storeFulfillmentModel.logPickupContact(storeOrderId, {
                  ...contact,
                  note: contact.note || undefined,
                });
                setContact({ channel: 'phone', outcome: 'unreachable', note: '' });
              });
            }}
            className="grid gap-2 border-t border-[var(--color-border)] pt-4 sm:grid-cols-[auto_auto_1fr_auto]"
          >
            <select
              value={contact.channel}
              onChange={(e) =>
                setContact((prev) => ({
                  ...prev,
                  channel: e.target.value as PickupContactLogDto['channel'],
                }))
              }
              className={inputClass}
            >
              {Object.entries(channelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={contact.outcome}
              onChange={(e) =>
                setContact((prev) => ({
                  ...prev,
                  outcome: e.target.value as PickupContactLogDto['outcome'],
                }))
              }
              className={inputClass}
            >
              {Object.entries(outcomeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              placeholder="บันทึกผลการติดต่อ"
              value={contact.note}
              onChange={(e) => setContact((prev) => ({ ...prev, note: e.target.value }))}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-medium hover:bg-[var(--color-bg-tertiary)] disabled:opacity-60"
            >
              บันทึกการติดต่อ
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                storeFulfillmentModel.handoverPickup(storeOrderId, handover),
              );
            }}
            className="grid gap-2 border-t border-[var(--color-border)] pt-4 sm:grid-cols-[auto_1fr_auto]"
          >
            <input
              required
              placeholder="เบอร์โทรที่ลูกค้าแจ้งไว้"
              value={handover.phone}
              onChange={(e) =>
                setHandover((prev) => ({ ...prev, phone: e.target.value }))
              }
              className={inputClass}
            />
            <input
              required
              placeholder="ชื่อผู้มารับสินค้า"
              value={handover.recipient_name}
              onChange={(e) =>
                setHandover((prev) => ({ ...prev, recipient_name: e.target.value }))
              }
              className={inputClass}
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              ยืนยันส่งมอบสินค้า
            </button>
          </form>
        </div>
      )}

      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
        <h3 className="text-sm font-medium">ประวัติการติดต่อ</h3>
        {pickup.contactLog.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            ยังไม่มีบันทึกการติดต่อ
          </p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {pickup.contactLog.map((entry) => (
              <li key={entry.logId} className="flex flex-wrap gap-2">
                <span className="text-[var(--color-text-secondary)]">
                  {formatThaiDate(entry.createdAt)}
                </span>
                <span>
                  {channelLabels[entry.channel] ?? entry.channel} ·{' '}
                  {outcomeLabels[entry.outcome] ?? entry.outcome}
                </span>
                {entry.note && <span>— {entry.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
