'use client';
import { useState } from 'react';
import { useNow } from '@/hooks/useNow';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import { PickupContactLogDto, StorePickup } from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';
import { STORE_PICKUP_STATUS_TONE } from '@/lib/status-tones';
import { STORE_PICKUP_STATUS_LABELS } from '@/lib/store-order-list';
import StatusBadge from '@/components/StatusBadge';
import CustomSelect from '@/components/CustomSelect';
import SfIcon from './sf-icon';

const storeFulfillmentModel = new StoreFulfillmentModel();

const channelLabels: Record<string, string> = {
  phone: 'โทรศัพท์',
  email: 'อีเมล',
  in_person: 'พบที่ร้าน',
  other: 'อื่น ๆ',
};
const outcomeLabels: Record<string, string> = {
  reached: 'ติดต่อได้',
  unreachable: 'ติดต่อไม่ได้',
  other: 'อื่น ๆ',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const inputClass = 'ka-input';

interface PickupProps {
  storeOrderId: string;
  pickup: StorePickup;
  orderPaid: boolean;
  canEdit: boolean;
  action: ReturnType<typeof usePickupAction>;
}

type PickupForm = 'ready' | 'handover' | 'appointment' | 'contact';

/**
 * One save at a time across the pickup cards, as a single card did. A failure stays beside the
 * form that caused it, with what was typed.
 */
export function usePickupAction(onChanged: () => void) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<{ form: PickupForm; message: string } | null>(null);

  async function run(form: PickupForm, action: () => Promise<void>) {
    setPending(true);
    setFailed(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setFailed({ form, message: getApiErrorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  const errorOf = (form: PickupForm) =>
    failed?.form === form ? (
      <p role="alert" className="ka-sf-error">
        {failed.message}
      </p>
    ) : null;

  return { pending, run, errorOf };
}

/** The time left to collect, from the day the customer was told to the date they must come by. */
function PickupWindow({ pickup }: { pickup: StorePickup }) {
  // Follows the clock, so the days left change while the page stays open.
  const now = useNow();
  const due = pickup.secondAppointmentAt ?? pickup.dueAt;
  if (!pickup.readyAt || !due || pickup.status === 'picked_up') return null;
  const start = new Date(pickup.readyAt).getTime();
  const end = new Date(due).getTime();
  const late = now > end;
  const days = Math.ceil(Math.abs(end - now) / DAY_MS);
  const used = end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 100;
  return (
    <div>
      <div className="ka-sf-row ka-sf-row--between mb-1.5">
        <span className="ka-label">เวลารับสินค้า {Math.round((end - start) / DAY_MS)} วัน</span>
        <span className={late ? 'ka-sf-error' : 'ka-sf-cap'}>{late ? `เลยกำหนด ${days} วัน` : `เหลือ ${days} วัน`}</span>
      </div>
      <div className={`ka-sf-meter ${late ? 'ka-sf-meter--late' : ''}`} aria-hidden="true">
        <i style={{ width: `${used}%` }} />
      </div>
    </div>
  );
}

export default function PickupCard({ storeOrderId, pickup, orderPaid, canEdit, action }: PickupProps) {
  const { pending, run, errorOf } = action;
  const [handover, setHandover] = useState({ phone: '', recipient_name: '' });

  const announced = pickup.status !== 'awaiting_ready';
  const collected = pickup.status === 'picked_up';
  const actionable = canEdit && orderPaid && !collected;
  const late = pickup.status === 'overdue' || pickup.status === 'pending_review';

  return (
    <>
      <section className="ka-sf-card ka-sf-card__pad">
        <div className="ka-sf-row ka-sf-row--wrap ka-sf-row--between">
          <h2>การรับสินค้าที่ร้าน</h2>
          <StatusBadge tone={STORE_PICKUP_STATUS_TONE[pickup.status]} live={late}>
            {STORE_PICKUP_STATUS_LABELS[pickup.status]}
          </StatusBadge>
        </div>

        <PickupWindow pickup={pickup} />

        <dl className="ka-sf-dl ka-sf-dl--four">
          <div>
            <dt>แจ้งพร้อมรับเมื่อ</dt>
            <dd>{pickup.readyAt ? formatThaiDate(pickup.readyAt) : '-'}</dd>
          </div>
          <div>
            <dt>ครบกำหนดรับ</dt>
            <dd>{pickup.dueAt ? formatThaiDate(pickup.dueAt) : '-'}</dd>
          </div>
          <div>
            <dt>เก็บสินค้าถึง</dt>
            <dd>{pickup.holdUntil ? formatThaiDate(pickup.holdUntil) : '-'}</dd>
          </div>
          <div>
            <dt>นัดรับครั้งที่สอง</dt>
            <dd>
              {pickup.secondAppointmentAt ? formatThaiDate(pickup.secondAppointmentAt) : '-'}
              {pickup.secondAppointmentNote ? ` · ${pickup.secondAppointmentNote}` : ''}
            </dd>
          </div>
          {collected && (
            <div className="ka-sf-wide">
              <dt>ส่งมอบแล้ว</dt>
              <dd>
                {formatThaiDate(pickup.pickedUpAt!)} · ผู้มารับ: {pickup.recipientName}
              </dd>
            </div>
          )}
        </dl>

        {!orderPaid && <p className="ka-sf-sub">คำสั่งซื้อยังไม่ชำระเงิน จึงยังแจ้งพร้อมรับหรือส่งมอบไม่ได้</p>}

        {actionable && !announced && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void run('ready', () => storeFulfillmentModel.markPickupReady(storeOrderId))}
            className="ka-btn ka-btn--primary self-start"
          >
            แจ้งลูกค้าว่าพร้อมรับ (เริ่มนับ 7 วัน)
          </button>
        )}

        {errorOf('ready')}
      </section>

      {actionable && announced && (
        <form
          className="ka-sf-card ka-sf-card__pad"
          onSubmit={(e) => {
            e.preventDefault();
            void run('handover', () => storeFulfillmentModel.handoverPickup(storeOrderId, handover));
          }}
        >
          <div>
            <h2>ส่งมอบสินค้า</h2>
            <p className="ka-sf-sub">ตรวจเบอร์โทรที่ลูกค้าแจ้งไว้ก่อนส่งมอบ</p>
          </div>
          <div className="ka-sf-form2">
            <label className="ka-field">
              <span className="ka-label">เบอร์โทร</span>
              <input
                required
                inputMode="tel"
                autoComplete="off"
                placeholder="เบอร์โทรที่ลูกค้าแจ้งไว้"
                value={handover.phone}
                onChange={(e) => setHandover((prev) => ({ ...prev, phone: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="ka-field">
              <span className="ka-label">ผู้มารับ</span>
              <input
                required
                autoComplete="off"
                placeholder="ชื่อผู้มารับสินค้า"
                value={handover.recipient_name}
                onChange={(e) => setHandover((prev) => ({ ...prev, recipient_name: e.target.value }))}
                className={inputClass}
              />
            </label>
          </div>
          {errorOf('handover')}
          <button type="submit" disabled={pending} className="ka-btn ka-btn--primary self-start">
            <SfIcon name="tick" small />
            ยืนยันส่งมอบสินค้า
          </button>
        </form>
      )}
    </>
  );
}

/** What staff do while waiting for the customer: a second appointment, and the record of each contact. */
export function PickupFollowUpCards({ storeOrderId, pickup, orderPaid, canEdit, action }: PickupProps) {
  const { pending, run, errorOf } = action;
  const [appointment, setAppointment] = useState({ scheduled_at: '', note: '' });
  const [contact, setContact] = useState<PickupContactLogDto>({
    channel: 'phone',
    outcome: 'unreachable',
    note: '',
  });

  const announced = pickup.status !== 'awaiting_ready';
  const actionable = canEdit && orderPaid && pickup.status !== 'picked_up' && announced;

  return (
    <>
      {actionable && (
        <form
          className="ka-sf-card ka-sf-card__pad"
          onSubmit={(e) => {
            e.preventDefault();
            void run('appointment', async () => {
              await storeFulfillmentModel.scheduleSecondAppointment(storeOrderId, {
                scheduled_at: new Date(appointment.scheduled_at).toISOString(),
                note: appointment.note || undefined,
              });
              setAppointment({ scheduled_at: '', note: '' });
            });
          }}
        >
          <h3>นัดรับครั้งที่สอง</h3>
          <label className="ka-field">
            <span className="ka-label">วันและเวลานัด</span>
            <input
              type="datetime-local"
              required
              value={appointment.scheduled_at}
              onChange={(e) => setAppointment((prev) => ({ ...prev, scheduled_at: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="ka-field">
            <span className="ka-label">ข้อตกลง</span>
            <input
              placeholder="บันทึกข้อตกลงกับลูกค้า"
              value={appointment.note}
              onChange={(e) => setAppointment((prev) => ({ ...prev, note: e.target.value }))}
              className={inputClass}
            />
          </label>
          {errorOf('appointment')}
          <button type="submit" disabled={pending} className="ka-btn">
            บันทึกนัดครั้งที่สอง
          </button>
        </form>
      )}

      <section className="ka-sf-card ka-sf-card__pad">
        <h3>ประวัติการติดต่อ</h3>
        {pickup.contactLog.length === 0 ? (
          <p className="ka-sf-sub">ยังไม่มีบันทึกการติดต่อ</p>
        ) : (
          <ul className="ka-sf-log">
            {pickup.contactLog.map((entry) => (
              <li key={entry.logId}>
                <span
                  className={`ka-sf-log__dot ${
                    entry.outcome === 'reached'
                      ? 'ka-sf-log__dot--ok'
                      : entry.outcome === 'unreachable'
                        ? 'ka-sf-log__dot--bad'
                        : ''
                  }`}
                />
                <span className="min-w-0">
                  {formatThaiDate(entry.createdAt)} · {channelLabels[entry.channel] ?? entry.channel} ·{' '}
                  {outcomeLabels[entry.outcome] ?? entry.outcome}
                  {entry.note && <span className="ka-sf-cap block">{entry.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {actionable && (
          <form
            className="ka-sf-form ka-sf-divider"
            onSubmit={(e) => {
              e.preventDefault();
              void run('contact', async () => {
                await storeFulfillmentModel.logPickupContact(storeOrderId, {
                  ...contact,
                  note: contact.note || undefined,
                });
                setContact({ channel: 'phone', outcome: 'unreachable', note: '' });
              });
            }}
          >
            <div className="ka-sf-form2">
              <div className="ka-field">
                <span className="ka-label">ช่องทางติดต่อ</span>
                <CustomSelect
                  aria-label="ช่องทางติดต่อ"
                  value={contact.channel}
                  onChange={(value) =>
                    setContact((prev) => ({ ...prev, channel: value as PickupContactLogDto['channel'] }))
                  }
                  options={Object.entries(channelLabels).map(([value, label]) => ({ value, label }))}
                />
              </div>
              <div className="ka-field">
                <span className="ka-label">ผลการติดต่อ</span>
                <CustomSelect
                  aria-label="ผลการติดต่อ"
                  value={contact.outcome}
                  onChange={(value) =>
                    setContact((prev) => ({ ...prev, outcome: value as PickupContactLogDto['outcome'] }))
                  }
                  options={Object.entries(outcomeLabels).map(([value, label]) => ({ value, label }))}
                />
              </div>
            </div>
            <label className="ka-field">
              <span className="ka-label">บันทึก</span>
              <input
                placeholder="บันทึกผลการติดต่อ"
                value={contact.note}
                onChange={(e) => setContact((prev) => ({ ...prev, note: e.target.value }))}
                className={inputClass}
              />
            </label>
            {errorOf('contact')}
            <button type="submit" disabled={pending} className="ka-btn">
              บันทึกการติดต่อ
            </button>
          </form>
        )}
      </section>
    </>
  );
}
