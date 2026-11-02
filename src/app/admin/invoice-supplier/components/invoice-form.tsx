'use client';

import { FormEvent, KeyboardEvent, useId, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import CustomSelect from '@/components/CustomSelect';
import DocumentCode from '@/components/DocumentCode';
import StatusBadge from '@/components/StatusBadge';
import { getApiErrorMessage } from '@/lib/api-error';
import { toDateInputValue, todayLocalIso } from '@/lib/date-format';
import { VAT_TYPE_LABELS, VatType } from '@/lib/vat';
import type {
  InvoicePaymentItem,
  InvoicePaymentMethod,
  InvoiceSupplierFormPayload,
  InvoiceSupplierPayment,
  InvoiceSupplierRow,
} from '@/types/invoice-supplier';
import type { PurchaseReceipt } from '@/types/purchase-receipt';
import {
  accountLabel,
  addDaysIso,
  amountText,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONES,
  displayStatus,
  formatBaht,
  paidPercent,
  parseAmount,
  paymentStatus,
  receiptPayable,
} from '../lib/is-display';

const CREDIT_DAYS = [7, 15, 30];

interface PaymentDraft {
  key: string;
  invoice_payment_id: string;
  method: InvoicePaymentMethod;
  payment_id?: string;
  /** What the person typed; parsed only when the totals and the save need a number. */
  amount: string;
}

type InvoiceFormProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Rejects with the API's error, which the form shows in a banner while keeping what was typed. */
  onSubmit: (payload: InvoiceSupplierFormPayload) => Promise<void>;
  availablePayments: InvoiceSupplierPayment[];
} & (
  | { mode: 'create'; receipt: PurchaseReceipt }
  | {
      mode: 'edit';
      invoice: InvoiceSupplierRow;
      receiptCode: string;
      supplierName: string;
      vatType: VatType;
      onDelete?: () => void;
      /** The invoice is paid: saving needs a reason, kept in the document history (TASK-0329 R2). */
      reasonRequired?: boolean;
    }
);

const REASON_LIMIT = 500;

function newPayment(method: InvoicePaymentMethod, paymentId: string | undefined, amount: number): PaymentDraft {
  const id = crypto.randomUUID();
  return { key: id, invoice_payment_id: id, method, payment_id: method === 'bank' ? paymentId : undefined, amount: amount > 0 ? amountText(amount) : '' };
}

function fromSaved(item: InvoicePaymentItem): PaymentDraft {
  return {
    key: item.invoice_payment_id,
    invoice_payment_id: item.invoice_payment_id,
    method: item.payment_method,
    payment_id: item.payment_id,
    amount: amountText(Number(item.invoice_payment_price || 0)),
  };
}

export default function InvoiceForm(props: InvoiceFormProps) {
  const { isOpen, onClose, onSubmit, availablePayments, mode } = props;
  const formId = useId();
  const hasAccounts = availablePayments.length > 0;
  const defaultMethod: InvoicePaymentMethod = hasAccounts ? 'bank' : 'cash';

  // The invoice amount: a new invoice owes the receipt's VAT-inclusive amount (TASK-0328); an edit keeps the invoice's own.
  const total = props.mode === 'create' ? receiptPayable(props.receipt) : Number(props.invoice.invoice_supplier_total || 0);

  const [name, setName] = useState(() =>
    props.mode === 'create'
      ? props.receipt.supplier?.supplier_name
        ? `ใบชำระหนี้ ${props.receipt.supplier.supplier_name}`
        : 'ใบชำระหนี้'
      : props.invoice.invoice_supplier_name,
  );
  const [docDate, setDocDate] = useState(() =>
    props.mode === 'create' ? todayLocalIso() : toDateInputValue(props.invoice.invoice_supplier_date),
  );
  const [dueDate, setDueDate] = useState(() =>
    props.mode === 'create' ? addDaysIso(todayLocalIso(), 30) : toDateInputValue(props.invoice.invoice_supplier_due_date),
  );
  // A new invoice starts with one round for the whole amount, as before (TASK-0327 D10); every round can be removed.
  const [payments, setPayments] = useState<PaymentDraft[]>(() =>
    props.mode === 'create'
      ? [newPayment(defaultMethod, availablePayments[0]?.payment_id, total)]
      : (props.invoice.invoicePayments || []).map(fromSaved),
  );
  const reasonRequired = props.mode === 'edit' && Boolean(props.reasonRequired);
  const [reason, setReason] = useState('');
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Most payment edits are clicks (method, account, add, remove, fill), which the Modal's input-based guess
  // misses; compare what is on screen with what the form opened with instead (TASK-0327 review F3).
  const snapshot = (fields: { name: string; docDate: string; dueDate: string; payments: PaymentDraft[]; reason: string }) =>
    JSON.stringify([
      fields.reason,
      fields.name,
      fields.docDate,
      fields.dueDate,
      fields.payments.map((payment) => [payment.key, payment.method, payment.payment_id ?? '', payment.amount]),
    ]);
  const [initial] = useState(() => snapshot({ name, docDate, dueDate, payments, reason }));
  const dirty = snapshot({ name, docDate, dueDate, payments, reason }) !== initial;

  const parsed = useMemo(() => payments.map((payment) => parseAmount(payment.amount)), [payments]);
  const paid = useMemo(() => Math.round(parsed.reduce<number>((sum, value) => sum + (value ?? 0), 0) * 100) / 100, [parsed]);
  const remaining = Math.round((total - paid) * 100) / 100;
  const over = paid > total;
  // The round whose amount first takes the sum past the invoice carries the message.
  const overIndex = useMemo(() => {
    let running = 0;
    for (let index = 0; index < parsed.length; index += 1) {
      running += parsed[index] ?? 0;
      if (Math.round(running * 100) / 100 > total) return index;
    }
    return -1;
  }, [parsed, total]);

  const status = displayStatus(props.mode === 'edit' ? props.invoice.invoice_supplier_status : undefined, total, paid, dueDate);

  const fieldErrors = {
    name: !name.trim() ? 'ใส่ชื่อเอกสาร' : null,
    docDate: !docDate ? 'เลือกวันที่เอกสาร' : null,
    dueDate: !dueDate ? 'เลือกวันที่ครบกำหนด' : null,
    reason: reasonRequired && !reason.trim() ? 'ระบุเหตุผลที่แก้ไขใบที่ชำระครบแล้ว' : null,
  };
  const paymentErrors = payments.map((payment, index) => {
    const value = parsed[index];
    const amount = !payment.amount.trim()
      ? 'ใส่ยอดชำระ หรือลบงวดนี้'
      : value === null
        ? 'ใส่ยอดเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง เช่น 1,250.00'
        : value <= 0
          ? 'ยอดชำระต้องมากกว่า 0'
          : null;
    const account = payment.method === 'bank' && !payment.payment_id ? 'เลือกบัญชีของผู้จัดจำหน่าย' : null;
    return { amount, account };
  });
  const hasErrors =
    Object.values(fieldErrors).some(Boolean) || paymentErrors.some((error) => error.amount || error.account);

  const update = (key: string, change: Partial<PaymentDraft>) =>
    setPayments((current) => current.map((payment) => (payment.key === key ? { ...payment, ...change } : payment)));

  const chooseMethod = (payment: PaymentDraft, method: InvoicePaymentMethod) =>
    update(payment.key, {
      method,
      payment_id: method === 'bank' ? payment.payment_id || availablePayments[0]?.payment_id : undefined,
    });

  // A radio group: one Tab stop, arrows move the choice (same keys as the purchase forms' segmented controls).
  const onMethodKey = (event: KeyboardEvent<HTMLDivElement>, payment: PaymentDraft, idBase: string) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const enabled: InvoicePaymentMethod[] = hasAccounts ? ['cash', 'bank'] : ['cash'];
    const index = Math.max(0, enabled.indexOf(payment.method));
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % enabled.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + enabled.length) % enabled.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = enabled.length - 1;
    chooseMethod(payment, enabled[next]);
    document.getElementById(`${idBase}-${enabled[next]}`)?.focus();
  };

  const addPayment = (amount = 0) =>
    setPayments((current) => [...current, newPayment(defaultMethod, availablePayments[0]?.payment_id, amount)]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (fieldErrors.reason) reasonField.current?.focus();
    if (hasErrors || over || saving) return;
    const invoicePayments: InvoicePaymentItem[] = payments.map((payment, index) => ({
      invoice_payment_id: payment.invoice_payment_id,
      payment_method: payment.method,
      payment_id: payment.method === 'bank' ? payment.payment_id : undefined,
      invoice_payment_price: parsed[index] ?? 0,
    }));
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit({
        invoice_supplier_name: name.trim(),
        invoice_supplier_date: docDate,
        invoice_supplier_due_date: dueDate,
        // The API derives the status from the payments (TASK-0327 D1); the same value is sent as before.
        invoice_supplier_status: paymentStatus(total, paid),
        invoicePayments,
        supplier_id: props.mode === 'create' ? props.receipt.supplier_id : props.invoice.supplier_id,
        invoice_supplier_total: total,
        ...(reasonRequired ? { edit_reason: reason.trim() } : {}),
      });
    } catch (error) {
      setSaveError(`บันทึกไม่สำเร็จ ${getApiErrorMessage(error)} ข้อมูลที่กรอกยังอยู่ ลองอีกครั้ง`);
    } finally {
      setSaving(false);
    }
  };

  const show = (message: string | null) => (attempted ? message : null);
  const receiptCode = props.mode === 'create' ? props.receipt.purchase_receipt_code || '-' : props.receiptCode;
  const supplierName = props.mode === 'create' ? props.receipt.supplier?.supplier_name || '-' : props.supplierName;
  const vatType: VatType = props.mode === 'create' ? props.receipt.vat_type || 'none' : props.vatType;
  const accountOptions = availablePayments.map((account) => ({ value: account.payment_id, label: accountLabel(account) || account.account_name }));
  const pct = paidPercent(total, paid);

  const docIcon = (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      {mode === 'create' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      )}
    </svg>
  );

  return (
    <Modal
      guardUnsaved
      dirty={dirty}
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="ka-is-modal"
      icon={docIcon}
      iconTone="warning"
      title={mode === 'create' ? 'ออกใบชำระหนี้ผู้จัดจำหน่าย' : 'แก้ไขใบชำระหนี้'}
      description={mode === 'create' ? 'ข้อมูลตั้งต้นดึงจากใบรับสินค้า แก้ไขได้ก่อนบันทึก' : undefined}
      eyebrow={
        props.mode === 'edit' ? (
          <span className="ka-is-eyebrow">
            <span className="ka-po-code"><DocumentCode code={props.invoice.invoice_supplier_code} legacyCode={props.invoice.legacy_code} /></span>
            <StatusBadge tone={DISPLAY_STATUS_TONES[status]}>{DISPLAY_STATUS_LABELS[status]}</StatusBadge>
          </span>
        ) : undefined
      }
      footer={
        <>
          {props.mode === 'edit' && props.onDelete && (
            <button type="button" className="ka-btn ka-btn--danger" onClick={props.onDelete} disabled={saving}>
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              ลบใบชำระหนี้
            </button>
          )}
          <button type="button" className="ka-btn" onClick={onClose} disabled={saving}>
            {mode === 'create' ? 'ยกเลิก' : 'ปิดโดยไม่บันทึก'}
          </button>
          <button
            type="submit"
            form={formId}
            className="ka-btn ka-btn--primary"
            disabled={over || saving}
            aria-busy={saving || undefined}
            aria-describedby={over ? `${formId}-over` : undefined}
          >
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {saving ? 'กำลังบันทึก…' : mode === 'create' ? 'บันทึกใบชำระหนี้' : 'บันทึกการแก้ไข'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void submit(event)} noValidate className="contents">
        {saveError && (
          <div role="alert" className="ka-banner ka-banner--danger">
            <span>{saveError}</span>
          </div>
        )}

        <dl className="ka-is-src" aria-label="ข้อมูลจากใบรับสินค้า">
          <div>
            <dt>ใบรับสินค้า</dt>
            <dd className="ka-po-code">{receiptCode}</dd>
          </div>
          <div>
            <dt>ผู้จัดจำหน่าย</dt>
            <dd>{supplierName}</dd>
          </div>
          {/* The VAT type stays its own row so the amount label never reads as before/after VAT (TASK-0328 F1, F2). */}
          <div>
            <dt>VAT</dt>
            <dd>{VAT_TYPE_LABELS[vatType]}</dd>
          </div>
          <div className="ka-is-src__total">
            <dt>{mode === 'edit' ? 'ยอดใบชำระหนี้' : vatType === 'none' ? 'ยอดที่ต้องชำระ' : 'ยอดที่ต้องชำระ (รวม VAT แล้ว)'}</dt>
            <dd className="numeric">{formatBaht(total)}</dd>
          </div>
        </dl>

        {reasonRequired && (
          <div className="ka-is-sec">
            <p className="ka-banner ka-banner--warning">
              ใบนี้ชำระครบแล้ว การแก้ไขจะบันทึกในประวัติเอกสารพร้อมผู้แก้ วันเวลา และเหตุผล
            </p>
            <div className="ka-is-field">
              <label className="ka-is-label" htmlFor={`${formId}-reason`}>
                เหตุผลที่แก้ไข <span className="ka-is-req" aria-hidden="true">*</span>
              </label>
              <textarea
                id={`${formId}-reason`}
                ref={reasonField}
                className="ka-textarea"
                rows={2}
                maxLength={REASON_LIMIT}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                aria-invalid={Boolean(show(fieldErrors.reason)) || undefined}
                aria-describedby={`${formId}-reason-help${show(fieldErrors.reason) ? ` ${formId}-reason-err` : ''}`}
              />
              <p id={`${formId}-reason-help`} className="ka-is-help numeric">
                {reason.length}/{REASON_LIMIT} ตัวอักษร
              </p>
              {show(fieldErrors.reason) && <p id={`${formId}-reason-err`} className="ka-is-err">{fieldErrors.reason}</p>}
            </div>
          </div>
        )}

        <fieldset className="ka-is-sec">
          <legend>ข้อมูลเอกสาร</legend>
          <div className="ka-is-grid">
            <div className="ka-is-field ka-is-full">
              <label className="ka-is-label" htmlFor={`${formId}-name`}>
                ชื่อเอกสาร <span className="ka-is-req" aria-hidden="true">*</span>
              </label>
              <input
                id={`${formId}-name`}
                className="ka-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                aria-invalid={Boolean(show(fieldErrors.name)) || undefined}
                aria-describedby={show(fieldErrors.name) ? `${formId}-name-err` : undefined}
              />
              {show(fieldErrors.name) && <p id={`${formId}-name-err`} className="ka-is-err">{fieldErrors.name}</p>}
            </div>

            <div className="ka-is-field">
              <label className="ka-is-label" htmlFor={`${formId}-doc`}>
                วันที่เอกสาร <span className="ka-is-req" aria-hidden="true">*</span>
              </label>
              <input
                id={`${formId}-doc`}
                type="date"
                className="ka-input"
                value={docDate}
                onChange={(event) => setDocDate(event.target.value)}
                required
                aria-invalid={Boolean(show(fieldErrors.docDate)) || undefined}
                aria-describedby={show(fieldErrors.docDate) ? `${formId}-doc-err` : undefined}
              />
              {show(fieldErrors.docDate) && <p id={`${formId}-doc-err`} className="ka-is-err">{fieldErrors.docDate}</p>}
            </div>

            <div className="ka-is-field">
              <label className="ka-is-label" htmlFor={`${formId}-due`}>
                วันที่ครบกำหนด <span className="ka-is-req" aria-hidden="true">*</span>
              </label>
              <input
                id={`${formId}-due`}
                type="date"
                className="ka-input"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
                aria-invalid={Boolean(show(fieldErrors.dueDate)) || undefined}
                aria-describedby={show(fieldErrors.dueDate) ? `${formId}-due-err` : undefined}
              />
              {show(fieldErrors.dueDate) && <p id={`${formId}-due-err`} className="ka-is-err">{fieldErrors.dueDate}</p>}
              {docDate && (
                <div className="ka-is-credit" role="group" aria-label="ตั้งวันครบกำหนดจากวันที่เอกสาร">
                  <span aria-hidden="true">เครดิต</span>
                  {CREDIT_DAYS.map((days) => {
                    const value = addDaysIso(docDate, days);
                    return (
                      <button key={days} type="button" aria-pressed={dueDate === value} onClick={() => setDueDate(value)}>
                        {days} วัน
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="ka-is-field">
              <span className="ka-is-label" id={`${formId}-total`}>ยอดใบชำระหนี้</span>
              <div className="ka-is-ro numeric" aria-labelledby={`${formId}-total`}>
                {formatBaht(total)}
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" role="img" aria-label="แก้ไม่ได้">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <p className="ka-is-help">{mode === 'create' ? 'ตามยอดใบรับสินค้า' : 'ยอดเดิมของใบนี้'}</p>
            </div>

            <div className="ka-is-field">
              <span className="ka-is-label">สถานะเอกสาร</span>
              <div className="ka-is-status-slot" aria-live="polite">
                {over ? (
                  <StatusBadge tone="danger">ยอดชำระเกินยอดเอกสาร</StatusBadge>
                ) : (
                  <StatusBadge tone={DISPLAY_STATUS_TONES[status]}>{DISPLAY_STATUS_LABELS[status]}</StatusBadge>
                )}
              </div>
              <p className="ka-is-help">คำนวณอัตโนมัติจากยอดที่ชำระและวันครบกำหนด</p>
            </div>

          </div>
        </fieldset>

        <section className="ka-is-sec" aria-labelledby={`${formId}-pay`}>
          <div className="ka-is-h3row">
            <h3 id={`${formId}-pay`} className="ka-is-h3">การชำระเงิน</h3>
            <span className="ka-is-help">บันทึกได้หลายงวด หรือเว้นไว้แล้วค่อยเพิ่มภายหลัง</span>
          </div>

          <div className="ka-is-prog">
            <div className="ka-is-prog__row">
              <span>
                ชำระแล้ว <strong className="numeric" data-tone={paid >= total && total > 0 ? 'success' : undefined}>{formatBaht(paid)}</strong> จาก{' '}
                <span className="numeric">{formatBaht(total)}</span>
              </span>
              <span>
                คงเหลือ <strong className="numeric" data-tone={remaining > 0 ? 'warning' : undefined}>{formatBaht(Math.max(remaining, 0))}</strong>
              </span>
            </div>
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

          <div className="ka-is-pays">
            {payments.length > 0 && (
              <div className="ka-is-ph" aria-hidden="true">
                <span>งวด</span>
                <span>วิธีชำระ</span>
                <span>บัญชีผู้จัดจำหน่าย</span>
                <span className="ka-po-r">ยอดชำระ (บาท)</span>
                <span />
              </div>
            )}
            {payments.length === 0 && <p className="ka-is-nopay">ยังไม่มีงวดชำระ ใบนี้จะบันทึกเป็น “รอชำระ”</p>}
            {payments.map((payment, index) => {
              const errors = paymentErrors[index];
              const amountId = `${formId}-amt-${payment.key}`;
              const isOver = index === overIndex;
              const amountError = isOver ? `ยอดชำระรวม ${formatBaht(paid)} เกินยอดเอกสาร ${formatBaht(total)} อยู่ ${formatBaht(paid - total)}` : show(errors.amount);
              const amountErrorId = isOver ? `${formId}-over` : `${amountId}-err`;
              const accountError = show(errors.account);
              const round = index + 1;
              return (
                <div key={payment.key} className="ka-is-pr" role="group" aria-label={`งวดที่ ${round}`}>
                  <span className="ka-is-idx" aria-hidden="true">
                    <span className="hidden max-[639px]:inline">งวดที่ </span>
                    {round}
                  </span>
                  <div className="ka-is-c ka-is-c--m">
                    <span className="ka-po-lab" id={`${amountId}-m`}>วิธีชำระ</span>
                    <div
                      className="ka-po-seg"
                      role="radiogroup"
                      aria-labelledby={`${amountId}-m`}
                      onKeyDown={(event) => onMethodKey(event, payment, amountId)}
                    >
                      {(['cash', 'bank'] as const).map((method) => (
                        <button
                          key={method}
                          id={`${amountId}-${method}`}
                          type="button"
                          role="radio"
                          aria-checked={payment.method === method}
                          tabIndex={payment.method === method ? 0 : -1}
                          disabled={method === 'bank' && !hasAccounts}
                          title={method === 'bank' && !hasAccounts ? 'ผู้จัดจำหน่ายนี้ยังไม่มีบัญชีธนาคาร' : undefined}
                          onClick={() => chooseMethod(payment, method)}
                        >
                          {method === 'cash' ? 'เงินสด' : 'ธนาคาร'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ka-is-c ka-is-c--a">
                    <span className="ka-po-lab">บัญชีผู้จัดจำหน่าย</span>
                    {payment.method === 'bank' ? (
                      <>
                        <CustomSelect
                          aria-label={`บัญชีผู้จัดจำหน่าย งวดที่ ${round}`}
                          value={payment.payment_id || ''}
                          onChange={(value) => update(payment.key, { payment_id: value })}
                          options={accountOptions}
                          placeholder="เลือกบัญชี"
                          aria-invalid={Boolean(accountError)}
                          aria-describedby={accountError ? `${amountId}-acc-err` : undefined}
                        />
                        {accountError && <p id={`${amountId}-acc-err`} className="ka-is-err">{accountError}</p>}
                      </>
                    ) : (
                      <span className="ka-is-cashnote">ไม่ต้องเลือกบัญชีสำหรับเงินสด</span>
                    )}
                  </div>
                  <div className="ka-is-c ka-is-c--p">
                    <label className="ka-po-lab" htmlFor={amountId}>ยอดชำระ (บาท) งวดที่ {round}</label>
                    <input
                      id={amountId}
                      className="ka-input ka-is-amt"
                      inputMode="decimal"
                      autoComplete="off"
                      value={payment.amount}
                      placeholder="0.00"
                      onChange={(event) => update(payment.key, { amount: event.target.value })}
                      onBlur={() => {
                        const value = parseAmount(payment.amount);
                        if (value !== null) update(payment.key, { amount: amountText(value) });
                      }}
                      aria-invalid={Boolean(amountError) || undefined}
                      aria-describedby={amountError ? amountErrorId : undefined}
                    />
                    {amountError && (
                      <p id={amountErrorId} className="ka-is-err" role={isOver ? 'status' : undefined}>
                        {amountError}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ka-btn ka-btn--ghost ka-btn--icon ka-is-del"
                    aria-label={`ลบงวดที่ ${round}`}
                    onClick={() => setPayments((current) => current.filter((item) => item.key !== payment.key))}
                  >
                    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              );
            })}
            <div className="ka-is-pfoot">
              <button type="button" className="ka-btn ka-is-addpay" onClick={() => addPayment()} disabled={remaining <= 0}>
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                เพิ่มงวดชำระ
              </button>
              <span className="ka-is-pfoot__sp" />
              {remaining > 0 ? (
                <button type="button" className="ka-btn ka-is-fill" onClick={() => addPayment(remaining)}>
                  ใส่ยอดคงเหลือ <span className="numeric font-semibold">{formatBaht(remaining)}</span>
                </button>
              ) : (
                !over && total > 0 && <span className="ka-is-help">ชำระครบยอดแล้ว</span>
              )}
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
}
