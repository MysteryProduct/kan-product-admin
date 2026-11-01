'use client';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import CustomSelect, { SelectOption } from '@/components/CustomSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import { useToast } from '@/components/Toast';
import { formatThaiDate } from '@/lib/date-format';
import { usePageCrumb } from '@/lib/page-crumb';
import { VAT_TYPE_LABELS, VAT_TYPE_OPTIONS, VatType } from '@/lib/vat';
import type { PurchaseOrder } from '@/types/purchase-order';
import {
  cleanNumberInput,
  lineAmount,
  PoFormMode,
  PoLineDraft,
  usePurchaseOrderForm,
} from '../hooks/usePurchaseOrderForm';
import { useLeaveGuard } from '../hooks/useLeaveGuard';
import { formatBaht, formatMoney, statusLabel } from '../lib/po-display';

const LIST_HREF = '/admin/purchase-orders';

// The segmented control's wording for VAT_TYPE_OPTIONS (same values, shorter labels).
const VAT_SEGMENT_LABEL: Record<VatType, (rate: number) => string> = {
  none: () => 'ไม่คิด VAT',
  include: () => 'ราคารวม VAT',
  exclude: (rate) => `แยก VAT ${rate}%`,
};

const fieldId = {
  name: 'po-name',
  supplier: 'po-supplier',
  detail: 'po-detail',
  line: (key: string, part: 'material' | 'qty' | 'unit' | 'price') => `po-${key}-${part}`,
};

/** Element id of the control an error key belongs to, for the summary's links. */
function controlIdFor(errorKey: string): string {
  const line = /^line-(.+)-(material|qty|unit|price)$/.exec(errorKey);
  if (line) return fieldId.line(line[1], line[2] as 'material' | 'qty' | 'unit' | 'price');
  return fieldId[errorKey as 'name' | 'supplier' | 'detail'] ?? errorKey;
}

function focusControl(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

interface Props {
  mode: PoFormMode;
  source?: PurchaseOrder | null;
}

/** The create and edit pages: one form, different starting values and save call. */
export default function PurchaseOrderFormPage({ mode, source }: Props) {
  const toast = useToast();
  const form = usePurchaseOrderForm({ mode, source });
  // The error summary appears after a rejected save and lists what is still wrong.
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusAfterAdd = useRef<string | null>(null);
  const guard = useLeaveGuard(form.dirty && !form.saving);

  const editing = mode === 'edit' && source;
  const code = source?.purchase_order_code;
  usePageCrumb({ back: { label: 'ใบสั่งซื้อ', href: LIST_HREF }, current: editing ? code ?? 'แก้ไขใบสั่งซื้อ' : 'สร้างใบสั่งซื้อ' });

  // A new line takes focus on its material once it is on the page.
  useEffect(() => {
    if (!focusAfterAdd.current) return;
    const id = fieldId.line(focusAfterAdd.current, 'material');
    focusAfterAdd.current = null;
    document.getElementById(id)?.focus();
  }, [form.lines.length]);

  const save = async () => {
    const keys = Object.keys(form.validate());
    if (keys.length > 0) {
      setShowSummary(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const saved = await form.submit();
    if (!saved) return;
    const savedCode = saved.purchase_order_code ?? code ?? '';
    toast({ message: editing ? `บันทึกการแก้ไข ${savedCode} แล้ว` : `สร้างใบสั่งซื้อ ${savedCode} แล้ว`, tone: 'success' });
    // The order's page takes the form's place in history, so back goes to where the form was opened from.
    guard.replaceWith(`${LIST_HREF}/${saved.purchase_order_id ?? source?.purchase_order_id}`);
  };

  const cancel = () => guard.leave(editing ? `${LIST_HREF}/${source.purchase_order_id}` : LIST_HREF);

  const errorKeys = Object.keys(form.errors);
  const shownErrors = showSummary ? errorKeys : [];

  const supplierOptions: SelectOption[] = form.suppliers.map((supplier) => ({ value: supplier.supplier_id, label: supplier.supplier_name }));
  if (form.supplier && !supplierOptions.some((option) => option.value === form.supplier?.supplier_id)) {
    supplierOptions.unshift({ value: form.supplier.supplier_id, label: form.supplier.supplier_name });
  }
  const unitOptions: SelectOption[] = Array.from(form.units.values()).map((unit) => ({ value: String(unit.product_unit_id), label: unit.product_unit_name }));

  const materialOptionsFor = (line: PoLineDraft): SelectOption[] => {
    const usedAt = new Map<string, number>();
    form.lines.forEach((other, index) => other.key !== line.key && other.material_id && usedAt.set(other.material_id, index + 1));
    return Array.from(form.materials.values()).map((material) => {
      const at = usedAt.get(material.material_id);
      return {
        value: material.material_id,
        label: at ? `${material.material_name} · อยู่ในรายการ ${at} แล้ว` : material.material_name,
        disabled: Boolean(at),
      };
    });
  };

  const unregistered = form.supplier?.is_vat_register === false;
  const vatHint = !form.supplier
    ? 'เลือกผู้จำหน่ายเพื่อดูค่าเริ่มต้น VAT'
    : unregistered
      ? 'ผู้จำหน่ายนี้ไม่ได้จดทะเบียน VAT ระบบบันทึกเป็นไม่คิด VAT'
      : form.supplierDefaultVat
        ? `ค่าเริ่มต้น VAT ของผู้จำหน่ายนี้: ${VAT_TYPE_LABELS[form.supplierDefaultVat]}`
        : null;

  const vatLine =
    form.vatType === 'none'
      ? { label: 'VAT', value: 'ไม่คิด' }
      : form.vatType === 'include'
        ? { label: `VAT ${form.vatRate}% (รวมในราคาแล้ว)`, value: formatBaht(form.vatSummary.vatAmount) }
        : { label: `VAT ${form.vatRate}%`, value: formatBaht(form.vatSummary.vatAmount) };

  const today = formatThaiDate(new Date());
  const createdOn = editing ? formatThaiDate(source.purchase_date) : today;

  const onSegmentKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const enabled = VAT_TYPE_OPTIONS.map((option) => option.value).filter((value) => !(unregistered && value !== 'none'));
    const index = enabled.indexOf(form.vatType);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % enabled.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + enabled.length) % enabled.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = enabled.length - 1;
    form.setVatType(enabled[next]);
    document.getElementById(`po-vat-${enabled[next]}`)?.focus();
  };

  const err = (key: string) =>
    form.errors[key] ? (
      <span id={`${controlIdFor(key)}-error`} className="ka-error">
        {form.errors[key]}
      </span>
    ) : null;
  const described = (key: string) => (form.errors[key] ? `${controlIdFor(key)}-error` : undefined);

  const saveLabel = editing ? 'บันทึกการแก้ไข' : 'บันทึกและส่งอนุมัติ';
  const saveButton = (
    <button type="submit" className="ka-btn ka-btn--primary" disabled={form.saving} aria-busy={form.saving || undefined}>
      {form.saving ? 'กำลังบันทึก…' : saveLabel}
    </button>
  );

  return (
    <form
      className="ka-page-body ka-po ka-po-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="ka-po-ph">
        <div className="ka-po-ph__main">
          <h1 className="ka-ph__title">{editing ? `แก้ไข ${code}` : 'สร้างใบสั่งซื้อ'}</h1>
          <p className="ka-po-cap">
            {editing
              ? `${statusLabel(source.purchase_order_status)} · แก้ไขได้จนกว่าจะอนุมัติ`
              : form.copying
                ? `สั่งซ้ำจาก ${code} · เลข PO จะออกให้อัตโนมัติเมื่อบันทึก`
                : 'เลข PO จะออกให้อัตโนมัติเมื่อบันทึก'}
          </p>
        </div>
      </div>

      {shownErrors.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="ka-banner ka-banner--danger ka-po-errors">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          </svg>
          <div>
            <p className="ka-po-errors__title">ยังบันทึกไม่ได้ กรุณาแก้ {shownErrors.length} ช่อง</p>
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
      <LoadErrorBanner message={form.loadErrors.suppliers ?? null} onRetry={() => void form.fetchSuppliers('')} className="mb-4" />
      <LoadErrorBanner message={form.loadErrors.materials ?? null} onRetry={() => void form.fetchMaterials('')} className="mb-4" />
      <LoadErrorBanner message={form.loadErrors.units ?? null} onRetry={() => void form.fetchUnits('')} className="mb-4" />

      <div className="ka-po-grid">
        <div className="ka-po-stack">
          <section className="ka-card" aria-labelledby="po-doc-title">
            <div className="ka-po-chd">
              <h2 id="po-doc-title" className="ka-po-h2">ข้อมูลเอกสาร</h2>
            </div>
            <div className="ka-po-cp ka-po-fields">
              <div className="ka-field">
                <label htmlFor={fieldId.name} className="ka-label">
                  ชื่อใบสั่งซื้อ <span className="ka-req">*</span>
                </label>
                <input
                  id={fieldId.name}
                  className="ka-input"
                  value={form.name}
                  maxLength={255}
                  placeholder="เช่น สั่งฝาปิดใส 20 ออนซ์ ล็อต พ.ย."
                  onChange={(event) => form.setName(event.target.value)}
                  aria-invalid={form.errors.name ? true : undefined}
                  aria-describedby={described('name')}
                />
                {err('name')}
              </div>

              <div className="ka-po-g2">
                <div className="ka-field">
                  <span className="ka-label" id="po-supplier-label">
                    ผู้จำหน่าย <span className="ka-req">*</span>
                  </span>
                  <CustomSelect
                    id={fieldId.supplier}
                    options={supplierOptions}
                    value={form.supplierId}
                    onChange={form.setSupplierId}
                    fetchData={(query) => void form.fetchSuppliers(query)}
                    placeholder="เลือกผู้จำหน่าย"
                    aria-label="ผู้จำหน่าย"
                    aria-invalid={Boolean(form.errors.supplier)}
                    aria-describedby={[described('supplier'), vatHint ? 'po-supplier-vat' : undefined].filter(Boolean).join(' ') || undefined}
                  />
                  {vatHint && (
                    <span id="po-supplier-vat" className="ka-help">
                      {vatHint}
                    </span>
                  )}
                  {err('supplier')}
                </div>
                <div className="ka-field">
                  <span className="ka-label">วันที่สร้าง</span>
                  <span className="ka-po-ro">
                    {createdOn}
                    {!editing && <span className="ka-po-cap"> (วันนี้)</span>}
                  </span>
                </div>
              </div>

              <div className="ka-field">
                <span className="ka-label" id="po-vat-label">
                  รูปแบบ VAT
                </span>
                <div className="ka-po-seg" role="radiogroup" aria-labelledby="po-vat-label" onKeyDown={onSegmentKey}>
                  {VAT_TYPE_OPTIONS.map((option) => {
                    const checked = form.vatType === option.value;
                    const disabled = unregistered && option.value !== 'none';
                    return (
                      <button
                        key={option.value}
                        id={`po-vat-${option.value}`}
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
              </div>

              <div className="ka-field">
                <label htmlFor={fieldId.detail} className="ka-label">
                  รายละเอียด <span className="ka-req">*</span>
                </label>
                <textarea
                  id={fieldId.detail}
                  className="ka-textarea"
                  rows={3}
                  value={form.detail}
                  placeholder="เหตุผลการสั่ง หรือเงื่อนไขส่งของ"
                  onChange={(event) => form.setDetail(event.target.value)}
                  aria-invalid={form.errors.detail ? true : undefined}
                  aria-describedby={described('detail')}
                />
                {err('detail')}
              </div>
            </div>
          </section>

          <section className="ka-card ka-po-clip" aria-labelledby="po-lines-title">
            <div className="ka-po-chd">
              <h2 id="po-lines-title" className="ka-po-h2">รายการวัตถุดิบ</h2>
              <span className="ka-po-cap numeric">{form.lines.length} รายการ</span>
            </div>
            <div className="ka-po-lines" role="group" aria-labelledby="po-lines-title">
              <div className="ka-po-lh" aria-hidden="true">
                <span>#</span>
                <span>วัตถุดิบ</span>
                <span className="ka-po-r">จำนวน</span>
                <span>หน่วย</span>
                <span className="ka-po-r">ราคา/หน่วย (บาท)</span>
                <span className="ka-po-r">รวม (บาท)</span>
                <span />
              </div>
              {form.lines.map((line, index) => {
                const n = index + 1;
                const k = (part: 'material' | 'qty' | 'unit' | 'price') => `line-${line.key}-${part}`;
                return (
                  <div key={line.key} className="ka-po-ln" role="group" aria-label={`รายการที่ ${n}`}>
                    <span className="ka-po-idx numeric" aria-hidden="true">{n}</span>
                    <div className="ka-po-c ka-po-c--m">
                      <span className="ka-po-lab" aria-hidden="true">วัตถุดิบ</span>
                      <CustomSelect
                        id={fieldId.line(line.key, 'material')}
                        options={materialOptionsFor(line)}
                        value={line.material_id}
                        onChange={(value) => form.updateLine(line.key, 'material_id', value)}
                        fetchData={(query) => void form.fetchMaterials(query)}
                        placeholder="เลือกวัตถุดิบ"
                        aria-label={`วัตถุดิบ รายการที่ ${n}`}
                        aria-invalid={Boolean(form.errors[k('material')])}
                        aria-describedby={described(k('material'))}
                      />
                      {err(k('material'))}
                    </div>
                    <div className="ka-po-c ka-po-c--q">
                      <label htmlFor={fieldId.line(line.key, 'qty')} className="ka-po-lab">จำนวน</label>
                      <input
                        id={fieldId.line(line.key, 'qty')}
                        className="ka-input ka-po-num"
                        inputMode="numeric"
                        autoComplete="off"
                        value={line.qty}
                        onChange={(event) => form.updateLine(line.key, 'qty', cleanNumberInput(event.target.value, false))}
                        aria-label={`จำนวน รายการที่ ${n}`}
                        aria-invalid={form.errors[k('qty')] ? true : undefined}
                        aria-describedby={described(k('qty'))}
                      />
                      {err(k('qty'))}
                    </div>
                    <div className="ka-po-c ka-po-c--u">
                      <span className="ka-po-lab" aria-hidden="true">หน่วย</span>
                      <CustomSelect
                        id={fieldId.line(line.key, 'unit')}
                        options={unitOptions}
                        value={line.product_unit_id}
                        onChange={(value) => form.updateLine(line.key, 'product_unit_id', value)}
                        fetchData={(query) => void form.fetchUnits(query)}
                        placeholder="เลือกหน่วย"
                        aria-label={`หน่วย รายการที่ ${n}`}
                        aria-invalid={Boolean(form.errors[k('unit')])}
                        aria-describedby={described(k('unit'))}
                      />
                      {err(k('unit'))}
                    </div>
                    <div className="ka-po-c ka-po-c--p">
                      <label htmlFor={fieldId.line(line.key, 'price')} className="ka-po-lab">ราคา/หน่วย (บาท)</label>
                      <input
                        id={fieldId.line(line.key, 'price')}
                        className="ka-input ka-po-num"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        value={line.price}
                        onChange={(event) => form.updateLine(line.key, 'price', cleanNumberInput(event.target.value, true))}
                        aria-label={`ราคาต่อหน่วย รายการที่ ${n}`}
                        aria-invalid={form.errors[k('price')] ? true : undefined}
                        aria-describedby={described(k('price'))}
                      />
                      {err(k('price'))}
                    </div>
                    <div className="ka-po-c ka-po-c--t">
                      <span className="ka-po-lab">รวม (บาท)</span>
                      <output className="ka-po-ltot numeric" aria-label={`รวม รายการที่ ${n}`}>
                        {formatMoney(lineAmount(line))}
                      </output>
                    </div>
                    <button
                      type="button"
                      className="ka-btn ka-btn--ghost ka-btn--icon ka-po-c--x"
                      aria-label={`ลบรายการที่ ${n}`}
                      title={form.lines.length > 1 ? `ลบรายการที่ ${n}` : 'ต้องมีอย่างน้อย 1 รายการ'}
                      disabled={form.lines.length <= 1}
                      onClick={() => {
                        const nextFocus = form.lines[index + 1] ?? form.lines[index - 1];
                        form.removeLine(line.key);
                        if (nextFocus) requestAnimationFrame(() => document.getElementById(fieldId.line(nextFocus.key, 'material'))?.focus());
                      }}
                    >
                      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="ka-po-addl"
                onClick={() => {
                  focusAfterAdd.current = form.addLine().key;
                }}
              >
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
                เพิ่มรายการวัตถุดิบ
              </button>
            </div>
          </section>
        </div>

        <aside className="ka-po-aside" aria-label="สรุปยอดและการบันทึก">
          <section className="ka-card ka-po-cp ka-po-sum" aria-labelledby="po-sum-title">
            <h2 id="po-sum-title" className="ka-po-h2">สรุปยอด</h2>
            <div className="ka-po-sum__l">
              <span>ยอดก่อน VAT</span>
              <span className="numeric">{formatBaht(form.vatSummary.subtotal)}</span>
            </div>
            <div className="ka-po-sum__l">
              <span>{vatLine.label}</span>
              <span className="numeric">{vatLine.value}</span>
            </div>
            <div className="ka-po-sum__g">
              <span>ยอดรวมทั้งสิ้น</span>
              <output className="ka-po-big numeric" aria-live="polite">
                {formatBaht(form.vatSummary.total)}
              </output>
            </div>
            <div className="ka-po-sum__acts">
              {saveButton}
              <button type="button" className="ka-btn" onClick={cancel} disabled={form.saving}>
                ยกเลิก
              </button>
            </div>
          </section>
          <section className="ka-card ka-po-cp ka-po-next" aria-labelledby="po-next-title">
            <h2 id="po-next-title" className="ka-po-next__t">ขั้นต่อไป</h2>
            <p>
              {editing
                ? `หลังบันทึก ใบสั่งซื้อยังอยู่สถานะ “${statusLabel(source.purchase_order_status)}” จนกว่าจะ${source.purchase_order_status === 'draft' ? 'ส่งอนุมัติ' : 'อนุมัติ'}`
                : 'หลังบันทึก ใบสั่งซื้อจะอยู่สถานะ “รออนุมัติ” เมื่ออนุมัติแล้วจึงเปิดใบรับสินค้าได้'}
            </p>
          </section>
        </aside>
      </div>

      <div className="ka-po-savebar">
        <div className="ka-po-savebar__sum">
          <span className="ka-po-cap">ยอดรวม</span>
          <span className="ka-po-savebar__v numeric">{formatBaht(form.vatSummary.total)}</span>
        </div>
        {saveButton}
      </div>

      <ConfirmDialog
        isOpen={guard.asking}
        title="ยังไม่ได้บันทึกการแก้ไข"
        message={`ถ้าออกตอนนี้ ข้อมูล${form.name.trim() ? ` “${form.name.trim()}”` : ''} ที่กรอกไว้จะหายไป`}
        confirmLabel="ทิ้งการแก้ไข"
        cancelLabel="แก้ไขต่อ"
        onCancel={guard.stay}
        onConfirm={guard.confirm}
      />
    </form>
  );
}
