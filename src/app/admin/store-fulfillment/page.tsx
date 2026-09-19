'use client';

import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import { StoreOrderWithParcels } from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import CreateParcelModal from './components/create-parcel-modal';
import ParcelCard from './components/parcel-card';
import PickupCard from './components/pickup-card';
import CancellationCard from './components/cancellation-card';

const storeFulfillmentModel = new StoreFulfillmentModel();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const statusLabels: Record<string, string> = {
  awaiting_payment: 'รอชำระเงิน',
  paid: 'ชำระเงินแล้ว',
  expired: 'หมดเวลา',
  awaiting_review: 'กำลังตรวจสอบ',
  cancelled: 'ยกเลิกแล้ว',
};

export default function StoreFulfillmentPage() {
  const { can } = usePermissions();
  const canView = can('store_fulfillment', 'view');
  const canAdd = can('store_fulfillment', 'add');
  const canEdit = can('store_fulfillment', 'edit');

  const [storeOrderIdInput, setStoreOrderIdInput] = useState('');
  const [order, setOrder] = useState<StoreOrderWithParcels | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateParcel, setShowCreateParcel] = useState(false);

  async function search(id?: string) {
    const targetId = (id ?? storeOrderIdInput).trim();
    if (!uuidPattern.test(targetId)) {
      setError('รูปแบบเลขคำสั่งซื้อไม่ถูกต้อง');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setOrder(await storeFulfillmentModel.getOrder(targetId));
    } catch (err) {
      setOrder(null);
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return (
      <div className="min-h-full bg-[#F5F7FA] p-4 dark:bg-slate-950 sm:p-6">
        <p className="text-[var(--color-text-secondary)]">
          คุณไม่มีสิทธิ์เข้าถึงการจัดส่งพัสดุ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    );
  }

  const hasRemaining = order?.items.some((line) => line.remainingUnshipped > 0);
  // A pending or approved cancellation holds fulfillment, so the API would
  // refuse a new parcel anyway; the button is hidden rather than left to fail.
  const cancellationHolds =
    order?.cancellation?.status === 'pending' ||
    order?.cancellation?.status === 'approved';
  const canCreateParcel =
    canAdd &&
    order?.status === 'paid' &&
    order.fulfillmentMethod === 'delivery' &&
    !cancellationHolds;

  return (
    <div className="min-h-full bg-[#F5F7FA] p-2 dark:bg-slate-950 sm:p-4 md:p-6 lg:p-8">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 sm:rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:p-4 md:p-6">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            จัดส่งพัสดุ
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
            className="flex gap-2"
          >
            <input
              value={storeOrderIdInput}
              onChange={(e) => setStoreOrderIdInput(e.target.value)}
              placeholder="เลขคำสั่งซื้อ (store order id)"
              className="min-h-11 w-80 rounded-lg border border-[var(--color-border)] px-3 py-2"
            />
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
            </button>
          </form>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[var(--color-error)]">
          {error}
        </p>
      )}

      {order && (
        <div className="mt-4 grid gap-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  คำสั่งซื้อ #{order.storeOrderId}
                </p>
                <p className="font-medium">
                  {order.fulfillmentMethod === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'} ·{' '}
                  {statusLabels[order.status] ?? order.status}
                </p>
              </div>
              {canCreateParcel && (
                <button
                  type="button"
                  onClick={() => setShowCreateParcel(true)}
                  disabled={!hasRemaining}
                  className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  บันทึกพัสดุใหม่
                </button>
              )}
            </div>

            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th className="py-2">สินค้า</th>
                  <th className="py-2 text-right">ซื้อ</th>
                  <th className="py-2 text-right">ส่งแล้ว</th>
                  <th className="py-2 text-right">คงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((line) => (
                  <tr key={line.saleOrderListId} className="border-b border-gray-50 dark:border-gray-700">
                    <td className="py-2">{line.productName}</td>
                    <td className="py-2 text-right">{line.purchasedQty}</td>
                    <td className="py-2 text-right">{line.shippedQty}</td>
                    <td className="py-2 text-right">{line.remainingUnshipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {order.cancellation && (
            <CancellationCard
              cancellation={order.cancellation}
              canEdit={canEdit}
              onChanged={() => void search(order.storeOrderId)}
            />
          )}

          {order.fulfillmentMethod === 'pickup' && order.pickup && (
            <PickupCard
              storeOrderId={order.storeOrderId}
              pickup={order.pickup}
              orderPaid={order.status === 'paid'}
              canEdit={canEdit}
              onChanged={() => void search(order.storeOrderId)}
            />
          )}

          <div className="grid gap-3">
            {order.fulfillmentMethod === 'delivery' && order.parcels.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                ยังไม่มีพัสดุสำหรับคำสั่งซื้อนี้
              </p>
            )}
            {order.parcels.map((parcel) => (
              <ParcelCard
                key={parcel.parcelId}
                parcel={parcel}
                canEdit={canEdit}
                onChanged={() => void search(order.storeOrderId)}
              />
            ))}
          </div>
        </div>
      )}

      {order && showCreateParcel && (
        <CreateParcelModal
          isOpen={showCreateParcel}
          onClose={() => setShowCreateParcel(false)}
          onSuccess={() => void search(order.storeOrderId)}
          storeOrderId={order.storeOrderId}
          lines={order.items}
          defaultAddress={order.defaultAddress}
        />
      )}
    </div>
  );
}
