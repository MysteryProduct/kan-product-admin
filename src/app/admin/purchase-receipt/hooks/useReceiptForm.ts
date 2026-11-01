'use client';

import { useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import axiosInstance from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { todayLocalIso, toDateInputValue } from '@/lib/date-format';
import useVatRate from '@/hooks/useVatRate';
import { calculateVatSummary, VatType } from '@/lib/vat';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import type { PurchaseOrder } from '@/types/purchase-order';
import type { CreatePurchaseReceiptDto, PurchaseReceipt } from '@/types/purchase-receipt';
import { cleanNumberInput, parsePrice, parseQty } from '../../purchase-orders/hooks/usePurchaseOrderForm';
import { orderLines } from '../../purchase-orders/lib/po-display';
import { quantityText, Receipt, receiptLines, receiptVatRate } from '../lib/pr-display';

const purchaseReceiptModel = new PurchaseReceiptModel();

export { cleanNumberInput };

export type ReceiptFormMode = 'create' | 'edit';

/** One line of the order, with how much is still open and how much this receipt takes. */
export interface ReceiptLineDraft {
  /** `purchase_order_list_id` as text, also used for element ids. */
  key: string;
  purchaseOrderListId: string;
  materialId: string;
  name: string;
  unitId: number;
  unitName: string;
  ordered: number;
  /** Received by other receipts. */
  received: number;
  /** The most this receipt may take: the order's balance, plus what this receipt took before when editing. */
  remaining: number;
  /** As typed. */
  qty: string;
  price: string;
}

/** The API stores whether the supplier is VAT registered; an unregistered one is always saved without VAT. */
type OrderWithVat = PurchaseOrder & {
  vat_rate?: number | string | null;
  supplier?: PurchaseOrder['supplier'] & { is_vat_register?: boolean };
};

interface Options {
  mode: ReceiptFormMode;
  order: PurchaseOrder;
  /** The pending receipt being edited. */
  receipt?: Receipt | null;
}

export type ReceiptFieldErrors = Record<string, string>;

function buildLines(order: PurchaseOrder, receipt: Receipt | null | undefined, mode: ReceiptFormMode): ReceiptLineDraft[] {
  const own = new Map<string, { qty: number; price: number }>();
  (receipt ? receiptLines(receipt) : []).forEach((line) => {
    const key = String(line.purchase_order_list_id);
    const before = own.get(key);
    own.set(key, { qty: (before?.qty ?? 0) + (Number(line.purchase_receipt_list_qty) || 0), price: Number(line.purchase_receipt_list_price) || 0 });
  });
  return orderLines(order)
    .map((line) => {
      const key = String(line.purchase_order_list_id);
      const ordered = Number(line.purchase_order_list_qty) || 0;
      const balance = Number(line.purchase_order_list_balance_qty ?? ordered) || 0;
      const mine = own.get(key);
      const remaining = balance + (mine?.qty ?? 0);
      return {
        key,
        purchaseOrderListId: key,
        materialId: line.material?.material_id || line.material_id,
        name: line.material?.material_name ?? '-',
        unitId: Number(line.productUnit?.product_unit_id ?? line.product_unit_id) || 0,
        unitName: line.productUnit?.product_unit_name ?? '',
        ordered,
        received: Math.max(0, ordered - remaining),
        remaining,
        // A new receipt starts every line at 0: count what arrived (TASK-0325 Q1).
        qty: mode === 'edit' ? String(mine?.qty ?? 0) : '0',
        // The numeric columns come back as text ('95.00').
        price: String(Number(mine?.price ?? line.purchase_order_list_price) || 0),
      };
    })
    .filter((line) => line.remaining > 0);
}

/** State, totals, validation and saving shared by the receive and edit pages. */
export function useReceiptForm({ mode, order, receipt }: Options) {
  const settingsRate = useVatRate();
  const source = order as OrderWithVat;
  const unregistered = source.supplier?.is_vat_register === false;

  const [entryDate, setEntryDateState] = useState(() =>
    mode === 'edit' && receipt ? toDateInputValue(receipt.entry_date) : todayLocalIso(),
  );
  const [detail, setDetailState] = useState(() => (mode === 'edit' ? receipt?.purchase_receipt_detail ?? '' : ''));
  const orderVat: VatType = unregistered ? 'none' : source.vat_type || source.supplier?.vat_type || 'none';
  const [vatType, setVatTypeState] = useState<VatType>(() => (mode === 'edit' && receipt?.vat_type ? receipt.vat_type : orderVat));
  const [lines, setLines] = useState<ReceiptLineDraft[]>(() => buildLines(order, receipt, mode));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<ReceiptFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The API saves the order's rate (or the one already on the receipt), so the totals use it too.
  const vatRate = useMemo(() => {
    if (mode === 'edit' && receipt) return receiptVatRate(receipt, settingsRate);
    const rate = Number(source.vat_rate);
    return source.vat_rate !== null && source.vat_rate !== undefined && Number.isFinite(rate) && rate > 0 ? rate : settingsRate;
  }, [mode, receipt, source.vat_rate, settingsRate]);

  const touch = () => {
    setDirty(true);
    setSaveError(null);
  };

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const setEntryDate = (value: string) => {
    touch();
    clearError('date');
    setEntryDateState(value);
  };

  const setDetail = (value: string) => {
    touch();
    setDetailState(value);
  };

  const setVatType = (value: VatType) => {
    if (unregistered && value !== 'none') return;
    touch();
    setVatTypeState(value);
  };

  const setQty = (key: string, value: string) => {
    touch();
    clearError(`line-${key}-qty`);
    clearError('lines');
    setLines((current) => current.map((line) => (line.key === key ? { ...line, qty: cleanNumberInput(value, false) } : line)));
  };

  const setPrice = (key: string, value: string) => {
    touch();
    clearError(`line-${key}-price`);
    setLines((current) => current.map((line) => (line.key === key ? { ...line, price: cleanNumberInput(value, true) } : line)));
  };

  /** − / + buttons and arrow keys; never below 0. */
  const stepQty = (key: string, delta: number) => {
    const line = lines.find((item) => item.key === key);
    if (!line) return;
    setQty(key, String(Math.max(0, (parseQty(line.qty) ?? 0) + delta)));
  };

  const fillLine = (key: string) => {
    const line = lines.find((item) => item.key === key);
    if (line) setQty(key, String(line.remaining));
  };

  const fillAll = () => {
    touch();
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !field.endsWith('-qty') && field !== 'lines')));
    setLines((current) => current.map((line) => ({ ...line, qty: String(line.remaining) })));
  };

  const qtyOf = (line: ReceiptLineDraft) => parseQty(line.qty) ?? 0;
  const amountOf = (line: ReceiptLineDraft) => qtyOf(line) * (parsePrice(line.price) ?? 0);
  const overBy = (line: ReceiptLineDraft) => Math.max(0, qtyOf(line) - line.remaining);

  const taken = lines.filter((line) => qtyOf(line) > 0);
  const baseAmount = lines.reduce((sum, line) => sum + amountOf(line), 0);
  const vatSummary = calculateVatSummary(baseAmount, vatType, vatRate);
  const anyOver = lines.some((line) => overBy(line) > 0);
  const allFull = lines.length > 0 && lines.every((line) => qtyOf(line) === line.remaining);
  const totalText = quantityText(
    taken.map((line) => ({ qty: qtyOf(line), unitName: line.unitName || null })),
    new Map(),
  );

  /** What saving would do to the order, for the summary box. */
  const outcome: 'empty' | 'over' | 'full' | 'partial' = anyOver ? 'over' : taken.length === 0 ? 'empty' : allFull ? 'full' : 'partial';

  const validate = (): ReceiptFieldErrors => {
    const next: ReceiptFieldErrors = {};
    if (!entryDate) next.date = 'กรุณาเลือกวันที่รับสินค้า';
    lines.forEach((line) => {
      const qty = parseQty(line.qty);
      if (line.qty.trim() === '') next[`line-${line.key}-qty`] = `${line.name}: กรอกจำนวนที่รับ (ใส่ 0 ถ้ายังไม่มา)`;
      else if (qty === null) next[`line-${line.key}-qty`] = `${line.name}: จำนวนรับต้องเป็นจำนวนเต็ม`;
      else if (qty > line.remaining) next[`line-${line.key}-qty`] = `${line.name}: เกินคงเหลือ ${(qty - line.remaining).toLocaleString('th-TH')}`;
      if (qty && qty > 0) {
        const price = parsePrice(line.price);
        if (line.price.trim() === '' || price === null) next[`line-${line.key}-price`] = `${line.name}: ราคาเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง`;
      }
    });
    if (!Object.keys(next).some((key) => key.endsWith('-qty')) && lines.every((line) => (parseQty(line.qty) ?? 0) === 0)) {
      next.lines = lines.length === 0 ? 'ใบสั่งซื้อนี้ไม่มีรายการที่ยังรับได้' : 'ยังไม่ได้ใส่จำนวนที่รับ';
    }
    setErrors(next);
    return next;
  };

  /** Saves with the body the old dialogs sent, lines received this time only. Returns the receipt id and code. */
  const submit = async (): Promise<{ id: string; code?: string } | null> => {
    if (saving) return null;
    if (Object.keys(validate()).length > 0) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      // A line sent with 0 would mark the order line as partly received, so only lines with a quantity go.
      const purchaseReceiptLists = taken.map((line) => {
        const qty = qtyOf(line);
        const price = parsePrice(line.price) ?? 0;
        return {
          material_id: line.materialId,
          purchase_order_list_id: line.purchaseOrderListId,
          purchase_receipt_list_qty: qty,
          purchase_receipt_list_price: price,
          purchase_receipt_list_total: qty * price,
          product_unit_id: line.unitId,
        };
      });
      const common = {
        entry_date: entryDate,
        purchase_receipt_detail: detail,
        vat_type: vatType,
        purchase_receipt_subtotal: vatSummary.subtotal,
        purchase_receipt_vat_amount: vatSummary.vatAmount,
        purchase_receipt_total: vatSummary.total,
        purchaseReceiptLists,
      };
      if (mode === 'edit' && receipt) {
        await purchaseReceiptModel.updatePurchaseReceipt({
          purchase_receipt_id: receipt.purchase_receipt_id,
          purchase_order_id: receipt.purchase_order_id,
          supplier_id: receipt.supplier_id,
          ...common,
          update_by: user.employee_id,
          create_by: receipt.create_by,
        });
        setDirty(false);
        return { id: receipt.purchase_receipt_id, code: receipt.purchase_receipt_code };
      }
      const body: CreatePurchaseReceiptDto = {
        purchase_order_id: order.purchase_order_id,
        supplier_id: order.supplier_id || order.supplier?.supplier_id || '',
        ...common,
        create_by: user.employee_id,
      };
      // Same endpoint and body as PurchaseReceiptModel.createPurchaseReceipt; the API answers with the
      // receipt itself (not wrapped in `data`), and the new page needs its id.
      const response = await axiosInstance.post<PurchaseReceipt | { data: PurchaseReceipt }>('/purchase-receipt', body);
      const saved = 'data' in response.data ? response.data.data : response.data;
      setDirty(false);
      return { id: saved.purchase_receipt_id, code: saved.purchase_receipt_code };
    } catch (error) {
      setSaveError(`บันทึกไม่สำเร็จ ${getApiErrorMessage(error) || 'ลองอีกครั้ง'} ข้อมูลที่กรอกยังอยู่`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return {
    mode,
    order,
    receipt,
    unregistered,
    orderVat,
    vatRate,
    entryDate,
    detail,
    vatType,
    lines,
    dirty,
    errors,
    saving,
    saveError,
    setEntryDate,
    setDetail,
    setVatType,
    setQty,
    setPrice,
    stepQty,
    fillLine,
    fillAll,
    qtyOf,
    amountOf,
    overBy,
    totalText,
    receivedCount: taken.length,
    vatSummary,
    outcome,
    validate,
    submit,
  };
}

export type ReceiptForm = ReturnType<typeof useReceiptForm>;
