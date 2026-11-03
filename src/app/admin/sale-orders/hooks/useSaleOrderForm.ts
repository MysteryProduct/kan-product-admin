'use client';

import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import axiosInstance from '@/lib/axios';
import SaleOrderModel from '@/models/sale-order';
import type { FetchSaleOrder, SaleOrder } from '@/types/sale-order';
import useVatRate from '@/hooks/useVatRate';
import { calculateVatSummary, type VatType } from '@/lib/vat';
import { getApiErrorMessage } from '@/lib/api-error';
import { buildSaleOrderBody } from '../lib/so-body';

const saleOrderModel = new SaleOrderModel();

export type SoFormMode = 'create' | 'edit';

/** One line as typed: the quantity and price stay text so a half-typed number is never rewritten. */
export interface SoLineDraft {
  key: string;
  fetch_sale_order_id: string;
  job_order_id: string;
  product_name: string;
  qty: string;
  price: string;
  cost: number;
  /** What can be sold: the ready-to-sell quantity, or the line's own quantity when editing. */
  max: number;
}

export function parseQty(text: string): number | null {
  return /^\d+$/.test(text) ? Number(text) : null;
}

export function parsePrice(text: string): number | null {
  return /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : null;
}

/**
 * What the field keeps of a typed or pasted value: spaces go, nothing else is rewritten. A letter or a second
 * dot stays in the box so the field can say what is wrong, instead of "1.5" quietly becoming 15.
 */
export function cleanNumberInput(text: string): string {
  return text.replace(/\s/g, '');
}

export function lineAmount(line: SoLineDraft): number {
  return (parseQty(line.qty) ?? 0) * (parsePrice(line.price) ?? 0);
}

const newKey = () => crypto.randomUUID();

export function lineFromReady(item: FetchSaleOrder): SoLineDraft {
  return {
    key: newKey(),
    fetch_sale_order_id: item.fetch_sale_order_id,
    job_order_id: item.job_order_id,
    product_name: item.fetch_sale_order_name,
    qty: String(Number(item.fetch_sale_order_qty || 0)),
    price: String(Number(item.fetch_sale_order_price || 0)),
    cost: Number(item.fetch_sale_order_cost || 0),
    max: Number(item.fetch_sale_order_qty || 0),
  };
}

function linesFromOrder(source: SaleOrder): SoLineDraft[] {
  return (source.saleOrderLists ?? []).map((line) => ({
    key: newKey(),
    fetch_sale_order_id: line.fetch_sale_order_id ?? '',
    job_order_id: line.job_order_id ?? '',
    product_name: line.product_name,
    qty: String(Number(line.sale_order_list_qty || 0)),
    price: String(Number(line.sale_order_list_price || 0)),
    cost: Number(line.sale_order_list_cost || 0),
    max: Number(line.sale_order_list_qty || 0),
  }));
}

interface Options {
  mode: SoFormMode;
  /** The order being edited. */
  source?: SaleOrder | null;
  /** Ready-to-sell goods to start from (`?ready=a,b`). */
  readyIds?: string[];
}

/** Everything the create and edit pages share: the typed values, the sums, the checks and the save. */
export function useSaleOrderForm({ mode, source, readyIds = [] }: Options) {
  const settingsVatRate = useVatRate();
  // An edited order is recalculated by the API at the rate it was saved with and keeps its shipping.
  const vatRate = source?.vat_rate !== undefined && source?.vat_rate !== null ? Number(source.vat_rate) : settingsVatRate;
  const shippingFee = Number(source?.sale_order_shipping_fee ?? 0);

  const initial = useMemo(
    () => ({
      name: source?.sale_order_name ?? '',
      // An edited order keeps its type (a store order stays a store order, as the old update dialog sent it).
      type: source?.sale_order_type ?? 'order',
      vatType: (source?.vat_type ?? 'none') as VatType,
      address: source?.shipping_address_name ?? '',
      detail: source?.sale_order_detail ?? '',
    }),
    [source],
  );

  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [vatType, setVatType] = useState<VatType>(initial.vatType);
  const [address, setAddress] = useState(initial.address);
  const [detail, setDetail] = useState(initial.detail);
  const [lines, setLines] = useState<SoLineDraft[]>(() => (source ? linesFromOrder(source) : []));
  // Errors show once a save was tried; a quantity above what can be sold shows at once.
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [loadingReady, setLoadingReady] = useState(readyIds.length > 0);
  // What the form held once it was ready; `dirty` is anything different from it.
  const [baseline, setBaseline] = useState<string | null>(null);

  // Goods chosen on the list (`?ready=`) are fetched once; one that has gone is skipped and reported.
  const readyKey = readyIds.join(',');
  useEffect(() => {
    if (mode !== 'create' || readyIds.length === 0) return;
    let active = true;
    Promise.all(
      readyIds.map((id) =>
        axiosInstance
          .get<FetchSaleOrder | { data: FetchSaleOrder }>(`/fetch-sale-order/${id}`)
          .then((response) => {
            const body = response.data;
            const item = body && 'data' in body ? body.data : (body as FetchSaleOrder);
            return item?.fetch_sale_order_id ? item : null;
          })
          .catch(() => null),
      ),
    ).then((items) => {
      if (!active) return;
      const found = items.filter((item): item is FetchSaleOrder => item !== null);
      setLines(found.map(lineFromReady));
      setSkipped(readyIds.filter((_, index) => items[index] === null));
      setLoadingReady(false);
    });
    return () => {
      active = false;
    };
    // The ids are read once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, readyKey]);

  const snapshot = JSON.stringify([name, type, vatType, address, detail, lines.map((line) => [line.fetch_sale_order_id, line.qty, line.price])]);
  if (baseline === null && !loadingReady) setBaseline(snapshot);
  const dirty = baseline !== null && snapshot !== baseline;

  const itemsTotal = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const vatSummary = useMemo(() => calculateVatSummary(itemsTotal + shippingFee, vatType, vatRate), [itemsTotal, shippingFee, vatType, vatRate]);

  const { all: allErrors, exceeded } = useMemo(() => {
    const all: Record<string, string> = {};
    const exceeded: Record<string, string> = {};
    if (!name.trim()) all.name = 'กรุณากรอกชื่อใบสั่งขาย';
    if (lines.length === 0) all.lines = 'เพิ่มสินค้าอย่างน้อย 1 รายการ';
    lines.forEach((line, index) => {
      const qty = parseQty(line.qty);
      const price = parsePrice(line.price);
      const label = `รายการที่ ${index + 1}`;
      if (qty === null || qty < 1) all[`line-${line.key}-qty`] = `${label}: จำนวนต้องเป็นเลขจำนวนเต็มตั้งแต่ 1`;
      else if (line.max > 0 && qty > line.max) {
        exceeded[`line-${line.key}-qty`] = `${label}: เกินจำนวนพร้อมขาย ${line.max.toLocaleString('th-TH')} ชิ้น`;
        all[`line-${line.key}-qty`] = exceeded[`line-${line.key}-qty`];
      }
      if (price === null) all[`line-${line.key}-price`] = `${label}: ราคาต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง`;
    });
    return { all, exceeded };
  }, [name, lines]);
  const errors = attempted ? allErrors : exceeded;

  /** Marks that a save was tried, so every error shows; returns them. */
  const validate = (): Record<string, string> => {
    setAttempted(true);
    return allErrors;
  };

  const setQty = (key: string, value: string) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, qty: value } : line)));
  const setPrice = (key: string, value: string) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, price: value } : line)));
  const removeLine = (key: string) => setLines((current) => current.filter((line) => line.key !== key));
  const addReady = (items: FetchSaleOrder[]) =>
    setLines((current) => {
      const have = new Set(current.map((line) => line.fetch_sale_order_id).filter(Boolean));
      return [...current, ...items.filter((item) => !have.has(item.fetch_sale_order_id)).map(lineFromReady)];
    });

  /** Saves the order; returns it, or null when the API said no (`saveError` then says why). */
  const submit = async (): Promise<SaleOrder | null> => {
    if (saving) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      const body = buildSaleOrderBody(
        { name, detail, address, type, vatType },
        lines.map((line) => ({
          fetch_sale_order_id: line.fetch_sale_order_id,
          product_name: line.product_name,
          qty: parseQty(line.qty) ?? 0,
          price: parsePrice(line.price) ?? 0,
          cost: line.cost,
          job_order_id: line.job_order_id,
        })),
        shippingFee,
        vatRate,
      );
      // On success the form stays "saving" while the page moves to the order: turning the leave guard back
      // on here would push a new history entry for the form, and back from the order would land on it again.
      if (mode === 'edit' && source) {
        return await saleOrderModel.updateSaleOrder({
          ...body,
          sale_order_id: source.sale_order_id,
          create_by: source.create_by,
          update_by: user.employee_id,
        });
      }
      return await saleOrderModel.createSaleOrder({ ...body, create_by: user.employee_id });
    } catch (error) {
      // Everything typed stays; the page shows this above the form.
      setSaveError(`บันทึกไม่สำเร็จ ${getApiErrorMessage(error)} ข้อมูลที่กรอกยังอยู่ ลองอีกครั้งได้`);
      setSaving(false);
      return null;
    }
  };

  return {
    name, setName, type, setType, vatType, setVatType, address, setAddress, detail, setDetail,
    lines, setQty, setPrice, removeLine, addReady,
    errors, validate, saving, saveError, submit, dirty,
    vatRate, vatSummary, itemsTotal, shippingFee, skipped, loadingReady,
  };
}
