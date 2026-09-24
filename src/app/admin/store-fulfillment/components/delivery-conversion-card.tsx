'use client';
import { useState } from 'react';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  ConvertToDeliveryDto,
  StoreOrderWithParcels,
  StoreShippingChargeStatus,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';
import { RefundPanel } from './cancellation-card';

const storeFulfillmentModel = new StoreFulfillmentModel();

const chargeStatusLabels: Record<StoreShippingChargeStatus, string> = {
  awaiting_payment: 'รอลูกค้าชำระ',
  paid: 'ชำระแล้ว',
  pending_review: 'รอพิจารณา (ครบกำหนดเก็บสินค้า)',
  void: 'ไม่ต้องชำระแล้ว (ยกเลิกคำสั่งซื้อ)',
};
const chargeStatusClassMap: Record<StoreShippingChargeStatus, string> = {
  awaiting_payment: 'bg-amber-50 text-amber-700',
  paid: 'bg-green-50 text-green-700',
  pending_review: 'bg-red-50 text-red-700',
  void: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
};
const methodLabels = { promptpay: 'พร้อมเพย์', card: 'บัตร' };
const chargeReasonLabels = {
  conversion: 'เปลี่ยนจากรับที่ร้านเป็นจัดส่ง',
  return: 'ส่งใหม่หลังพัสดุตีกลับ',
};

const inputClass =
  'min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2';

const emptyForm: Required<ConvertToDeliveryDto> = {
  recipient_name: '',
  recipient_phone: '',
  address_line1: '',
  address_line2: '',
  district: '',
  province: '',
  postal_code: '',
  note: '',
};

const addressFields: {
  key: keyof ConvertToDeliveryDto;
  label: string;
  wide?: boolean;
  optional?: boolean;
}[] = [
  { key: 'recipient_name', label: 'ชื่อผู้รับ' },
  { key: 'recipient_phone', label: 'เบอร์โทรผู้รับ' },
  { key: 'address_line1', label: 'ที่อยู่ บรรทัดที่ 1', wide: true },
  { key: 'address_line2', label: 'ที่อยู่ บรรทัดที่ 2 (ไม่บังคับ)', wide: true, optional: true },
  { key: 'district', label: 'อำเภอ/เขต' },
  { key: 'province', label: 'จังหวัด' },
  { key: 'postal_code', label: 'รหัสไปรษณีย์' },
  { key: 'note', label: 'บันทึกการติดต่อลูกค้า (ไม่บังคับ)', wide: true, optional: true },
];

/**
 * TASK-0037: turns a pickup order whose second appointment was missed into a
 * delivery, and shows the shipping owed for it. Staff reach the customer
 * themselves; the system does not contact them.
 */
export default function DeliveryConversionCard({
  order,
  canEdit,
  cancellationHolds,
  onChanged,
}: {
  order: StoreOrderWithParcels;
  canEdit: boolean;
  cancellationHolds: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const pickup = order.pickup;
  const missedSecond =
    !!pickup?.secondAppointmentAt &&
    new Date(pickup.secondAppointmentAt).getTime() < Date.now() &&
    pickup.status !== 'picked_up';
  const convertible =
    canEdit &&
    !order.conversion &&
    order.fulfillmentMethod === 'pickup' &&
    order.status === 'paid' &&
    missedSecond &&
    !cancellationHolds;

  const payments = order.shippingPayments ?? [];
  if (!convertible && !order.conversion && order.shippingCharges.length === 0) {
    return null;
  }

  async function refundExcess(gatewayChargeId: string) {
    setPending(true);
    setError('');
    try {
      await storeFulfillmentModel.refundExcessShipping(gatewayChargeId);
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const requiredFilled = addressFields
    .filter((field) => !field.optional)
    .every((field) => form[field.key].trim() !== '');

  async function submit() {
    setPending(true);
    setError('');
    try {
      const { shippingFee } = await storeFulfillmentModel.convertToDelivery(
        order.storeOrderId,
        {
          ...form,
          address_line2: form.address_line2.trim() || undefined,
          note: form.note.trim() || undefined,
        },
      );
      setResult(
        shippingFee > 0
          ? `เปลี่ยนเป็นจัดส่งแล้ว ลูกค้าต้องชำระค่าจัดส่ง ${shippingFee.toFixed(2)} บาทก่อนส่ง`
          : 'เปลี่ยนเป็นจัดส่งแล้ว ส่งฟรีและสร้างพัสดุได้ทันที',
      );
      setOpen(false);
      setForm(emptyForm);
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 sm:p-6">
      {/* A delivery order from checkout reaches this card only through a
          returned parcel's charge, so it is titled for what it shows. */}
      <h2 className="font-medium">
        {order.conversion || convertible ? 'เปลี่ยนเป็นการจัดส่ง' : 'ค่าจัดส่งเพิ่มเติม'}
      </h2>

      {order.conversion ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          เปลี่ยนจากรับที่ร้านเมื่อ {formatThaiDate(order.conversion.convertedAt)}
          {order.conversion.note ? ` · ${order.conversion.note}` : ''}
        </p>
      ) : !convertible ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          พัสดุตีกลับต้องเรียกเก็บค่าจัดส่งก่อนส่งใหม่ทุกครั้ง
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          ลูกค้าพลาดนัดรับครั้งที่สอง ติดต่อลูกค้าแล้วกรอกชื่อ เบอร์โทร และที่อยู่
          เพื่อส่งสินค้าให้แทน ไม่มีการริบเงิน ยอดสินค้าต่ำกว่า 300 บาท
          ลูกค้าต้องชำระค่าจัดส่งก่อนจึงจะสร้างพัสดุได้
        </p>
      )}

      {result && (
        <p role="status" className="mt-3 text-sm text-green-700">
          {result}
        </p>
      )}

      {convertible && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          เปลี่ยนเป็นจัดส่ง
        </button>
      )}

      {convertible && open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2"
        >
          {addressFields.map((field) => (
            <label
              key={field.key}
              className={`grid gap-1 text-sm ${field.wide ? 'sm:col-span-2' : ''}`}
            >
              <span>{field.label}</span>
              <input
                required={!field.optional}
                value={form[field.key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className={inputClass}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending || !requiredFilled}
              className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? 'กำลังบันทึก...' : 'ยืนยันเปลี่ยนเป็นจัดส่ง'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 hover:bg-[var(--color-bg-tertiary)]"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {order.shippingCharges.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-medium">ค่าจัดส่งที่เรียกเก็บ</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {order.shippingCharges.map((charge) => (
              <li
                key={charge.shippingChargeId}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {chargeReasonLabels[charge.reason]} · {charge.amount} บาท ·
                  ออกเมื่อ {formatThaiDate(charge.issuedAt)}
                  {charge.paidAt
                    ? ` · ชำระเมื่อ ${formatThaiDate(charge.paidAt)}`
                    : ` · เก็บสินค้าถึง ${formatThaiDate(charge.holdUntil)}`}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${chargeStatusClassMap[charge.status]}`}
                >
                  {chargeStatusLabels[charge.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {payments.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-medium">การชำระค่าจัดส่ง</h3>
          <ul className="mt-2 grid gap-3 text-sm">
            {payments.map((payment) => (
              <li key={payment.gatewayChargeId} className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {payment.amount} บาท · {methodLabels[payment.paymentMethod]}
                    {payment.paidAt ? ` · ${formatThaiDate(payment.paidAt)}` : ''}
                    <span className="text-[var(--color-text-secondary)]">
                      {' '}
                      · {payment.gatewayChargeId}
                    </span>
                  </span>
                  {payment.excess && (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      รับเกิน
                    </span>
                  )}
                </div>
                {payment.excess && !payment.refund && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-amber-700">
                      ลูกค้าชำระค่าจัดส่งนี้เกินจากที่ต้องชำระ
                      {payment.paymentMethod === 'promptpay'
                        ? ' ต้องโอนคืนและบันทึกหลักฐานการโอน'
                        : ' คืนผ่านผู้ให้บริการได้ทันที'}
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void refundExcess(payment.gatewayChargeId)}
                        className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        คืนเงินส่วนเกิน
                      </button>
                    )}
                  </div>
                )}
                {payment.refund && (
                  <RefundPanel
                    title="การคืนค่าจัดส่ง"
                    refund={payment.refund}
                    account={null}
                    canEdit={canEdit}
                    onChanged={onChanged}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
