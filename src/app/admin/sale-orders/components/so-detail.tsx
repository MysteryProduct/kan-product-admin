'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import PaymentReceiptModel from '@/models/payment-receipt';
import type { PaymentReceipt } from '@/types/payment-receipt';
import type { SaleOrder } from '@/types/sale-order';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageCrumb } from '@/lib/page-crumb';
import { formatThaiDate } from '@/lib/date-format';
import DocumentCode from '@/components/DocumentCode';
import RowMenu, { RowMenuItem } from '@/components/RowMenu';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import DocumentHistoryPanel, { DocumentHistoryEntry } from '@/components/document-history/DocumentHistoryPanel';
import { loadErrorText } from '@/components/LoadErrorBanner';
import { VAT_TYPE_LABELS, type VatType } from '@/lib/vat';
import { useOrderActions } from '../hooks/useOrderActions';
import {
  allows,
  beforeVat,
  formatBaht,
  formatMoney,
  lineTotal,
  orderLines,
  paymentState,
  payable,
  statusLabel,
  statusTone,
  typeLabel,
  variantText,
  vatAmount,
} from '../lib/so-display';
import CustomPayment from './custom-payment';
import ReturnDialog from './return-dialog';

const paymentReceiptModel = new PaymentReceiptModel();
const BASE = '/admin/sale-orders';

interface Props {
  saleOrder: SaleOrder;
  /** Reloads the order after an action. */
  onChanged: () => void;
  /** Opens the return dialog on arrival (the list's "คืนสินค้า" links here). */
  openReturn?: boolean;
}

type StepState = 'done' | 'current' | 'todo';

function vatTypeText(order: SaleOrder): string {
  const rate = Number(order.vat_rate) || 0;
  if (order.vat_type === 'include') return `ราคารวม VAT ${rate}%`;
  if (order.vat_type === 'exclude') return `ราคาไม่รวม VAT · แยก ${rate}%`;
  return VAT_TYPE_LABELS[(order.vat_type ?? 'none') as VatType];
}

const PRINT_ICON = 'M7 9V3h10v6M7 17H5v-6h14v6h-2M7 14h10v7H7z';

export default function SaleOrderDetail({ saleOrder: order, onChanged, openReturn = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { can } = usePermissions();
  const canApprove = can('sale_orders', 'approve');
  const canEdit = can('sale_orders', 'edit');
  const canDelete = can('sale_orders', 'delete');
  const canReject = can('sale_orders', 'reject');
  const canReceive = can('payment_receipts', 'add');
  const canReadReceipts = can('payment_receipts', 'view');

  const id = order.sale_order_id;
  const code = order.sale_order_code ?? order.sale_order_name;
  const status = order.sale_order_status;
  usePageCrumb({ back: { label: 'ใบสั่งขาย', href: BASE }, current: code });

  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [historyKey, setHistoryKey] = useState(0);
  const [receipts, setReceipts] = useState<PaymentReceipt[] | null>(null);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [returning, setReturning] = useState(openReturn && canEdit && allows.return(order));

  const changed = useCallback(() => {
    setHistoryKey((key) => key + 1);
    onChanged();
  }, [onChanged]);

  const actions = useOrderActions({
    onChanged: changed,
    onDeleted: () => router.push(BASE),
  });

  // Receipts, newest first, refunds included. Only an employee who may read receipts asks for them.
  useEffect(() => {
    if (!canReadReceipts) return;
    let active = true;
    paymentReceiptModel
      .getPaymentReceiptsBySaleOrder(id)
      .then((response) => {
        if (!active) return;
        setReceipts(response.data ?? []);
        setReceiptsError(null);
      })
      .catch((error: unknown) => {
        if (active) setReceiptsError(loadErrorText('ใบเสร็จรับเงิน', error));
      });
    return () => {
      active = false;
    };
  }, [id, canReadReceipts, status, historyKey]);

  // Print on paper colours: the dark theme is lifted while the browser prints (button or Ctrl+P).
  useEffect(() => {
    const html = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = html.classList.contains('dark');
      if (wasDark) html.classList.remove('dark');
    };
    const after = () => {
      if (wasDark) html.classList.add('dark');
      wasDark = false;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const lines = orderLines(order);
  const linesSum = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const shipping = Number(order.sale_order_shipping_fee) || 0;
  const received = receipts ? Math.round(receipts.reduce((sum, receipt) => sum + Number(receipt.amount_paid), 0) * 100) / 100 : undefined;
  const pay = paymentState(order, received);
  const refunded = receipts ? Math.abs(receipts.filter((receipt) => Number(receipt.amount_paid) < 0).reduce((sum, receipt) => sum + Number(receipt.amount_paid), 0)) : null;
  const returnedQty = lines.reduce((sum, line) => sum + Number(line.returned_qty ?? 0), 0);
  const soldQty = lines.reduce((sum, line) => sum + Number(line.sale_order_list_qty), 0);

  const approvedAt = history.find((entry) => entry.action === 'approved')?.created_at;
  const createdEntry = [...history].reverse().find((entry) => entry.action === 'created');
  const cancelEntry = history.find((entry) => entry.action === 'cancelled' || entry.action === 'rejected');
  const receiptCount = receipts?.filter((receipt) => Number(receipt.amount_paid) > 0).length;

  const steps: { label: string; state: StepState; note?: string }[] = (() => {
    const done = status === 'pending' ? 0 : status === 'approved' || status === 'partial' ? 2 : 4;
    const notes = [
      order.create_date ? formatThaiDate(order.create_date) : undefined,
      approvedAt ? formatThaiDate(approvedAt) : undefined,
      status === 'partial' || (status === 'approved' && received && received > 0)
        ? `รับแล้ว ${pay.percent}%${receiptCount ? ` · ${receiptCount} ครั้ง` : ''}`
        : undefined,
      undefined,
    ];
    const labels = ['สร้างและจองสินค้า', 'อนุมัติ ตัดสต็อก', 'รับชำระ', 'ชำระครบ'];
    return labels.map((label, index) => ({
      label,
      state: index < done ? 'done' : index === done ? 'current' : 'todo',
      note: index <= done ? notes[index] : undefined,
    }));
  })();

  const isCustom = order.sale_order_type === 'custom';
  // The custom payment block loads its own data, so only the copy the layout shows is mounted.
  const wide = useMediaQuery('(min-width: 1024px)');
  const primary: { label: string; busy?: string; onClick: () => void } | null =
    canApprove && allows.approve(order)
      ? { label: 'อนุมัติ', busy: 'กำลังอนุมัติ…', onClick: () => actions.request('approve', order) }
      : canReceive && !isCustom && allows.pay(order)
        ? { label: 'รับชำระ', onClick: () => actions.request('pay', order) }
        : null;

  const editHref = canEdit && allows.edit(order) ? `${BASE}/${id}/edit` : null;
  const canReturn = canEdit && allows.return(order);
  const print = () => window.print();

  const moreItems: RowMenuItem[] = [];
  if (canReject && allows.cancel(order)) moreItems.push({ label: 'ยกเลิกเอกสาร', icon: 'cancel', tone: 'danger', onSelect: () => actions.request('cancel', order) });
  if (canDelete && allows.remove(order)) moreItems.push({ label: 'ลบ', icon: 'delete', tone: 'danger', onSelect: () => actions.request('delete', order) });
  const moreWithPrint: RowMenuItem[] = [{ label: 'พิมพ์', icon: 'view', onSelect: print }, ...moreItems];

  const closeReturn = () => {
    setReturning(false);
    if (openReturn) router.replace(pathname ?? `${BASE}/${id}`, { scroll: false });
  };

  const createdText = useMemo(() => {
    const date = order.create_date ? formatThaiDate(order.create_date) : '';
    // A system or deleted actor has no name, only an id: say nothing rather than show it.
    const actor = createdEntry?.actor_name;
    const by = actor && !/^[0-9a-f-]{32,}$/i.test(actor) ? ` โดย ${actor}` : '';
    const updated = order.update_date && order.update_date !== order.create_date ? ` · แก้ไขล่าสุด ${formatThaiDate(order.update_date)}` : '';
    return `สร้าง ${date}${by}${updated}`;
  }, [order.create_date, order.update_date, createdEntry]);

  const dueLabel = status === 'cancelled' ? 'ใบนี้ถูกยกเลิก' : status === 'pending' ? 'ยอดที่ต้องชำระ' : pay.due > 0 ? 'ยอดค้างรับ' : 'รับชำระครบแล้ว';
  const dueValue = status === 'cancelled' || status === 'pending' ? payable(order) : pay.due;

  const TILE_TONES = ['brand', 'info', 'warning', 'success'];
  const initials = (name: string) => Array.from(name.replace(/\s+/g, '')).slice(0, 2).join('');

  const dueCard = (extra: string) =>
    isCustom ? null : (
      <section className={`ka-so-due ${extra}`} aria-label={dueLabel}>
        <p className="ka-so-due__k">{dueLabel}</p>
        <p className="ka-so-due__v">{formatBaht(dueValue)}</p>
        {received !== undefined && status !== 'pending' && status !== 'cancelled' ? (
          <>
            <div className="ka-so-due__bar" data-tone={pay.tone} role="progressbar" aria-label="รับชำระแล้ว" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pay.percent}>
              <i style={{ width: `${pay.percent}%` }} />
            </div>
            <p className="ka-so-due__row">
              <span>รับแล้ว <strong>{formatBaht(pay.paid)}</strong> ({pay.percent}%)</span>
              <span>จาก {formatBaht(pay.total)}{pay.tone === 'refund' ? ' หลังคืนสินค้า' : ''}</span>
            </p>
          </>
        ) : (
          <p className="ka-so-due__row">
            {status === 'pending'
              ? 'ยังไม่เปิดรับชำระ ต้องอนุมัติใบสั่งขายก่อน'
              : status === 'cancelled'
                ? 'ใบนี้ยกเลิกก่อนอนุมัติ ไม่มีการรับชำระ'
                : 'ยอดรับชำระดูได้เฉพาะผู้มีสิทธิ์ดูใบเสร็จรับเงิน'}
          </p>
        )}
      </section>
    );

  const stepText = (step: (typeof steps)[number]) => (
    <>
      <span className="ka-so-st__t">{step.label}</span>
      <span className="sr-only">{step.state === 'done' ? ' (เสร็จแล้ว)' : step.state === 'current' ? ' (ขั้นปัจจุบัน)' : ''}</span>
    </>
  );

  return (
    <div className="ka-page-body ka-so ka-so-print">
      <div className="ka-so-dh">
        <div className="ka-so-dh__main">
          <div className="ka-so-dh__id">
            <span className="ka-so-dh__code"><DocumentCode code={order.sale_order_code} legacyCode={order.legacy_code} /></span>
            <StatusBadge tone={statusTone(status)}>{statusLabel(status)}</StatusBadge>
            <span className="ka-so-tag">{typeLabel(order.sale_order_type)}</span>
          </div>
          <h1 className="ka-so-dh__name">{order.sale_order_name}</h1>
          <p className="ka-so-cap">{createdText}</p>
        </div>
        <div className="ka-so-dh__acts ka-so-noprint">
          <button type="button" className="ka-btn ka-btn--ghost ka-so-dh__print" onClick={print}>
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={PRINT_ICON} />
            </svg>
            <span className="ka-so-dh__print-label">พิมพ์</span>
          </button>
          {editHref && <Link href={editHref} className="ka-btn">แก้ไข</Link>}
          {canReturn && (
            <button type="button" className="ka-btn" onClick={() => setReturning(true)}>
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
              คืนสินค้า
            </button>
          )}
          {moreItems.length > 0 && (
            <RowMenu label={`ตัวเลือกเพิ่มเติมของ ${code}`} items={moreItems} triggerClassName="ka-btn ka-btn--icon ka-so-more" />
          )}
          {primary && (
            <button
              type="button"
              className="ka-btn ka-btn--primary"
              onClick={primary.onClick}
              disabled={actions.busy !== null}
              aria-busy={(primary.busy && actions.busy === 'approve') || undefined}
            >
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={primary.label === 'อนุมัติ' ? 'm4.5 12.75 6 6 9-13.5' : 'M12 4.5v15m7.5-7.5h-15'} />
              </svg>
              {primary.busy && actions.busy === 'approve' ? primary.busy : primary.label}
            </button>
          )}
        </div>
      </div>

      {status === 'cancelled' && (
        <div className="ka-banner ka-banner--danger ka-so-cancelled" role="note">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM6 6l12 12" />
          </svg>
          <span>
            <strong>ใบสั่งขายนี้ถูกยกเลิก</strong>
            {cancelEntry?.reason && <span className="ka-so-cancelled__why">เหตุผล: {cancelEntry.reason}</span>}
            {cancelEntry && (
              <span className="ka-so-cancelled__why">
                {cancelEntry.actor_name ? `${cancelEntry.actor_name} · ` : ''}
                {formatThaiDate(cancelEntry.created_at)}
              </span>
            )}
          </span>
        </div>
      )}

      {(status === 'partially_returned' || status === 'returned') && (
        <div className="ka-banner ka-banner--info" role="note">
          <span>
            <strong>{status === 'returned' ? 'คืนสินค้าทั้งหมดแล้ว' : 'คืนสินค้าบางส่วนแล้ว'}</strong>{' '}
            คืน {returnedQty.toLocaleString('th-TH')} จาก {soldQty.toLocaleString('th-TH')} ชิ้น
            {refunded !== null && refunded > 0 && <> · คืนเงิน {formatBaht(refunded)}</>}
          </span>
        </div>
      )}

      {status !== 'cancelled' && (
        <ol className="ka-so-card ka-so-steps ka-so-steps--wide" aria-label="ขั้นตอนใบสั่งขาย">
          {steps.map((step, index) => (
            <li key={step.label} className="ka-so-st" data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
              <span className="ka-so-st__track">
                <i className="ka-so-st__dot" aria-hidden="true">{step.state === 'done' ? '✓' : index + 1}</i>
                <span className="ka-so-st__line" aria-hidden="true" />
              </span>
              <span className="ka-so-st__text">
                {stepText(step)}
                {step.note && <span className="ka-so-st__n">{step.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="ka-so-top">
        {dueCard('')}
        {isCustom && !wide && (
          <section className="ka-so-card ka-so-side ka-so-noprint" aria-label="การรับชำระงานผลิต Custom">
            <CustomPayment orderId={id} status={status} onSuccess={changed} />
          </section>
        )}
        {status !== 'cancelled' && (
          <ol className="ka-so-card ka-so-vsteps" aria-label="ขั้นตอนใบสั่งขาย">
            {steps.map((step, index) => (
              <li key={step.label} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
                <i className="ka-so-st__dot" aria-hidden="true">{step.state === 'done' ? '✓' : index + 1}</i>
                {stepText(step)}
                {step.note && <span className="ka-so-st__n">{step.note}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="ka-so-grid">
        <div className="ka-so-stack">
          <section className="ka-so-card ka-so-clip" aria-labelledby="so-items">
            <div className="ka-so-chd">
              <h2 id="so-items" className="ka-so-h2">รายการสินค้า</h2>
              <span className="ka-so-count ka-so-nowrap">{lines.length} รายการ · {soldQty.toLocaleString('th-TH')} ชิ้น</span>
              {status !== 'pending' && status !== 'cancelled' && !isCustom && (
                <span className="ka-so-cap ka-so-ok ka-so-chd__end">ตัดสต็อกแล้ว{approvedAt ? ` ${formatThaiDate(approvedAt)}` : ''}</span>
              )}
            </div>
            {lines.length === 0 ? (
              <p className="ka-so-cp ka-so-cap">ไม่มีรายการสินค้า</p>
            ) : (
              <div className="ka-so-tw">
                <table className="ka-so-it">
                  <caption className="sr-only">รายการสินค้าใน {code}</caption>
                  <thead>
                    <tr>
                      <th scope="col">สินค้า</th>
                      <th scope="col" className="ka-so-r">จำนวน</th>
                      <th scope="col" className="ka-so-r ka-so-it__ret-col">คืนแล้ว</th>
                      <th scope="col" className="ka-so-r">ราคา/หน่วย</th>
                      <th scope="col" className="ka-so-r">รวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const variant = variantText(line);
                      const returned = Number(line.returned_qty ?? 0);
                      const qty = Number(line.sale_order_list_qty).toLocaleString('th-TH');
                      return (
                        <tr key={line.sale_order_list_id ?? `${line.product_name}-${index}`}>
                          <th scope="row" className="ka-so-it__namecell">
                            <span className="ka-so-it__prod">
                              <span className="ka-so-tone ka-so-it__tile" data-tone={TILE_TONES[index % TILE_TONES.length]} aria-hidden="true">{initials(line.product_name)}</span>
                              <span className="ka-so-it__name">
                                <b>{line.product_name}</b>
                                <span className="ka-so-it__sub">{[variant, returned > 0 ? `คืนแล้ว ${returned.toLocaleString('th-TH')}` : ''].filter(Boolean).join(' · ')}</span>
                              </span>
                            </span>
                          </th>
                          <td className="ka-so-r ka-so-it__money">{qty}</td>
                          <td className="ka-so-r ka-so-it__ret-col">{returned > 0 ? <span className="ka-so-it__ret">{returned.toLocaleString('th-TH')}</span> : '—'}</td>
                          <td className="ka-so-r ka-so-it__money">{formatMoney(Number(line.sale_order_list_price))}</td>
                          <td className="ka-so-r ka-so-it__sum">{formatMoney(lineTotal(line))}</td>
                          <td className="ka-so-it__phone">
                            <span>{qty} × {formatBaht(Number(line.sale_order_list_price))}</span>
                            <b>{formatBaht(lineTotal(line))}</b>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="ka-so-tot">
              <dl>
                {shipping > 0 && (
                  <>
                    <dt>ยอดสินค้า</dt>
                    <dd>{formatMoney(linesSum)}</dd>
                    <dt>ค่าจัดส่ง (รวมในราคาแล้ว)</dt>
                    <dd>{formatMoney(shipping)}</dd>
                  </>
                )}
                <dt>ยอดก่อน VAT</dt>
                <dd>{formatMoney(beforeVat(order))}</dd>
                <dt>{order.vat_type === 'include' ? `VAT ${Number(order.vat_rate) || 0}% (รวมในราคา)` : order.vat_type === 'exclude' ? `VAT ${Number(order.vat_rate) || 0}%` : 'VAT'}</dt>
                <dd>{order.vat_type === 'include' || order.vat_type === 'exclude' ? formatMoney(vatAmount(order)) : 'ไม่คิด'}</dd>
                <dt className="ka-so-tot__g">ยอดสุทธิ (บาท)</dt>
                <dd className="ka-so-tot__g">{formatMoney(payable(order))}</dd>
              </dl>
            </div>
          </section>

          {canReadReceipts && (
            <section className="ka-so-card ka-so-clip ka-so-noprint" aria-labelledby="so-receipts">
              <div className="ka-so-chd">
                <h2 id="so-receipts" className="ka-so-h2">ใบเสร็จรับเงิน</h2>
                {receipts && <span className="ka-so-count">{receipts.length} ใบ</span>}
              </div>
              {receiptsError && <p role="alert" className="ka-so-note ka-error">{receiptsError}</p>}
              {receipts && receipts.length === 0 && <p className="ka-so-note ka-so-cap">ยังไม่มีการรับชำระ</p>}
              {receipts?.map((receipt) => {
                const amount = Number(receipt.amount_paid);
                const refund = amount < 0;
                return (
                  <div key={receipt.payment_receipt_id} className="ka-so-rcp">
                    <span className="ka-so-tone ka-so-rcp__ic" data-tone={refund ? 'danger' : 'success'} aria-hidden="true">
                      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={refund ? 'M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3' : 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'} />
                      </svg>
                    </span>
                    <span className="ka-so-rcp__b">
                      <Link href={`/admin/payment-receipts/${receipt.payment_receipt_id}`}>
                        <DocumentCode code={receipt.payment_receipt_code} legacyCode={receipt.legacy_code} />
                      </Link>
                      <span className="ka-so-cap">
                        {formatThaiDate(receipt.payment_date)} · {refund ? 'คืนเงิน' : receipt.payment_method === 'bank' ? 'โอนผ่านธนาคาร' : 'เงินสด'}
                      </span>
                    </span>
                    <span className="ka-so-rcp__amt" data-refund={refund || undefined}>
                      {refund ? '−' : '+'}{formatBaht(Math.abs(amount))}
                    </span>
                  </div>
                );
              })}
            </section>
          )}
        </div>

        <aside className="ka-so-stack" aria-label="สรุปและประวัติ">
          {dueCard('ka-so-due--aside')}
          {isCustom && wide && (
            <section className="ka-so-card ka-so-side ka-so-noprint ka-so-due--aside" aria-label="การรับชำระงานผลิต Custom">
              <CustomPayment orderId={id} status={status} onSuccess={changed} />
            </section>
          )}

          <section className="ka-so-card ka-so-side ka-so-side--info" aria-labelledby="so-doc">
            <h2 id="so-doc" className="ka-so-h2">ข้อมูลเอกสาร</h2>
            <dl className="ka-so-dl">
              <div>
                <dt>ประเภท</dt>
                <dd>{typeLabel(order.sale_order_type)}</dd>
              </div>
              <div>
                <dt>รูปแบบ VAT</dt>
                <dd>{vatTypeText(order)}</dd>
              </div>
              <div>
                <dt>ที่อยู่จัดส่ง</dt>
                <dd className="ka-so-pre">{order.shipping_address_name || '—'}</dd>
              </div>
              <div>
                <dt>รายละเอียด</dt>
                <dd className="ka-so-pre">{order.sale_order_detail || '—'}</dd>
              </div>
              {order.legacy_code && (
                <div>
                  <dt>เลขเดิม</dt>
                  <dd>{order.legacy_code}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="ka-so-card ka-so-side ka-so-noprint" aria-labelledby="so-history">
            <h2 id="so-history" className="ka-so-h2">ประวัติเอกสาร</h2>
            <DocumentHistoryPanel key={historyKey} endpoint={`/sale-order/${id}/history`} variant="timeline" onEntries={setHistory} documentLabel={[order.sale_order_code, order.sale_order_name].filter(Boolean).join(' · ')} />
          </section>
        </aside>
      </div>

      {/* The header actions are hidden on a phone, so every order gets this bar: print and the ⋯ menu stay
          reachable even when nothing else can be done (cancelled, returned, paid in full, custom). */}
      <div className="ka-so-bar ka-so-noprint">
        {canReturn && primary && (
          <button type="button" className="ka-btn" onClick={() => setReturning(true)}>คืนสินค้า</button>
        )}
        {primary ? (
          <button type="button" className="ka-btn ka-btn--primary" onClick={primary.onClick} disabled={actions.busy !== null}>
            {primary.label}
            {primary.label === 'รับชำระ' && pay.due > 0 ? ` ${formatBaht(pay.due)}` : ''}
          </button>
        ) : canReturn ? (
          <button type="button" className="ka-btn ka-btn--primary" onClick={() => setReturning(true)}>คืนสินค้า</button>
        ) : editHref ? (
          <Link href={editHref} className="ka-btn ka-btn--primary">แก้ไข</Link>
        ) : (
          <button type="button" className="ka-btn ka-so-bar__wide" onClick={print}>พิมพ์</button>
        )}
        {primary && editHref && <Link href={editHref} className="ka-btn">แก้ไข</Link>}
        {primary || canReturn || editHref ? (
          <RowMenu label={`ตัวเลือกเพิ่มเติมของ ${code}`} items={moreWithPrint} triggerClassName="ka-btn ka-btn--icon ka-so-more" />
        ) : (
          moreItems.length > 0 && <RowMenu label={`ตัวเลือกเพิ่มเติมของ ${code}`} items={moreItems} triggerClassName="ka-btn ka-btn--icon ka-so-more" />
        )}
      </div>

      {returning && (
        <ReturnDialog
          order={order}
          onClose={closeReturn}
          onReturned={(refund) => {
            toast({ message: `บันทึกการคืนสินค้า ${code} แล้ว คืนเงินประมาณ ${formatBaht(refund)}`, tone: 'success' });
            closeReturn();
            changed();
          }}
        />
      )}
      {actions.dialogs}
    </div>
  );
}
