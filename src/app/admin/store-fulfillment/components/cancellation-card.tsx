'use client';
import { useState } from 'react';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  StoreCancellation,
  StoreCancellationStatus,
  StoreRefund,
  StoreRefundAccount,
  StoreRefundStatus,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';
import { STORE_CANCELLATION_STATUS_TONE } from '@/lib/status-tones';
import StatusBadge from '@/components/StatusBadge';

const storeFulfillmentModel = new StoreFulfillmentModel();

const statusLabels: Record<StoreCancellationStatus, string> = {
  pending: 'รอพิจารณา',
  approved: 'อนุมัติยกเลิก',
  rejected: 'ไม่อนุมัติ',
};

// A refund is only ever "คืนเงินแล้ว" when the gateway confirmed it; an
// approval by itself never reads as money returned (TASK-0018 R10).
const refundLabels: Record<StoreRefundStatus, string> = {
  pending: 'รอผลจากผู้ให้บริการ',
  processing: 'กำลังส่งคำขอคืนเงิน',
  confirmed: 'คืนเงินสำเร็จ',
  failed: 'คืนเงินไม่สำเร็จ',
};

// A transfer waits for a person, not the provider: the customer's account
// first, then staff to send it (owner, TASK-0350 Q3).
function refundStateLabel(refund: StoreRefund): string {
  if (refund.reversalPending) return 'คืนเงินสำเร็จ รอกลับรายการในระบบ';
  if (refund.refundChannel === 'manual_transfer' && refund.status !== 'confirmed') {
    return refund.accountRequired ? 'รอลูกค้าแจ้งบัญชี' : 'รอโอนคืน';
  }
  return refundLabels[refund.status];
}

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
  const shippingRefunds = cancellation.shippingRefunds ?? [];
  const account = cancellation.refundAccount ?? null;
  const decidable = canEdit && cancellation.status === 'pending';

  return (
    <section className="ka-sf-card ka-sf-card__pad">
      <div className="ka-sf-row ka-sf-row--wrap ka-sf-row--between">
        <h2>คำขอยกเลิกจากลูกค้า</h2>
        <StatusBadge tone={STORE_CANCELLATION_STATUS_TONE[cancellation.status]}>{statusLabels[cancellation.status]}</StatusBadge>
      </div>

      <dl className="ka-sf-dl">
        <div className="ka-sf-wide">
          <dt>เหตุผลของลูกค้า</dt>
          <dd>{cancellation.reason}</dd>
        </div>
        <div>
          <dt>ยื่นคำขอเมื่อ</dt>
          <dd>{formatThaiDate(cancellation.createdAt)}</dd>
        </div>
        <div>
          <dt>พิจารณาเมื่อ</dt>
          <dd>
            {cancellation.decidedAt
              ? formatThaiDate(cancellation.decidedAt)
              : '-'}
          </dd>
        </div>
        {cancellation.decisionNote && (
          <div className="ka-sf-wide">
            <dt>หมายเหตุการพิจารณา</dt>
            <dd>{cancellation.decisionNote}</dd>
          </div>
        )}
      </dl>

      {decidable && (
        <div className="ka-sf-form">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="หมายเหตุถึงลูกค้า (ไม่บังคับ)"
            className="ka-textarea"
          />
          <div className="ka-sf-row ka-sf-row--wrap">
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
              className="ka-btn ka-btn--danger"
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
              className="ka-btn"
            >
              ไม่อนุมัติและปลดการพักส่ง
            </button>
          </div>
        </div>
      )}

      {refund && (
        <RefundPanel
          title={
            shippingRefunds.length > 0
              ? // The order's own payment, which includes any shipping paid
                // at checkout - not goods alone.
                'การคืนเงินที่ชำระตอนสั่งซื้อ'
              : 'การคืนเงิน'
          }
          refund={refund}
          account={account}
          canEdit={canEdit}
          onChanged={onChanged}
        />
      )}
      {/* TASK-0037: shipping paid after the order is returned through its
          own charge, each followed on its own. */}
      {shippingRefunds.map((shippingRefund) => (
        <RefundPanel
          key={shippingRefund.refundId}
          title="การคืนค่าจัดส่งที่ชำระแยก"
          refund={shippingRefund}
          account={account}
          canEdit={canEdit}
          onChanged={onChanged}
        />
      ))}

      {error && (
        <p role="alert" className="ka-sf-error">
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * One refund: its state, and the action staff can take on it - retry through
 * the gateway, or record the transfer for money the gateway cannot return.
 * Since TASK-0037 an order can owe back more than one payment, each followed
 * here on its own.
 */
export function RefundPanel({
  title,
  refund,
  account,
  canEdit,
  onChanged,
}: {
  title: string;
  refund: StoreRefund;
  account: StoreRefundAccount | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
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

  // Whether another attempt is worth offering is the API's call, not this
  // screen's: it covers a confirmed refund whose reversal is still outstanding,
  // and it hides the button only while an attempt genuinely holds its lease -
  // an attempt that died leaves a lease that has aged out, and this is the
  // only place staff can pick that up.
  const retryable = canEdit && refund.retryAvailable === true;
  // The refund's own stated account first, then the request's.
  const transferAccount = refund.refundAccount ?? account;
  const attemptInFlight = refund.status === 'processing' && !retryable;

  return (
    <div className="ka-sf-panel">
      <p className="font-semibold">
        {title} ·{' '}
        {refundStateLabel(refund)}
      </p>
      <p>
        ยอดที่ขอคืน {refund.amount.toLocaleString('th-TH')} บาท
        {refund.confirmedAmount !== null &&
          ` · คืนสำเร็จ ${refund.confirmedAmount.toLocaleString('th-TH')} บาท`}
      </p>
      {refund.gatewayRefundId && (
        <p className="ka-sf-cap">
          อ้างอิงผู้ให้บริการ {refund.gatewayRefundId}
        </p>
      )}
      {refund.failureReason && (
        <p className="ka-sf-error">
          {refund.reversalPending
            ? `กลับรายการไม่สำเร็จ: ${refund.failureReason}`
            : `สาเหตุล่าสุด: ${refund.failureReason}`}
        </p>
      )}
      {refund.reversalPending && (
        <p className="ka-sf-warn">
          เงินคืนให้ลูกค้าแล้ว เหลือคืนสต็อกและปิดคำสั่งซื้อในระบบ
        </p>
      )}
      <p className="ka-sf-cap">
        พยายามแล้ว {refund.attempts} ครั้ง
      </p>
      {/* The account stays on screen after the transfer is recorded: it is
          where the money went, which is exactly what anyone checking the
          refund afterwards needs to see. Only the prompt and the form
          belong to the moment before it. */}
      {refund.refundChannel === 'manual_transfer' && (
        <div className="ka-sf-form" style={{ gap: 8 }}>
          {refund.manualRefundRequired && (
            <p className="ka-sf-warn">
              ยอดนี้ชำระด้วยพร้อมเพย์ ผู้ให้บริการคืนเงินให้ไม่ได้
              ต้องโอนคืนเข้าบัญชีลูกค้าแล้วบันทึกหลักฐานการโอนที่นี่
            </p>
          )}
          {refund.accountRequired && (
            <p className="ka-sf-warn">
              ลูกค้ายังไม่ได้แจ้งบัญชีรับเงินคืน ให้ลูกค้าแจ้งผ่านหน้าติดตามคำสั่งซื้อ
              แล้วจึงโอนและบันทึกหลักฐาน
            </p>
          )}
          {transferAccount && (
            <dl className="ka-sf-dl rounded-lg bg-[var(--bg-surface)] p-3">
              <div>
                <dt>ชื่อบัญชี</dt>
                <dd>{transferAccount.name ?? '-'}</dd>
              </div>
              <div>
                <dt>ธนาคาร</dt>
                <dd>{transferAccount.bank ?? '-'}</dd>
              </div>
              <div>
                <dt>เลขที่บัญชี</dt>
                <dd className="font-medium">{transferAccount.number ?? '-'}</dd>
              </div>
            </dl>
          )}
          {refund.manualRefundRequired && !refund.accountRequired && canEdit && (
            <>
              <input
                value={transfer.reference}
                onChange={(e) =>
                  setTransfer({ ...transfer, reference: e.target.value })
                }
                maxLength={120}
                placeholder="เลขอ้างอิงการโอน"
                className="ka-input"
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
                className="ka-input"
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
                className="ka-btn ka-btn--primary"
              >
                บันทึกว่าโอนคืนแล้ว
              </button>
            </>
          )}
        </div>
      )}

      {refund.manualReference && (
        <p className="ka-sf-cap">
          โอนคืนแล้ว อ้างอิง {refund.manualReference}
          {refund.manualTransferredAt
            ? ` · ${formatThaiDate(refund.manualTransferredAt)}`
            : ''}
        </p>
      )}

      {attemptInFlight && (
        <p className="ka-sf-cap">
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
          className="ka-btn ka-btn--primary self-start"
        >
          {refund.reversalPending
            ? 'ทำการกลับรายการต่อ'
            : 'ลองคืนเงินอีกครั้ง'}
        </button>
      )}
      {error && (
        <p role="alert" className="ka-sf-error">
          {error}
        </p>
      )}
    </div>
  );
}
