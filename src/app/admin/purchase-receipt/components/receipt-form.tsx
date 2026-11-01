'use client';

import Link from 'next/link';
import CustomSelect from '@/components/CustomSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { usePageCrumb } from '@/lib/page-crumb';
import { VAT_TYPE_OPTIONS, VatType } from '@/lib/vat';
import type { PurchaseOrder } from '@/types/purchase-order';
import { useLeaveGuard } from '../../purchase-orders/hooks/useLeaveGuard';
import { formatBaht, formatMoney } from '../../purchase-orders/lib/po-display';
import { ReceiptFormMode, useReceiptForm } from '../hooks/useReceiptForm';
import type { Receipt } from '../lib/pr-display';

const LIST_HREF = '/admin/purchase-receipt';

/** `/new` without `?po=`: the order is picked first. */
export function OrderPicker() {
  usePageCrumb({ back: { label: 'ใบรับสินค้า', href: LIST_HREF }, current: 'รับสินค้า' });
  return (
    <div className="ka-page-body ka-po">
      <h1 className="ka-ph__title">รับสินค้า</h1>
      <p className="ka-po-cap">
        เลือกใบสั่งซื้อที่รอรับสินค้าจาก <Link href={LIST_HREF}>หน้ารายการ</Link>
      </p>
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
  const guard = useLeaveGuard(form.dirty && !form.saving);
  const editing = mode === 'edit' && receipt;
  usePageCrumb({
    back: { label: 'ใบรับสินค้า', href: LIST_HREF },
    current: editing ? receipt.purchase_receipt_code ?? 'แก้ไขใบรับสินค้า' : `รับสินค้า ${order.purchase_order_code}`,
  });

  const save = async () => {
    const saved = await form.submit();
    if (!saved) return;
    toast({ message: `บันทึกใบรับสินค้า ${saved.code ?? ''} แล้ว`, tone: 'success' });
    guard.replaceWith(`${LIST_HREF}/${saved.id}`);
  };

  const cancel = () => guard.leave(editing ? `${LIST_HREF}/${receipt.purchase_receipt_id}` : LIST_HREF);

  return (
    <form
      className="ka-page-body ka-po"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h1 className="ka-ph__title">รับสินค้า</h1>
      {form.saveError && <div role="alert" className="ka-banner ka-banner--danger">{form.saveError}</div>}
      <section className="ka-card ka-po-cp ka-po-fields">
        <label className="ka-field">
          <span className="ka-label">วันที่รับสินค้า</span>
          <input type="date" className="ka-input" value={form.entryDate} onChange={(event) => form.setEntryDate(event.target.value)} />
        </label>
        <div className="ka-field">
          <span className="ka-label">รูปแบบ VAT</span>
          <CustomSelect
            options={VAT_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={form.vatType}
            onChange={(value) => form.setVatType(value as VatType)}
            aria-label="รูปแบบ VAT"
          />
        </div>
        <label className="ka-field">
          <span className="ka-label">หมายเหตุ</span>
          <textarea className="ka-textarea" value={form.detail} onChange={(event) => form.setDetail(event.target.value)} />
        </label>
      </section>
      <section className="ka-card ka-po-cp">
        {form.lines.map((line) => (
          <div key={line.key} className="ka-field">
            <label className="ka-label" htmlFor={`pr-${line.key}-qty`}>
              {line.name} (คงเหลือ {line.remaining})
            </label>
            <input
              id={`pr-${line.key}-qty`}
              className="ka-input"
              inputMode="numeric"
              value={line.qty}
              onChange={(event) => form.setQty(line.key, event.target.value)}
            />
            {form.errors[`line-${line.key}-qty`] && <span className="ka-error">{form.errors[`line-${line.key}-qty`]}</span>}
            <span className="numeric">{formatMoney(form.amountOf(line))}</span>
          </div>
        ))}
        {form.errors.lines && <span className="ka-error">{form.errors.lines}</span>}
      </section>
      <section className="ka-card ka-po-cp">
        <p className="numeric">ยอดรวม {formatBaht(form.vatSummary.total)}</p>
        <button type="submit" className="ka-btn ka-btn--primary" disabled={form.saving}>บันทึกใบรับสินค้า</button>
        <button type="button" className="ka-btn" onClick={cancel}>ยกเลิก</button>
      </section>
      <ConfirmDialog
        isOpen={guard.asking}
        title="ยังไม่ได้บันทึกการแก้ไข"
        message="ถ้าออกตอนนี้ จำนวนที่กรอกไว้จะหายไป"
        confirmLabel="ทิ้งการแก้ไข"
        cancelLabel="แก้ไขต่อ"
        onCancel={guard.stay}
        onConfirm={guard.confirm}
      />
    </form>
  );
}
