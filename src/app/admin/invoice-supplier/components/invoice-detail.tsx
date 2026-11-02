'use client';

import Link from 'next/link';
import Modal from '@/components/Modal';
import DocumentCode from '@/components/DocumentCode';
import StatusBadge from '@/components/StatusBadge';
import { formatThaiDate } from '@/lib/date-format';
import { VAT_TYPE_LABELS } from '@/lib/vat';
import type { InvoiceSupplierPayment } from '@/types/invoice-supplier';
import {
  accountLabel,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONES,
  dueNote,
  formatBaht,
  InvoiceView,
  paidPercent,
} from '../lib/is-display';

interface InvoiceDetailProps {
  isOpen: boolean;
  onClose: () => void;
  view: InvoiceView;
  availablePayments: InvoiceSupplierPayment[];
  onEdit?: () => void;
  /** Shown for people who may delete, so delete stays reachable without the edit right (TASK-0327 D4). */
  onDelete?: () => void;
}

export default function InvoiceDetail({ isOpen, onClose, view, availablePayments, onEdit, onDelete }: InvoiceDetailProps) {
  const { row, total, paid, remaining, status } = view;
  const payments = row.invoicePayments || [];
  const note = dueNote(view);
  const pct = paidPercent(total, paid);
  // GET /invoice-supplier/:id joins each round's account (`invoicePayments.payment`); the list does not, so the
  // supplier's accounts fill the gaps. The dashboard opens a detail without them (TASK-0327 review F12).
  const accounts = new Map(availablePayments.map((account) => [account.payment_id, account]));
  payments.forEach((payment) => {
    const joined = (payment as typeof payment & { payment?: InvoiceSupplierPayment | null }).payment;
    if (joined?.payment_id && !accounts.has(joined.payment_id)) accounts.set(joined.payment_id, joined);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="detail"
      className="ka-is-modal"
      title={row.invoice_supplier_name || 'ใบชำระหนี้'}
      eyebrow={
        <span className="ka-is-eyebrow">
          <span className="ka-po-code"><DocumentCode code={row.invoice_supplier_code} legacyCode={row.legacy_code} /></span>
          <StatusBadge tone={DISPLAY_STATUS_TONES[status]}>{DISPLAY_STATUS_LABELS[status]}</StatusBadge>
        </span>
      }
      footer={
        <>
          {onDelete && (
            <button type="button" className="ka-btn ka-btn--danger" onClick={onDelete}>ลบใบชำระหนี้</button>
          )}
          <button type="button" className="ka-btn" onClick={onClose}>ปิด</button>
          {onEdit && (
            <button type="button" className="ka-btn ka-btn--primary" onClick={onEdit}>
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              แก้ไขเอกสาร
            </button>
          )}
        </>
      }
    >
      <div className="ka-is-sum">
        <dl className="ka-is-sum__g">
          <div>
            <dt>ยอดเอกสาร</dt>
            <dd className="numeric">{formatBaht(total)}</dd>
          </div>
          <div>
            <dt>ชำระแล้ว</dt>
            <dd className="numeric" data-tone={paid > 0 ? 'success' : undefined}>{formatBaht(paid)}</dd>
          </div>
          <div>
            <dt>คงเหลือ</dt>
            <dd className="numeric" data-tone={remaining > 0 ? 'warning' : undefined}>{formatBaht(remaining)}</dd>
          </div>
        </dl>
        <div
          className="ka-is-bar ka-is-bar--lg"
          data-full={pct >= 100 || undefined}
          role="progressbar"
          aria-label="ชำระแล้ว"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`ชำระแล้ว ${formatBaht(paid)} จาก ${formatBaht(total)}`}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>

      <section className="ka-is-sec" aria-labelledby="is-detail-info">
        <h3 id="is-detail-info" className="ka-is-h3">ข้อมูลเอกสาร</h3>
        <dl className="ka-is-dl">
          <div>
            <dt>วันที่เอกสาร</dt>
            <dd className="numeric">{formatThaiDate(row.invoice_supplier_date)}</dd>
          </div>
          <div>
            <dt>ครบกำหนด</dt>
            <dd className="numeric">
              {formatThaiDate(row.invoice_supplier_due_date)}
              {note.text && <span className="ka-is-note" data-tone={note.tone === 'muted' ? undefined : note.tone}>{note.text}</span>}
            </dd>
          </div>
          <div>
            <dt>VAT</dt>
            <dd>{VAT_TYPE_LABELS[view.vatType]}</dd>
          </div>
          <div>
            <dt>ใบรับสินค้าอ้างอิง</dt>
            <dd>
              {row.purchase_receipt_id ? (
                <Link href={`/admin/purchase-receipt/${row.purchase_receipt_id}`} className="ka-po-code text-[var(--brand-ink)] underline underline-offset-2">
                  {view.receiptCode}
                </Link>
              ) : (
                view.receiptCode
              )}
            </dd>
          </div>
          <div className="ka-is-dl__wide">
            <dt>ผู้จัดจำหน่าย</dt>
            <dd>{view.supplierName}</dd>
          </div>
        </dl>
      </section>

      <section className="ka-is-sec" aria-labelledby="is-detail-pay">
        <div className="ka-is-h3row">
          <h3 id="is-detail-pay" className="ka-is-h3">ประวัติการชำระ</h3>
          <span className="ka-is-help">{payments.length > 0 ? `${payments.length.toLocaleString('th-TH')} งวด` : ''}</span>
        </div>
        {payments.length === 0 ? (
          <p className="ka-is-nopay ka-is-hist">ยังไม่มีการชำระ</p>
        ) : (
          <ol className="ka-is-hist">
            {payments.map((payment, index) => {
              const account = payment.payment_id ? accounts.get(payment.payment_id) : undefined;
              const where = payment.payment_method === 'cash' ? 'ไม่ผ่านบัญชีธนาคาร' : accountLabel(account) || 'บัญชีที่ไม่พบในข้อมูลผู้จัดจำหน่ายแล้ว';
              return (
                <li key={payment.invoice_payment_id}>
                  <span className="ka-is-hist__icon" aria-hidden="true">
                    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </span>
                  <div className="ka-is-hist__main">
                    <div className="ka-is-hist__t">
                      งวดที่ {index + 1} · {payment.payment_method === 'cash' ? 'เงินสด' : 'ธนาคาร'}
                    </div>
                    <div className="ka-is-sub">{where}</div>
                  </div>
                  <span className="ka-is-hist__amt numeric">{formatBaht(Number(payment.invoice_payment_price || 0))}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </Modal>
  );
}
