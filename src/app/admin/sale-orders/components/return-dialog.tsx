'use client';

import { useId, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import SaleOrderModel from '@/models/sale-order';
import type { SaleOrder } from '@/types/sale-order';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatBaht, orderLines, returnableQty, variantText } from '../lib/so-display';

const saleOrderModel = new SaleOrderModel();

interface Props {
  order: SaleOrder;
  onClose: () => void;
  /** After the return was saved; the page reloads the order and shows its own message. */
  onReturned: (refund: number) => void;
}

/** Whole quantity: digits only, empty is not a number (the line is simply not returned). */
function parseQty(text: string): number | null {
  if (text === '') return 0;
  return /^\d+$/.test(text) ? Number(text) : null;
}

/**
 * "คืนสินค้า": the quantity to take back for each line that was sold. The reference is made once when the
 * dialog opens, so pressing the button twice, or retrying after a timeout, is one return and not two.
 */
export default function ReturnDialog({ order, onClose, onReturned }: Props) {
  const [reference] = useState(() => crypto.randomUUID());
  const idBase = useId();
  const lines = useMemo(() => orderLines(order).filter((line) => returnableQty(line) > 0 && line.sale_order_list_id), [order]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // What the API refunds: price × quantity, with VAT added on top of an excluded-VAT price.
  const factor = order.vat_type === 'exclude' ? 1 + (Number(order.vat_rate) || 0) / 100 : 1;

  const rows = lines.map((line) => {
    const key = line.sale_order_list_id as string;
    const text = qty[key] ?? '';
    const value = parseQty(text);
    const max = returnableQty(line);
    let problem: string | null = null;
    if (value === null) problem = 'กรอกจำนวนเป็นเลขจำนวนเต็ม';
    else if (value > max) problem = `คืนได้ไม่เกิน ${max.toLocaleString('th-TH')} ชิ้น`;
    return { line, key, text, value: value ?? 0, max, problem };
  });
  const chosen = rows.filter((row) => row.value > 0 && !row.problem);
  const refund = chosen.reduce((sum, row) => sum + row.value * Number(row.line.sale_order_list_price) * factor, 0);
  const invalid = rows.some((row) => row.problem);
  const nothing = chosen.length === 0;

  const submit = async () => {
    setTouched(true);
    if (invalid || nothing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saleOrderModel.returnSaleOrderItems(
        order.sale_order_id,
        reference,
        chosen.map((row) => ({ sale_order_list_id: row.key, quantity: row.value })),
      );
      onReturned(Math.round(refund * 100) / 100);
    } catch (failure) {
      // The quantities stay as typed so the person can fix them or try again.
      setError(`คืนสินค้าไม่สำเร็จ ${getApiErrorMessage(failure)} ข้อมูลที่กรอกยังอยู่ ลองอีกครั้งได้`);
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy) onClose();
      }}
      title={`คืนสินค้า ${order.sale_order_code ?? ''}`}
      description="เลือกจำนวนที่ลูกค้าส่งคืน สินค้าจะกลับเข้าสต็อกและบันทึกยอดคืนเงิน"
      size="list"
      guardUnsaved
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      footer={
        <>
          <button type="button" className="ka-btn" onClick={onClose} disabled={busy}>ไม่คืน</button>
          <button type="button" className="ka-btn ka-btn--primary min-h-11" onClick={() => void submit()} disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'กำลังบันทึก…' : 'ยืนยันคืนสินค้า'}
          </button>
        </>
      }
    >
      {error && (
        <div role="alert" className="ka-banner ka-banner--danger" style={{ marginBottom: 12 }}>
          <span>{error}</span>
        </div>
      )}
      {touched && nothing && !invalid && (
        <div role="alert" className="ka-banner ka-banner--danger" style={{ marginBottom: 12 }}>
          <span>เลือกจำนวนที่จะคืนอย่างน้อย 1 รายการ</span>
        </div>
      )}
      <ul className="ka-so-ret">
        {rows.map((row, index) => {
          const id = `${idBase}-${index}`;
          return (
            <li key={row.key}>
              <div>
                <p className="ka-so-strong" style={{ margin: 0 }}>{row.line.product_name}</p>
                <p className="ka-so-cap">
                  {[variantText(row.line), `ขาย ${Number(row.line.sale_order_list_qty).toLocaleString('th-TH')}`, `คืนแล้ว ${Number(row.line.returned_qty ?? 0).toLocaleString('th-TH')}`, `คืนได้ ${row.max.toLocaleString('th-TH')}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="ka-field">
                <label htmlFor={id} className="ka-label">จำนวนที่คืน</label>
                <input
                  id={id}
                  className="ka-input"
                  inputMode="numeric"
                  autoComplete="off"
                  value={row.text}
                  placeholder="0"
                  disabled={busy}
                  aria-invalid={row.problem ? true : undefined}
                  aria-describedby={row.problem ? `${id}-error` : undefined}
                  onChange={(event) => setQty((current) => ({ ...current, [row.key]: event.target.value.replace(/\s/g, '') }))}
                />
                {row.problem && <span id={`${id}-error`} className="ka-error">{row.problem}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="ka-so-ret__sum" style={{ marginTop: 12 }}>
        <span>ยอดคืนเงินโดยประมาณ</span>
        <span className="numeric">{formatBaht(Math.round(refund * 100) / 100)}</span>
      </p>
      <p className="ka-so-cap" style={{ marginTop: 6 }}>ระบบคำนวณยอดคืนเงินจริงจากราคาและ VAT ของใบนี้ และไม่เกินยอดที่รับไว้</p>
    </Modal>
  );
}
