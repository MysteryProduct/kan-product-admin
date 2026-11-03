'use client';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import CustomSelect from '@/components/CustomSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { useToast } from '@/components/Toast';
import SaleOrderModel from '@/models/sale-order';
import type { FetchSaleOrder, SaleOrder } from '@/types/sale-order';
import type { PaginationMeta } from '@/types/pagination';
import { usePageCrumb } from '@/lib/page-crumb';
import { VAT_TYPE_OPTIONS, type VatType } from '@/lib/vat';
import { useLeaveGuard } from '../../purchase-orders/hooks/useLeaveGuard';
import {
  cleanNumberInput,
  lineAmount,
  parseQty,
  SoFormMode,
  SoLineDraft,
  useSaleOrderForm,
} from '../hooks/useSaleOrderForm';
import { FORM_TYPE_OPTIONS, formatBaht, formatMoney, statusLabel } from '../lib/so-display';

const saleOrderModel = new SaleOrderModel();
const LIST_HREF = '/admin/sale-orders';

const VAT_SEGMENT_LABEL: Record<VatType, (rate: number) => string> = {
  none: () => 'ไม่คิด VAT',
  include: () => 'รวม VAT',
  exclude: (rate) => `แยก VAT ${rate}%`,
};

const fieldId = {
  name: 'so-name',
  type: 'so-type',
  address: 'so-address',
  detail: 'so-detail',
  lines: 'so-lines-add',
  line: (key: string, part: 'qty' | 'price') => `so-${key}-${part}`,
};

function controlIdFor(errorKey: string): string {
  const line = /^line-(.+)-(qty|price)$/.exec(errorKey);
  if (line) return fieldId.line(line[1], line[2] as 'qty' | 'price');
  return fieldId[errorKey as 'name' | 'lines'] ?? errorKey;
}

function focusControl(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

interface Props {
  mode: SoFormMode;
  source?: SaleOrder | null;
  readyIds?: string[];
}

/** The create and edit pages: one form, different starting values and save call. */
export default function SaleOrderFormPage({ mode, source, readyIds }: Props) {
  const toast = useToast();
  const form = useSaleOrderForm({ mode, source, readyIds });
  const [showSummary, setShowSummary] = useState(false);
  const [picking, setPicking] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const guard = useLeaveGuard(form.dirty && !form.saving);

  const editing = mode === 'edit' && source;
  const code = source?.sale_order_code;
  usePageCrumb({ back: { label: 'ใบสั่งขาย', href: LIST_HREF }, current: editing ? code ?? 'แก้ไขใบสั่งขาย' : 'สร้างใบสั่งขาย' });

  // Goods that left the ready list between choosing them and arriving here.
  const notified = useRef(false);
  useEffect(() => {
    if (notified.current || form.skipped.length === 0) return;
    notified.current = true;
    toast({ message: `ข้ามสินค้า ${form.skipped.length} รายการที่ไม่พร้อมขายแล้ว`, tone: 'info' });
  }, [form.skipped, toast]);

  const save = async () => {
    const keys = Object.keys(form.validate());
    if (keys.length > 0) {
      setShowSummary(true);
      requestAnimationFrame(() => {
        summaryRef.current?.focus();
      });
      return;
    }
    const saved = await form.submit();
    if (!saved) return;
    const savedCode = saved.sale_order_code ?? code ?? '';
    toast({ message: editing ? `บันทึกการแก้ไข ${savedCode} แล้ว` : `สร้างใบสั่งขาย ${savedCode} แล้ว`, tone: 'success' });
    guard.replaceWith(`${LIST_HREF}/${saved.sale_order_id ?? source?.sale_order_id}`);
  };

  const cancel = () => guard.leave(editing ? `${LIST_HREF}/${source.sale_order_id}` : LIST_HREF);

  const errorKeys = Object.keys(form.errors);
  const shownErrors = showSummary ? errorKeys : [];

  const onSegmentKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const enabled = VAT_TYPE_OPTIONS.map((option) => option.value);
    const index = enabled.indexOf(form.vatType);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % enabled.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + enabled.length) % enabled.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = enabled.length - 1;
    form.setVatType(enabled[next]);
    document.getElementById(`so-vat-${enabled[next]}`)?.focus();
  };

  const err = (key: string) =>
    form.errors[key] ? (
      <span id={`${controlIdFor(key)}-error`} className="ka-error">
        {form.errors[key]}
      </span>
    ) : null;
  const described = (key: string) => (form.errors[key] ? `${controlIdFor(key)}-error` : undefined);

  const step = (line: SoLineDraft, delta: number) => {
    const current = parseQty(line.qty) ?? 0;
    const max = line.max > 0 ? line.max : Number.MAX_SAFE_INTEGER;
    form.setQty(line.key, String(Math.min(max, Math.max(1, current + delta))));
  };

  const vatLine =
    form.vatType === 'none'
      ? { label: 'VAT', value: 'ไม่คิด' }
      : form.vatType === 'include'
        ? { label: `VAT ${form.vatRate}% (รวมในราคาแล้ว)`, value: formatBaht(form.vatSummary.vatAmount) }
        : { label: `VAT ${form.vatRate}%`, value: formatBaht(form.vatSummary.vatAmount) };

  const saveButton = (
    <button type="submit" className="ka-btn ka-btn--primary" disabled={form.saving || form.loadingReady} aria-busy={form.saving || undefined}>
      {form.saving ? 'กำลังบันทึก…' : editing ? 'บันทึกการแก้ไข' : 'บันทึกใบสั่งขาย'}
    </button>
  );

  const total = form.vatSummary.total;
  const exceeded = form.lines.filter((line) => /เกินจำนวนพร้อมขาย/.test(form.errors[`line-${line.key}-qty`] ?? ''));
  const exceededText =
    exceeded.length > 0
      ? `แก้จำนวน ${exceeded.length} รายการก่อนบันทึก: ${exceeded.map((line) => `${line.product_name} มีพร้อมขาย ${line.max.toLocaleString('th-TH')} ชิ้น`).join(', ')}`
      : null;
  const addIcon = (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );

  return (
    <form
      className="ka-page-body ka-so ka-so-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="ka-so-ph">
        <div className="ka-so-ph__main">
          <h1 className="ka-ph__title">{editing ? `แก้ไข ${code}` : 'สร้างใบสั่งขาย'}</h1>
          <p className="ka-so-ph__sub">
            {editing
              ? `${statusLabel(source.sale_order_status)} · แก้ไขได้จนกว่าจะอนุมัติ`
              : 'กรอกข้อมูล เพิ่มสินค้า แล้วบันทึก ระบบจะจองสินค้าให้ทันที'}
          </p>
        </div>
      </div>

      {shownErrors.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="ka-banner ka-banner--danger ka-so-errors">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          </svg>
          <div>
            <p className="ka-so-errors__title">ยังบันทึกไม่ได้ กรุณาแก้ {shownErrors.length} ช่อง</p>
            <ul className="ka-so-errors__list">
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
        <div role="alert" className="ka-banner ka-banner--danger ka-so-errors">
          <span>{form.saveError}</span>
        </div>
      )}

      <div className="ka-so-grid">
        <div className="ka-so-stack">
          <section className="ka-so-card ka-so-fcard" aria-labelledby="so-doc-title">
            <h2 id="so-doc-title" className="ka-so-h2"><span className="ka-so-step" aria-hidden="true">1</span>ข้อมูลใบสั่งขาย</h2>
            <div className="ka-so-fields">
              <div className="ka-field ka-so-fields__wide">
                <label htmlFor={fieldId.name} className="ka-label">
                  ชื่อใบสั่งขาย <span className="ka-req">*</span>
                </label>
                <input
                  id={fieldId.name}
                  className="ka-input"
                  value={form.name}
                  maxLength={255}
                  placeholder="เช่น ของที่ระลึกงานสัมมนา บจก. สยามเทค"
                  onChange={(event) => form.setName(event.target.value)}
                  aria-invalid={form.errors.name ? true : undefined}
                  aria-describedby={described('name')}
                />
                {err('name')}
              </div>
              <div className="ka-field">
                <span className="ka-label">ประเภท</span>
                <CustomSelect
                  id={fieldId.type}
                  options={FORM_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  value={form.type}
                  onChange={form.setType}
                  aria-label="ประเภทใบสั่งขาย"
                />
              </div>
              <div className="ka-field">
                <span className="ka-label" id="so-vat-label">รูปแบบ VAT</span>
                <div className="ka-so-seg" role="radiogroup" aria-labelledby="so-vat-label" onKeyDown={onSegmentKey}>
                  {VAT_TYPE_OPTIONS.map((option) => {
                    const checked = form.vatType === option.value;
                    return (
                      <button
                        key={option.value}
                        id={`so-vat-${option.value}`}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={checked ? 0 : -1}
                        onClick={() => form.setVatType(option.value)}
                      >
                        {VAT_SEGMENT_LABEL[option.value](form.vatRate)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="ka-field ka-so-fields__half">
                <label htmlFor={fieldId.address} className="ka-label">ที่อยู่จัดส่ง</label>
                <textarea
                  id={fieldId.address}
                  className="ka-textarea ka-so-ta--mid"
                  rows={3}
                  value={form.address}
                  placeholder="กรอกที่อยู่จัดส่ง"
                  autoComplete="street-address"
                  onChange={(event) => form.setAddress(event.target.value)}
                />
              </div>
              <div className="ka-field ka-so-fields__half">
                <label htmlFor={fieldId.detail} className="ka-label">รายละเอียด</label>
                <textarea
                  id={fieldId.detail}
                  className="ka-textarea ka-so-ta--short"
                  rows={3}
                  value={form.detail}
                  placeholder="เช่น กำหนดส่ง หรือวิธีแพ็ก"
                  onChange={(event) => form.setDetail(event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="ka-so-card ka-so-fcard" aria-labelledby="so-lines-title">
            <div className="ka-so-lnhead">
              <h2 id="so-lines-title" className="ka-so-h2"><span className="ka-so-step" aria-hidden="true">2</span>รายการสินค้า</h2>
              <span className="ka-so-count">{form.lines.length} รายการ</span>
            </div>
            <button id={fieldId.lines} type="button" className="ka-so-add ka-so-add--wide" onClick={() => setPicking(true)} aria-describedby={described('lines')}>
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              ค้นหาสินค้าพร้อมขายเพื่อเพิ่ม
            </button>
            <button type="button" className="ka-so-add--phone" onClick={() => setPicking(true)}>
              {addIcon}
              เพิ่มสินค้า
            </button>
            {err('lines')}
            {form.loadingReady && <p className="ka-so-empty-lines" role="status">กำลังโหลดสินค้าที่เลือก…</p>}
            {!form.loadingReady && form.lines.length === 0 && <p className="ka-so-empty-lines">ยังไม่มีสินค้า เลือกจากสินค้าพร้อมขายด้วยช่องด้านบน</p>}
            {form.lines.length > 0 && (
              <div className="ka-so-lines" role="group" aria-labelledby="so-lines-title">
                <div className="ka-so-lh" aria-hidden="true">
                  <span>สินค้า</span>
                  <span>จำนวน</span>
                  <span className="ka-so-num">ราคา/หน่วย</span>
                  <span className="ka-so-num">รวม (บาท)</span>
                  <span />
                </div>
                {form.lines.map((line) => {
                  const qtyId = fieldId.line(line.key, 'qty');
                  const priceId = fieldId.line(line.key, 'price');
                  const qtyKey = `line-${line.key}-qty`;
                  const priceKey = `line-${line.key}-price`;
                  const bad = Boolean(form.errors[qtyKey] || form.errors[priceKey]);
                  return (
                    <div key={line.key} className="ka-so-ln" data-bad={bad || undefined}>
                      <div className="ka-so-ln__m">
                        <b>{line.product_name}</b>
                        {line.max > 0 && <span className="ka-so-cap">พร้อมขาย {line.max.toLocaleString('th-TH')}{line.price ? ` · ฿${line.price}/ชิ้น` : ''}</span>}
                      </div>
                      <div className="ka-so-ln__c ka-so-ln__q">
                        <label className="ka-so-lab" htmlFor={qtyId}>จำนวน</label>
                        <div className="ka-so-stepper" data-bad={form.errors[qtyKey] ? '' : undefined}>
                          <button type="button" aria-label={`ลดจำนวน ${line.product_name}`} onClick={() => step(line, -1)} disabled={(parseQty(line.qty) ?? 0) <= 1}>−</button>
                          <input
                            id={qtyId}
                            inputMode="numeric"
                            autoComplete="off"
                            value={line.qty}
                            aria-invalid={form.errors[qtyKey] ? true : undefined}
                            aria-describedby={described(qtyKey)}
                            onChange={(event) => form.setQty(line.key, cleanNumberInput(event.target.value))}
                          />
                          <button type="button" aria-label={`เพิ่มจำนวน ${line.product_name}`} onClick={() => step(line, 1)} disabled={line.max > 0 && (parseQty(line.qty) ?? 0) >= line.max}>+</button>
                        </div>
                        {err(qtyKey)}
                      </div>
                      <div className="ka-so-ln__c ka-so-ln__p">
                        <label className="ka-so-lab" htmlFor={priceId}>ราคา/หน่วย</label>
                        <input
                          id={priceId}
                          className="ka-input ka-so-num"
                          inputMode="decimal"
                          autoComplete="off"
                          value={line.price}
                          aria-invalid={form.errors[priceKey] ? true : undefined}
                          aria-describedby={described(priceKey)}
                          onChange={(event) => form.setPrice(line.key, cleanNumberInput(event.target.value))}
                        />
                        {err(priceKey)}
                      </div>
                      <div className="ka-so-ln__t">
                        <span className="ka-so-lab">รวม (บาท)</span>
                        {formatMoney(lineAmount(line))}
                      </div>
                      <div className="ka-so-ln__x">
                        <button type="button" className="ka-btn ka-btn--ghost ka-btn--icon" aria-label={`ลบ ${line.product_name}`} onClick={() => form.removeLine(line.key)}>
                          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside aria-labelledby="so-sum-title">
          <section className="ka-so-card ka-so-sum">
            <h2 id="so-sum-title" className="ka-so-h2">สรุปยอด</h2>
            <dl>
              <dt>ยอดสินค้า ({form.lines.length} รายการ)</dt>
              <dd>{formatMoney(form.itemsTotal)}</dd>
              {form.shippingFee > 0 && (
                <>
                  <dt>ค่าจัดส่ง (รวมในราคาแล้ว)</dt>
                  <dd>{formatMoney(form.shippingFee)}</dd>
                </>
              )}
              <dt>ยอดก่อน VAT</dt>
              <dd>{formatMoney(form.vatSummary.subtotal)}</dd>
              <dt>{vatLine.label}</dt>
              <dd>{vatLine.value}</dd>
            </dl>
            <div className="ka-so-net ka-so-sum__net">
              <span>ยอดสุทธิ</span>
              <b aria-live="polite">{formatBaht(total)}</b>
            </div>
            {exceededText && (
              <div className="ka-so-msg" data-tone="danger" role="alert">
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span>{exceededText}</span>
              </div>
            )}
            <div className="ka-so-msg" data-tone="info">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <span>บันทึกแล้วระบบจะจองสินค้าตามจำนวน และตัดสต็อกเมื่ออนุมัติ</span>
            </div>
            <div className="ka-so-sum__acts">
              {saveButton}
              <button type="button" className="ka-btn ka-btn--ghost" onClick={cancel} disabled={form.saving}>ยกเลิก</button>
            </div>
          </section>
        </aside>
      </div>

      <div className="ka-so-savebar" role="region" aria-label="บันทึกใบสั่งขาย">
        <div className="ka-so-savebar__sum">
          <span className="ka-so-cap">ยอดสุทธิ · {form.lines.length} รายการ</span>
          <span className="ka-so-savebar__v">{formatBaht(total)}</span>
        </div>
        {exceeded.length > 0 && <span className="ka-so-savebar__err">แก้จำนวน {exceeded.length} รายการ</span>}
        <span className="ka-so-savebar__sp" />
        <button type="button" className="ka-btn ka-btn--ghost" onClick={cancel} disabled={form.saving}>ยกเลิก</button>
        {saveButton}
      </div>

      {picking && (
        <ReadyPicker
          taken={new Set(form.lines.map((line) => line.fetch_sale_order_id).filter(Boolean))}
          onClose={() => setPicking(false)}
          onAdd={(items) => {
            form.addReady(items);
            setPicking(false);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={guard.asking}
        title="ยังไม่ได้บันทึกการแก้ไข"
        message="ออกจากหน้านี้ตอนนี้ ข้อมูลที่กรอกจะหายไป"
        confirmLabel="ออกโดยไม่บันทึก"
        cancelLabel="อยู่ต่อ"
        onCancel={guard.stay}
        onConfirm={guard.confirm}
      />
    </form>
  );
}

/** Choose ready-to-sell goods to add; ones already on the order are left out. */
function ReadyPicker({ taken, onClose, onAdd }: { taken: Set<string>; onClose: () => void; onAdd: (items: FetchSaleOrder[]) => void }) {
  const [rows, setRows] = useState<FetchSaleOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [loadedKey, setLoadedKey] = useState('');
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Record<string, FetchSaleOrder>>({});
  const key = `${page}|${query}`;
  // Read through a ref so a new Set from the page does not restart the fetch.
  const takenRef = useRef(taken);
  useEffect(() => {
    takenRef.current = taken;
  }, [taken]);

  useEffect(() => {
    let active = true;
    saleOrderModel
      .getFetchSaleOrders(page, 8, query || undefined)
      .then((response) => {
        if (!active) return;
        setRows((response.data ?? []).filter((row) => !takenRef.current.has(row.fetch_sale_order_id)));
        setMeta(response.meta ?? null);
        setFailed(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoadedKey(`${page}|${query}`);
      });
    return () => {
      active = false;
    };
  }, [page, query]);

  const list = Object.values(chosen);
  const loading = loadedKey !== key;
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="เพิ่มสินค้าพร้อมขาย"
      description="เลือกสินค้าที่ผลิตเสร็จแล้ว จำนวนที่ขายได้ไม่เกินจำนวนพร้อมขาย"
      size="list"
      footer={
        <>
          <button type="button" className="ka-btn" onClick={onClose}>ปิด</button>
          <button type="button" className="ka-btn ka-btn--primary min-h-11" disabled={list.length === 0} onClick={() => onAdd(list)}>
            {list.length > 0 ? `เพิ่ม ${list.length.toLocaleString('th-TH')} รายการ` : 'เพิ่มสินค้า'}
          </button>
        </>
      }
    >
      <form
        className="ka-so-rsearch"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(text.trim());
        }}
      >
        <input type="search" className="ka-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="ค้นหาสินค้า" aria-label="ค้นหาสินค้าพร้อมขาย" />
        <button type="submit" className="ka-btn">ค้นหา</button>
      </form>
      {failed && <p role="alert" className="ka-error">โหลดสินค้าพร้อมขายไม่สำเร็จ ลองค้นอีกครั้ง</p>}
      {!failed && !loading && rows.length === 0 && (
        <p className="ka-so-cap">{query ? `ไม่พบสินค้าพร้อมขายที่ตรงกับ “${query}”` : 'ไม่มีสินค้าพร้อมขายเหลือให้เพิ่ม'}</p>
      )}
      <ul className="ka-so-picklist" aria-busy={loading || undefined}>
        {rows.map((row) => (
          <li key={row.fetch_sale_order_id}>
            <label className="ka-so-pickrow">
              <input
                type="checkbox"
                className="ka-check"
                checked={Boolean(chosen[row.fetch_sale_order_id])}
                onChange={() =>
                  setChosen((current) => {
                    const next = { ...current };
                    if (next[row.fetch_sale_order_id]) delete next[row.fetch_sale_order_id];
                    else next[row.fetch_sale_order_id] = row;
                    return next;
                  })
                }
              />
              <span className="ka-so-rc__b">
                <span className="ka-so-rc__n">{row.fetch_sale_order_name}</span>
                {row.jobOrder?.job_order_code && <span className="ka-so-cap">{row.jobOrder.job_order_code}</span>}
                <span className="ka-so-rc__m">
                  <span className="ka-so-ok numeric">พร้อมขาย {Number(row.fetch_sale_order_qty).toLocaleString('th-TH')}</span>
                  <span className="numeric">{formatBaht(Number(row.fetch_sale_order_price))} / ชิ้น</span>
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {meta && meta.last_page > 1 && (
        <div className="ka-so-rpager">
          <Pagination meta={meta} currentPage={page} onPageChange={setPage} />
        </div>
      )}
    </Modal>
  );
}
