import { formatThaiDate } from '@/lib/date-format';
import {
  STORE_ORDER_STATUS_LABELS,
  STORE_PICKUP_STATUS_LABELS,
} from '@/lib/store-order-list';
import type { StoreOrderListStatus, StoreOrderWithParcels } from '@/types/store-fulfillment';

export type StoreOrderStepState = 'done' | 'now' | 'warn' | 'idle';

export interface StoreOrderStep {
  label: string;
  sub: string;
  state: StoreOrderStepState;
}

const idle = (label: string, sub = '-'): StoreOrderStep => ({ label, sub, state: 'idle' });

/**
 * TASK-0350: where an order stands, in three steps read only from what the order already says.
 * A parcel counts as sent once it is `shipped`, not when it is recorded, so the last step can
 * still be open while the table's `shippedQty` reads as all sent.
 */
export function storeOrderSteps(order: StoreOrderWithParcels): StoreOrderStep[] {
  const isPickup = order.fulfillmentMethod === 'pickup';
  const statusLabel =
    STORE_ORDER_STATUS_LABELS[order.status as StoreOrderListStatus] ?? order.status;
  const payment: StoreOrderStep = {
    label: 'ชำระเงิน',
    sub: statusLabel,
    state: order.status === 'paid' ? 'done' : order.status === 'awaiting_payment' ? 'now' : 'warn',
  };

  if (order.status !== 'paid') {
    return isPickup
      ? [payment, idle('แจ้งพร้อมรับ'), idle('ส่งมอบสินค้า')]
      : [payment, idle('บันทึกพัสดุ'), idle('จัดส่งครบ')];
  }

  const cancellation = order.cancellation;
  if (cancellation?.status === 'pending') {
    return [
      payment,
      { label: 'คำขอยกเลิก', sub: 'รอพิจารณา', state: 'warn' },
      idle('ผลการพิจารณา', 'ยังไม่ตัดสินใจ'),
    ];
  }
  if (cancellation?.status === 'approved') {
    return [
      payment,
      { label: 'คำขอยกเลิก', sub: formatThaiDate(cancellation.createdAt), state: 'done' },
      { label: 'ผลการพิจารณา', sub: 'อนุมัติยกเลิก', state: 'now' },
    ];
  }

  if (isPickup) {
    const pickup = order.pickup;
    if (!pickup || pickup.status === 'awaiting_ready') {
      return [
        payment,
        { label: 'แจ้งพร้อมรับ', sub: STORE_PICKUP_STATUS_LABELS.awaiting_ready, state: 'now' },
        idle('ส่งมอบสินค้า'),
      ];
    }
    const label = STORE_PICKUP_STATUS_LABELS[pickup.status];
    const late = pickup.status === 'overdue' || pickup.status === 'pending_review';
    return [
      payment,
      {
        label: 'แจ้งพร้อมรับ',
        sub: pickup.readyAt ? formatThaiDate(pickup.readyAt) : label,
        state: 'done',
      },
      pickup.status === 'picked_up'
        ? {
            label: 'ส่งมอบสินค้า',
            sub: pickup.pickedUpAt ? formatThaiDate(pickup.pickedUpAt) : label,
            state: 'done',
          }
        : { label: 'ส่งมอบสินค้า', sub: label, state: late ? 'warn' : 'now' },
    ];
  }

  const live = order.parcels.filter(
    (parcel) => parcel.status !== 'voided' && parcel.status !== 'returned',
  );
  const purchased = order.items.reduce((sum, line) => sum + line.purchasedQty, 0);
  const sent = live
    .filter((parcel) => parcel.status === 'shipped')
    .reduce(
      (sum, parcel) => sum + parcel.items.reduce((count, item) => count + item.quantity, 0),
      0,
    );
  const complete =
    order.items.every((line) => line.remainingUnshipped === 0) &&
    live.length > 0 &&
    live.every((parcel) => parcel.status === 'shipped');
  return [
    payment,
    live.length > 0
      ? { label: 'บันทึกพัสดุ', sub: `${live.length} พัสดุ`, state: 'done' }
      : { label: 'บันทึกพัสดุ', sub: 'ยังไม่มีพัสดุ', state: 'now' },
    {
      label: 'จัดส่งครบ',
      sub: `จัดส่งแล้ว ${sent} จาก ${purchased} ชิ้น`,
      state: complete ? 'done' : live.length > 0 ? 'now' : 'idle',
    },
  ];
}
