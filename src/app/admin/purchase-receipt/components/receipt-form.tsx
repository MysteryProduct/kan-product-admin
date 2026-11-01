'use client';

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomSelect, { SelectOption } from '@/components/CustomSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import DocumentCode from '@/components/DocumentCode';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import PurchaseOrderModel from '@/models/purchase-order';
import { formatThaiDate, todayLocalIso } from '@/lib/date-format';
import { usePageCrumb } from '@/lib/page-crumb';
import { VAT_TYPE_LABELS, VAT_TYPE_OPTIONS, VatType } from '@/lib/vat';
import type { PurchaseOrder } from '@/types/purchase-order';
import { useLeaveGuard } from '../../purchase-orders/hooks/useLeaveGuard';
import { formatBaht, formatMoney, statusLabel, statusTone } from '../../purchase-orders/lib/po-display';
import { ReceiptFormMode, ReceiptLineDraft, useReceiptForm } from '../hooks/useReceiptForm';
import { receiptStatusLabel, type Receipt, vatTypeText } from '../lib/pr-display';

const LIST_HREF = '/admin/purchase-receipt';
const purchaseOrderModel = new PurchaseOrderModel();

// The segmented control's wording for VAT_TYPE_OPTIONS (same values, shorter labels), as on the order form.
const VAT_SEGMENT_LABEL: Record<VatType, (rate: number) => string> = {
  none: () => 'ไม่คิด VAT',
  include: () => 'ราคารวม VAT',
  exclude: (rate) => `แยก VAT ${rate}%`,
};

const fieldId = {
  date: 'pr-date',
  detail: 'pr-detail',
  lines: 'pr-lines-title',
  line: (key: string, part: 'qty' | 'price') => `pr-${key}-${part}`,
};

/** Element id of the control an error key belongs to, for the summary's links. */
function controlIdFor(errorKey: string): string {
  const line = /^line-(.+)-(qty|price)$/.exec(errorKey);
  if (line) return fieldId.line(line[1], line[2] as 'qty' | 'price');
  return fieldId[errorKey as 'date' | 'detail' | 'lines'] ?? errorKey;
}

function focusControl(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

const DocIcon = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />
  </svg>
);

/** `/new` without `?po=`: the order to receive is picked first, from the orders waiting for goods. */
export function OrderPicker() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  usePageCrumb({ back: { label: 'ใบรับสินค้า', href: LIST_HREF }, current: 'รับสินค้า' });

  const fetchOrders = useCallback(async (search: string) => {
    try {
      setError(null);
      const response = await purchaseOrderModel.advisePurchaseOrders(1, 50, search);
      setOrders(response.data ?? []);
    } catch (failure) {
      setError(loadErrorText('ใบสั่งซื้อที่รอรับสินค้า', failure));
    }
  }, []);

  useEffect(() => {
    // The first page of orders, before anything is typed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrders('');
  }, [fetchOrders]);

  const options: SelectOption[] = orders.map((order) => ({
    value: order.purchase_order_id,
    label: `${order.purchase_order_code} · ${order.purchase_order_name} · ${order.supplier?.supplier_name ?? '-'} · ${statusLabel(order.purchase_order_status)}`,
  }));

  return (
    <div className="ka-page-body ka-po ka-pr">
      <div className="ka-po-ph">
        <div className="ka-po-ph__main">
          <h1 className="ka-ph__title">รับสินค้า</h1>
          <p className="ka-po-cap">เลือกใบสั่งซื้อที่ของมาถึง แล้วใส่จำนวนที่รับครั้งนี้</p>
        </div>
      </div>
      <LoadErrorBanner message={error} onRetry={() => void fetchOrders('')} />
      <section className="ka-card ka-po-cp ka-pr-pick" aria-labelledby="pr-pick-label">
        <div className="ka-field">
          <span id="pr-pick-label" className="ka-label">ใบสั่งซื้อที่รอรับสินค้า</span>
          <CustomSelect
            id="pr-pick"
            options={options}
            value=""
            onChange={(value) => value && router.replace(`${LIST_HREF}/new?po=${value}`)}
            fetchData={(query) => void fetchOrders(query)}
            placeholder="ค้นหาเลข PO หรือชื่อใบสั่งซื้อ"
            aria-label="ใบสั่งซื้อที่รอรับสินค้า"
          />
          <span className="ka-help">แสดงเฉพาะใบสั่งซื้อที่อนุมัติแล้วและยังรับไม่ครบ</span>
        </div>
      </section>
    </div>
  );
}

interface Props {
  mode: ReceiptFormMode;
  order: PurchaseOrder;
  receipt?: Receipt | null;
}

/** The receive and edit pages: one form, different starting values and save call. */
export default function ReceiptFormPage({ mode, order, receipt }: Props) {
  const toast = useToast();
  const form = useReceiptForm({ mode, order, receipt });
  // The error summary appears after a rejected save and lists what is still wrong.
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const guard = useLeaveGuard(form.dirty && !form.saving);
  const editing = mode === 'edit' && receipt;
  const orderHref = `/admin/purchase-orders/${order.purchase_order_id}`;

  usePageCrumb({
    back: { label: 'ใบรับสินค้า', href: LIST_HREF },
    current: editing ? receipt.purchase_receipt_code ?? 'แก้ไขใบรับสินค้า' : `รับสินค้า ${order.purchase_order_code}`,
  });

  const save = async () => {
    if (form.saving) return;
    const keys = Object.keys(form.validate());
    if (keys.length > 0) {
      setShowSummary(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const saved = await form.submit();
    if (!saved) return;
    toast({ message: saved.code ? `บันทึกใบรับสินค้า ${saved.code} แล้ว` : 'บันทึกใบรับสินค้าแล้ว', tone: 'success' });
    // The receipt's page takes the form's place in history, so back goes to where the form was opened from.
    guard.replaceWith(`${LIST_HREF}/${saved.id}`);
  };

  const cancel = () => guard.leave(editing ? `${LIST_HREF}/${receipt.purchase_receipt_id}` : LIST_HREF);

  const errorKeys = Object.keys(form.errors);
  const shownErrors = showSummary ? errorKeys : [];
  const err = (key: string) =>
    form.errors[key] ? (
      <span id={`${controlIdFor(key)}-error`} className="ka-error">
        {form.errors[key]}
      </span>
    ) : null;
  const described = (...ids: (string | undefined | false)[]) => ids.filter(Boolean).join(' ') || undefined;

  const onSegmentKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const enabled = VAT_TYPE_OPTIONS.map((option) => option.value).filter((value) => !(form.unregistered && value !== 'none'));
    const index = enabled.indexOf(form.vatType);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % enabled.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + enabled.length) % enabled.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = enabled.length - 1;
    form.setVatType(enabled[next]);
    document.getElementById(`pr-vat-${enabled[next]}`)?.focus();
  };

  // Arrow keys step the quantity, as the − and + buttons do.
  const onQtyKey = (line: ReceiptLineDraft) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      form.stepQty(line.key, event.key === 'ArrowUp' ? 1 : -1);
    }
  };

  const vatLine =
    form.vatType === 'none'
      ? { label: 'VAT', value: 'ไม่คิด' }
      : form.vatType === 'include'
        ? { label: `VAT ${form.vatRate}% (รวมในราคาแล้ว)`, value: formatBaht(form.vatSummary.vatAmount) }
        : { label: `VAT ${form.vatRate}%`, value: formatBaht(form.vatSummary.vatAmount) };

  const outcome = {
    empty: { tone: 'ka-pr-outcome--neutral', text: 'ยังไม่ได้ใส่จำนวนที่รับ' },
    over: { tone: 'ka-banner--danger', text: 'จำนวนรับเกินคงเหลือ แก้ก่อนบันทึก' },
    full: { tone: 'ka-banner--success', text: `เมื่อบันทึก ใบสั่งซื้อจะเป็น “รับครบแล้ว” · สต็อกเพิ่ม ${form.totalText} เมื่ออนุมัติ` },
    partial: { tone: 'ka-banner--warning', text: 'เมื่อบันทึก ใบสั่งซื้อจะเป็น “รับบางส่วน” รับที่เหลือได้ภายหลัง' },
  }[form.outcome];
  const blocked = form.outcome === 'over';

  const saveButton = (
    <button
      type="submit"
      className="ka-btn ka-btn--primary"
      disabled={form.saving || blocked}
      aria-busy={form.saving || undefined}
      aria-describedby="pr-outcome"
    >
      {form.saving ? 'กำลังบันทึก…' : 'บันทึกใบรับสินค้า'}
    </button>
  );

  const entryDateText = form.entryDate ? formatThaiDate(form.entryDate) : '';

  return (
    <form
      className="ka-page-body ka-po ka-pr ka-pr-form"
      noValidate
      aria-busy={form.saving || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="ka-po-ph">
        <div className="ka-po-ph__main">
          <h1 className="ka-ph__title">{editing ? `แก้ไข ${receipt.purchase_receipt_code ?? 'ใบรับสินค้า'}` : 'รับสินค้า'}</h1>
          <p className="ka-po-cap">
            {editing
              ? `${receiptStatusLabel(receipt.purchase_receipt_status)} · แก้ไขจำนวนได้จนกว่าจะอนุมัติ`
              : 'ตรวจนับของที่มาถึง แล้วใส่จำนวนที่รับครั้งนี้'}
          </p>
        </div>
      </div>

      {shownErrors.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="ka-banner ka-banner--danger ka-po-errors">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          </svg>
          <div>
            <p className="ka-po-errors__title">ยังบันทึกไม่ได้ กรุณาแก้ {shownErrors.length} ข้อ</p>
            <ul className="ka-po-errors__list">
              {shownErrors.map((key) => (
                <li key={key}>
                  <a
                    href={`#${controlIdFor(key)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      focusControl(controlIdFor(key));
                    }}
                  >
                    {form.errors[key]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {form.saveError && (
        <div role="alert" className="ka-banner ka-banner--danger ka-po-errors">
          <span>{form.saveError}</span>
        </div>
      )}

      <div className="ka-po-grid">
        <div className="ka-po-stack">
          <section className="ka-card ka-po-cp" aria-label="ใบสั่งซื้อที่รับ">
            <div className="ka-pr-posum">
              <span className="ka-pr-posum__ic">
                <DocIcon />
              </span>
              <div className="ka-pr-posum__main">
                <div className="ka-po-idrow">
                  <span className="ka-po-code"><DocumentCode code={order.purchase_order_code} legacyCode={order.legacy_code} /></span>
                  <StatusBadge tone={statusTone(order.purchase_order_status)}>{statusLabel(order.purchase_order_status)}</StatusBadge>
                </div>
                <p className="ka-pr-posum__name">{order.purchase_order_name}</p>
              </div>
              <a href={orderHref} target="_blank" rel="noopener noreferrer" className="ka-pr-link ka-pr-posum__link">
                ดูใบสั่งซื้อ
                <span className="sr-only"> (เปิดแท็บใหม่)</span>
              </a>
              <p className="ka-po-cap ka-pr-posum__meta numeric">
                {order.supplier?.supplier_name ?? '-'} · สั่ง {formatThaiDate(order.purchase_date)} · {vatTypeText(form.orderVat, form.vatRate)}
              </p>
            </div>
          </section>

          <section className="ka-card" aria-labelledby="pr-info-title">
            <div className="ka-po-chd">
              <h2 id="pr-info-title" className="ka-po-h2">ข้อมูลการรับ</h2>
            </div>
            <div className="ka-po-cp ka-po-fields">
              <div className="ka-po-g2">
                <div className="ka-field">
                  <label htmlFor={fieldId.date} className="ka-label">
                    วันที่รับสินค้า <span className="ka-req">*</span>
                  </label>
                  <input
                    id={fieldId.date}
                    type="date"
                    className="ka-input"
                    value={form.entryDate}
                    onChange={(event) => form.setEntryDate(event.target.value)}
                    aria-invalid={form.errors.date ? true : undefined}
                    aria-describedby={described('pr-date-be', form.errors.date && `${fieldId.date}-error`)}
                  />
                  <span id="pr-date-be" className="ka-help numeric">
                    {entryDateText ? `${entryDateText}${form.entryDate === todayLocalIso() ? ' (วันนี้)' : ''}` : 'ยังไม่ได้เลือกวันที่'}
                  </span>
                  {err('date')}
                </div>
                <div className="ka-field">
                  <span className="ka-label" id="pr-vat-label">
                    รูปแบบ VAT
                  </span>
                  <div className="ka-po-seg" role="radiogroup" aria-labelledby="pr-vat-label" aria-describedby="pr-vat-hint" onKeyDown={onSegmentKey}>
                    {VAT_TYPE_OPTIONS.map((option) => {
                      const checked = form.vatType === option.value;
                      const disabled = form.unregistered && option.value !== 'none';
                      return (
                        <button
                          key={option.value}
                          id={`pr-vat-${option.value}`}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          tabIndex={checked ? 0 : -1}
                          disabled={disabled}
                          onClick={() => form.setVatType(option.value)}
                        >
                          {VAT_SEGMENT_LABEL[option.value](form.vatRate)}
                        </button>
                      );
                    })}
                  </div>
                  <span id="pr-vat-hint" className="ka-help">
                    {form.unregistered
                      ? 'ผู้จำหน่ายไม่ได้จดทะเบียน VAT ระบบบันทึกเป็นไม่คิด VAT'
                      : form.vatType === form.orderVat
                        ? 'ตามใบสั่งซื้อ'
                        : `ใบสั่งซื้อใช้ “${VAT_TYPE_LABELS[form.orderVat]}”`}
                  </span>
                </div>
              </div>
              <div className="ka-field">
                <label htmlFor={fieldId.detail} className="ka-label">หมายเหตุ</label>
                <textarea
                  id={fieldId.detail}
                  className="ka-textarea"
                  rows={3}
                  value={form.detail}
                  placeholder="เช่น เลขใบส่งของ สภาพสินค้า (ไม่บังคับ)"
                  onChange={(event) => form.setDetail(event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="ka-card ka-po-clip" aria-labelledby={fieldId.lines}>
            <div className="ka-po-chd">
              <div>
                <h2 id={fieldId.lines} className="ka-po-h2" tabIndex={-1}>รายการที่รับ</h2>
                <p className="ka-po-cap">จากใบสั่งซื้อ · ใส่ 0 สำหรับรายการที่ยังไม่มา</p>
              </div>
              {form.lines.length > 0 && (
                <button type="button" className="ka-btn ka-btn--sm" onClick={form.fillAll}>
                  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                  รับครบทุกรายการ
                </button>
              )}
            </div>
            {form.errors.lines && (
              <p className="ka-po-cp ka-pr-lines-err">
                <span id={`${fieldId.lines}-error`} className="ka-error">{form.errors.lines}</span>
              </p>
            )}
            {form.lines.length === 0 ? (
              <p className="ka-po-cp ka-po-cap">ใบสั่งซื้อนี้รับครบทุกรายการแล้ว ไม่มีรายการที่ยังรับได้</p>
            ) : (
              <div className="ka-pr-rcv" role="group" aria-labelledby={fieldId.lines}>
                <div className="ka-pr-rh" aria-hidden="true">
                  <span>วัตถุดิบ</span>
                  <span className="ka-po-r">สั่ง</span>
                  <span className="ka-po-r">รับแล้ว</span>
                  <span className="ka-po-r">คงเหลือ</span>
                  <span className="ka-pr-c">รับครั้งนี้</span>
                  <span className="ka-po-r">รวม (บาท)</span>
                </div>
                {form.lines.map((line) => {
                  const qtyKey = `line-${line.key}-qty`;
                  const priceKey = `line-${line.key}-price`;
                  const over = form.overBy(line);
                  const qtyId = fieldId.line(line.key, 'qty');
                  const unit = line.unitName || 'หน่วย';
                  return (
                    <div key={line.key} className="ka-pr-rl" role="group" aria-label={line.name}>
                      <div className="ka-pr-c--m">
                        <span className="ka-pr-rl__name">{line.name}</span>
                        <span className="ka-pr-price">
                          <label htmlFor={fieldId.line(line.key, 'price')} className="ka-po-cap">
                            ฿
                          </label>
                          <input
                            id={fieldId.line(line.key, 'price')}
                            className="ka-input ka-pr-price__in numeric"
                            inputMode="decimal"
                            autoComplete="off"
                            value={line.price}
                            onChange={(event) => form.setPrice(line.key, event.target.value)}
                            aria-label={`ราคาต่อ${unit} ${line.name}`}
                            aria-invalid={form.errors[priceKey] ? true : undefined}
                            aria-describedby={described(form.errors[priceKey] && `${fieldId.line(line.key, 'price')}-error`)}
                          />
                          <span className="ka-po-cap">/ {unit}</span>
                        </span>
                        {err(priceKey)}
                      </div>
                      <div className="ka-pr-c--o ka-po-r numeric">
                        <span className="ka-pr-lab">สั่ง</span>
                        {line.ordered.toLocaleString('th-TH')}
                      </div>
                      <div className="ka-pr-c--g ka-po-r numeric">
                        <span className="ka-pr-lab">รับแล้ว</span>
                        {line.received.toLocaleString('th-TH')}
                      </div>
                      <div className="ka-pr-c--l ka-po-r numeric">
                        <span className="ka-pr-lab">คงเหลือ</span>
                        <b>{line.remaining.toLocaleString('th-TH')}</b>
                      </div>
                      <div className="ka-pr-c--q">
                        <label htmlFor={qtyId} className="ka-pr-lab">รับครั้งนี้</label>
                        <div className={`ka-pr-step${over > 0 || form.errors[qtyKey] ? ' ka-pr-step--err' : ''}`}>
                          <button type="button" onClick={() => form.stepQty(line.key, -1)} aria-label={`ลดจำนวนรับ ${line.name}`} disabled={(Number(line.qty) || 0) <= 0}>
                            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" d="M6 12h12" />
                            </svg>
                          </button>
                          <input
                            id={qtyId}
                            className="numeric"
                            inputMode="numeric"
                            autoComplete="off"
                            value={line.qty}
                            onChange={(event) => form.setQty(line.key, event.target.value)}
                            onKeyDown={onQtyKey(line)}
                            onFocus={(event) => event.target.select()}
                            aria-label={`รับครั้งนี้ ${line.name} (คงเหลือ ${line.remaining} ${unit})`}
                            aria-invalid={over > 0 || form.errors[qtyKey] ? true : undefined}
                            aria-describedby={described(over > 0 && `${qtyId}-over`, form.errors[qtyKey] && `${qtyId}-error`)}
                          />
                          <button type="button" onClick={() => form.stepQty(line.key, 1)} aria-label={`เพิ่มจำนวนรับ ${line.name}`}>
                            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" d="M12 6v12M6 12h12" />
                            </svg>
                          </button>
                        </div>
                        <div className="ka-pr-step__foot">
                          {over > 0 ? (
                            <span id={`${qtyId}-over`} className="ka-error">เกินคงเหลือ {over.toLocaleString('th-TH')}</span>
                          ) : form.errors[qtyKey] ? (
                            err(qtyKey)
                          ) : (
                            <span />
                          )}
                          <button type="button" className="ka-pr-fill" onClick={() => form.fillLine(line.key)} aria-label={`ใส่คงเหลือ ${line.remaining} ${unit} ให้ ${line.name}`}>
                            ใส่คงเหลือ
                          </button>
                        </div>
                      </div>
                      <div className="ka-pr-c--t ka-po-r numeric">
                        <span className="ka-pr-lab">รวม</span>
                        <span className="ka-pr-rl__sum">{formatMoney(form.amountOf(line))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="ka-po-aside" aria-label="สรุปการรับและการบันทึก">
          <section className="ka-card ka-po-cp ka-po-sum" aria-labelledby="pr-sum-title">
            <h2 id="pr-sum-title" className="ka-po-h2">สรุปการรับ</h2>
            <div className="ka-po-sum__l">
              <span>จำนวนที่รับ</span>
              <span className="numeric">{form.receivedCount > 0 ? form.totalText : '0'}</span>
            </div>
            <div className="ka-po-sum__l">
              <span>ยอดก่อน VAT</span>
              <span className="numeric">{formatBaht(form.vatSummary.subtotal)}</span>
            </div>
            <div className="ka-po-sum__l">
              <span>{vatLine.label}</span>
              <span className="numeric">{vatLine.value}</span>
            </div>
            <div className="ka-po-sum__g">
              <span>ยอดรวม</span>
              <output className="ka-po-big numeric" aria-live="polite">
                {formatBaht(form.vatSummary.total)}
              </output>
            </div>
            <div id="pr-outcome" className={`ka-banner ${outcome.tone} ka-pr-outcome`} role="status">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" />
              </svg>
              <span>{outcome.text}</span>
            </div>
            <div className="ka-po-sum__acts">
              {saveButton}
              <button type="button" className="ka-btn" onClick={cancel} disabled={form.saving}>
                ยกเลิก
              </button>
            </div>
          </section>
        </aside>
      </div>

      <div className="ka-po-savebar">
        <div className="ka-po-savebar__sum">
          <span className="ka-po-cap numeric">รับ {form.receivedCount > 0 ? form.totalText : '0'}</span>
          <span className="ka-po-savebar__v numeric">{formatBaht(form.vatSummary.total)}</span>
        </div>
        {saveButton}
      </div>

      <ConfirmDialog
        isOpen={guard.asking}
        title="ยังไม่ได้บันทึกการแก้ไข"
        message="ถ้าออกตอนนี้ จำนวนและข้อมูลที่กรอกไว้จะหายไป"
        confirmLabel="ทิ้งการแก้ไข"
        cancelLabel="แก้ไขต่อ"
        onCancel={guard.stay}
        onConfirm={guard.confirm}
      />
    </form>
  );
}
