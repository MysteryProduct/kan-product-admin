'use client';
import { useState } from 'react';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  StoreCancellation,
  StoreCancellationStatus,
  StoreRefundStatus,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';

const storeFulfillmentModel = new StoreFulfillmentModel();

const statusLabels: Record<StoreCancellationStatus, string> = {
  pending: 'รอพิจารณา',
  approved: 'อนุมัติยกเลิก',
  rejected: 'ไม่อนุมัติ',
};
const statusClassMap: Record<StoreCancellationStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-gray-100 text-gray-700',
};

// A refund is only ever "คืนเงินแล้ว" when the gateway confirmed it; an
// approval by itself never reads as money returned (TASK-0018 R10).
const refundLabels: Record<StoreRefundStatus, string> = {
  pending: 'รอผลจากผู้ให้บริการ',
  processing: 'กำลังส่งคำขอคืนเงิน',
  confirmed: 'คืนเงินสำเร็จ',
  failed: 'คืนเงินไม่สำเร็จ',
};

/**
 * The employee side of R10: decide a cancellation request, and follow the
 * refund that an approval starts.
 *
 * Fulfillment is held while a request is pending, so this is also what
 * unblocks an order - either by rejecting the request or by carrying the
 * cancellation through to a confirmed refund.
 */
export default function CancellationCard({
  cancellation,
  canEdit,
  onChanged,
}: {
  cancellation: StoreCancellation;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  // No amount here: the refund is the whole outstanding figure or it is not
  // recordable at all (R10 returns the full payment and does not deduct a
  // transfer fee), so the only thing a free-text field could add is a typo.
  const [transfer, setTransfer] = useState({
    reference: '',
    transferred_at: '',
  });

  async function run(action: () => Promise<unknown>) {
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

  const refund = cancellation.refund;
  const account = cancellation.refundAccount ?? null;
  const decidable = canEdit && cancellation.status === 'pending';
  // Whether another attempt is worth offering is the API's call, not this
  // screen's: it covers a confirmed refund whose reversal is still outstanding,
  // and it hides the button only while an attempt genuinely holds its lease -
  // an attempt that died leaves a lease that has aged out, and this is the
  // only place staff can pick that up.
  const retryable = canEdit && refund !== null && refund.retryAvailable === true;
  const attemptInFlight = refund?.status === 'processing' && !retryable;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">คำขอยกเลิกจากลูกค้า</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm ${statusClassMap[cancellation.status]}`}
        >
          {statusLabels[cancellation.status]}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[var(--color-text-secondary)]">เหตุผลของลูกค้า</dt>
          <dd>{cancellation.reason}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">ยื่นคำขอเมื่อ</dt>
          <dd>{formatThaiDate(cancellation.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">พิจารณาเมื่อ</dt>
          <dd>
            {cancellation.decidedAt
              ? formatThaiDate(cancellation.decidedAt)
              : '-'}
          </dd>
        </div>
        {cancellation.decisionNote && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--color-text-secondary)]">หมายเหตุการพิจารณา</dt>
            <dd>{cancellation.decisionNote}</dd>
          </div>
        )}
      </dl>

      {cancellation.status === 'pending' && (
        <p className="mt-3 text-sm text-amber-700">
          ระหว่างรอพิจารณา ระบบพักการบันทึกพัสดุ การจัดส่ง และการส่งมอบไว้ก่อน
        </p>
      )}

      {decidable && (
        <div className="mt-4 grid gap-2 sm:max-w-xl">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="หมายเหตุถึงลูกค้า (ไม่บังคับ)"
            className="rounded-lg border border-[var(--color-border)] px-3 py-2"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run(() =>
                  storeFulfillmentModel.decideCancellation(
                    cancellation.requestId,
                    { decision: 'approve', note: note || undefined },
                  ),
                )
              }
              className="min-h-11 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              อนุมัติยกเลิกและคืนเงินเต็มจำนวน
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run(() =>
                  storeFulfillmentModel.decideCancellation(
                    cancellation.requestId,
                    { decision: 'reject', note: note || undefined },
                  ),
                )
              }
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60"
            >
              ไม่อนุมัติและปลดการพักส่ง
            </button>
          </div>
        </div>
      )}

      {refund && (
        <div className="mt-4 rounded-lg bg-[#F5F7FA] p-3 text-sm dark:bg-slate-900">
          <p className="font-medium">
            การคืนเงิน ·{' '}
            {refund.reversalPending
              ? 'คืนเงินสำเร็จ รอกลับรายการในระบบ'
              : refundLabels[refund.status]}
          </p>
          <p>
            ยอดที่ขอคืน {refund.amount.toLocaleString('th-TH')} บาท
            {refund.confirmedAmount !== null &&
              ` · คืนสำเร็จ ${refund.confirmedAmount.toLocaleString('th-TH')} บาท`}
          </p>
          {refund.gatewayRefundId && (
            <p className="text-[var(--color-text-secondary)]">
              อ้างอิงผู้ให้บริการ {refund.gatewayRefundId}
            </p>
          )}
          {refund.failureReason && (
            <p className="text-[var(--color-error)]">
              {refund.reversalPending
                ? `กลับรายการไม่สำเร็จ: ${refund.failureReason}`
                : `สาเหตุล่าสุด: ${refund.failureReason}`}
            </p>
          )}
          {refund.reversalPending && (
            <p className="text-amber-700">
              เงินคืนให้ลูกค้าแล้ว เหลือคืนสต็อกและปิดคำสั่งซื้อในระบบ
            </p>
          )}
          <p className="text-[var(--color-text-secondary)]">
            พยายามแล้ว {refund.attempts} ครั้ง
          </p>
          {refund.manualRefundRequired && (
            <div className="mt-3 grid gap-2 sm:max-w-xl">
              <p className="text-amber-700">
                คำสั่งซื้อนี้ชำระด้วยพร้อมเพย์ ผู้ให้บริการคืนเงินให้ไม่ได้
                ต้องโอนคืนเข้าบัญชีลูกค้าแล้วบันทึกหลักฐานการโอนที่นี่
              </p>
              {account && (
                <dl className="grid gap-1 rounded-lg bg-white p-3 dark:bg-slate-800">
                  <div className="flex gap-2">
                    <dt className="text-[var(--color-text-secondary)]">ชื่อบัญชี</dt>
                    <dd>{account.name ?? '-'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-[var(--color-text-secondary)]">ธนาคาร</dt>
                    <dd>{account.bank ?? '-'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-[var(--color-text-secondary)]">เลขที่บัญชี</dt>
                    <dd className="font-medium">{account.number ?? '-'}</dd>
                  </div>
                </dl>
              )}
              {canEdit && (
                <>
                  <input
                    value={transfer.reference}
                    onChange={(e) =>
                      setTransfer({ ...transfer, reference: e.target.value })
                    }
                    maxLength={120}
                    placeholder="เลขอ้างอิงการโอน"
                    className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2"
                  />
                  <p>
                    ยอดที่ต้องโอนคืน{' '}
                    <span className="font-medium">
                      {refund.amount.toLocaleString('th-TH')} บาท
                    </span>{' '}
                    เต็มจำนวน ไม่หักค่าธรรมเนียม
                  </p>
                  <input
                    type="date"
                    value={transfer.transferred_at}
                    onChange={(e) =>
                      setTransfer({ ...transfer, transferred_at: e.target.value })
                    }
                    className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2"
                  />
                  <button
                    type="button"
                    disabled={
                      pending ||
                      !transfer.reference.trim() ||
                      !transfer.transferred_at
                    }
                    onClick={() =>
                      void run(() =>
                        storeFulfillmentModel.recordManualRefund(
                          refund.refundId,
                          {
                            reference: transfer.reference.trim(),
                            // The API re-derives this from the receipts and
                            // refuses anything else, so a stale figure is
                            // refused with the real one rather than recorded.
                            amount: refund.amount,
                            transferred_at: new Date(
                              transfer.transferred_at,
                            ).toISOString(),
                          },
                        ),
                      )
                    }
                    className="min-h-11 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    บันทึกว่าโอนคืนแล้ว
                  </button>
                </>
              )}
            </div>
          )}

          {refund.manualReference && (
            <p className="text-[var(--color-text-secondary)]">
              โอนคืนแล้ว อ้างอิง {refund.manualReference}
              {refund.manualTransferredAt
                ? ` · ${formatThaiDate(refund.manualTransferredAt)}`
                : ''}
            </p>
          )}

          {attemptInFlight && (
            <p className="text-[var(--color-text-secondary)]">
              กำลังดำเนินการอยู่ ลองใหม่ได้อีกครั้งหากยังไม่มีผลภายในสองนาที
            </p>
          )}
          {retryable && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run(() => storeFulfillmentModel.retryRefund(refund.refundId))
              }
              className="mt-2 min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {refund.reversalPending
                ? 'ทำการกลับรายการต่อ'
                : 'ลองคืนเงินอีกครั้ง'}
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
