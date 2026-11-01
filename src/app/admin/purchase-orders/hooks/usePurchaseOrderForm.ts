'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import MaterialModel from '@/models/material';
import PurchaseOrderModel from '@/models/purchase-order';
import { ProductUnitModel } from '@/models/product-unit';
import SupplierModel from '@/models/supplier';
import useVatRate from '@/hooks/useVatRate';
import { loadErrorText } from '@/components/LoadErrorBanner';
import { calculateVatSummary, VatType } from '@/lib/vat';
import type { Material } from '@/types/material';
import type { PurchaseOrder } from '@/types/purchase-order';
import type { SupplierWithPayment } from '@/types/supplier';
import { orderLines } from '../lib/po-display';

const materialModel = new MaterialModel();
const purchaseOrderModel = new PurchaseOrderModel();
const productUnitModel = new ProductUnitModel();
const supplierModel = new SupplierModel();

/** One editable line. Quantity and price stay as typed until they are saved. */
export interface PoLineDraft {
  key: string;
  material_id: string;
  product_unit_id: string;
  qty: string;
  price: string;
}

/** The API stores whether the supplier is VAT registered; an unregistered one is always saved without VAT. */
export type FormSupplier = SupplierWithPayment & { is_vat_register?: boolean };

interface ProductUnitOption {
  product_unit_id: number;
  product_unit_name: string;
}

export type PoFormMode = 'create' | 'edit';

interface Options {
  mode: PoFormMode;
  /** The order being edited, or the order to copy for "สั่งซ้ำ". */
  source?: PurchaseOrder | null;
}

const newLine = (): PoLineDraft => ({
  key: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  material_id: '',
  product_unit_id: '',
  qty: '1',
  price: '',
});

// Whole-string parsing: "12abc" or "1e3" is not a number here.
const QTY_PATTERN = /^\d+$/;
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

export function parseQty(text: string): number | null {
  const value = text.trim();
  return QTY_PATTERN.test(value) ? Number(value) : null;
}

export function parsePrice(text: string): number | null {
  const value = text.trim().replace(/,/g, '');
  return PRICE_PATTERN.test(value) ? Number(value) : null;
}

/** Keeps only what a quantity (digits) or a price (digits and one dot) can contain. */
export function cleanNumberInput(text: string, decimals: boolean): string {
  const digits = text.replace(decimals ? /[^\d.]/g : /\D/g, '');
  if (!decimals) return digits;
  const [whole, ...rest] = digits.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
}

export function lineAmount(line: PoLineDraft): number {
  const qty = parseQty(line.qty) ?? 0;
  const price = parsePrice(line.price) ?? 0;
  return qty * price;
}

function sourceLines(source: PurchaseOrder | null | undefined): PoLineDraft[] {
  const lines = source ? orderLines(source) : [];
  if (lines.length === 0) return [newLine()];
  return lines.map((line) => ({
    ...newLine(),
    material_id: line.material_id,
    product_unit_id: line.product_unit_id ? String(line.product_unit_id) : '',
    qty: String(line.purchase_order_list_qty ?? ''),
    // The API returns numeric columns as text ('10.00').
    price: line.purchase_order_list_price !== undefined ? String(Number(line.purchase_order_list_price)) : '',
  }));
}

export type PoFieldErrors = Record<string, string>;

/** State, lookups, totals, validation and saving shared by the create and edit pages. */
export function usePurchaseOrderForm({ mode, source }: Options) {
  const vatRate = useVatRate();
  const copying = mode === 'create' && Boolean(source);

  const [name, setNameState] = useState(() => (source ? `${source.purchase_order_name}${copying ? ' (สั่งซ้ำ)' : ''}` : ''));
  const [detail, setDetailState] = useState(() => source?.purchase_order_detail ?? '');
  const [supplierId, setSupplierIdState] = useState(() => source?.supplier_id || source?.supplier?.supplier_id || '');
  const [vatType, setVatTypeState] = useState<VatType>(() => source?.vat_type || 'none');
  // A VAT the user picked, or one an existing order already has, is never replaced by the supplier default.
  const [vatChosen, setVatChosen] = useState(Boolean(source));
  const [lines, setLines] = useState<PoLineDraft[]>(() => sourceLines(source));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<PoFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [units, setUnits] = useState<ProductUnitOption[]>([]);
  const [suppliers, setSuppliers] = useState<FormSupplier[]>([]);
  const [loadErrors, setLoadErrors] = useState<{ materials?: string; units?: string; suppliers?: string }>({});

  const fetchMaterials = useCallback(async (search: string) => {
    try {
      setLoadErrors((current) => ({ ...current, materials: undefined }));
      const response = await materialModel.getMaterials(1, 100, search);
      setMaterials(response.data);
    } catch (error) {
      setLoadErrors((current) => ({ ...current, materials: loadErrorText('วัตถุดิบ', error) }));
    }
  }, []);

  const fetchUnits = useCallback(async (search: string) => {
    try {
      setLoadErrors((current) => ({ ...current, units: undefined }));
      const response = await productUnitModel.getAllProductUnits(search);
      setUnits(response.data);
    } catch (error) {
      setLoadErrors((current) => ({ ...current, units: loadErrorText('หน่วยสินค้า', error) }));
    }
  }, []);

  const fetchSuppliers = useCallback(async (search: string) => {
    try {
      setLoadErrors((current) => ({ ...current, suppliers: undefined }));
      const response = await supplierModel.getSuppliers(1, 100, search);
      setSuppliers(response.data as FormSupplier[]);
    } catch (error) {
      setLoadErrors((current) => ({ ...current, suppliers: loadErrorText('ผู้จัดจำหน่าย', error) }));
    }
  }, []);

  useEffect(() => {
    void fetchMaterials('');
    void fetchUnits('');
    void fetchSuppliers('');
  }, [fetchMaterials, fetchUnits, fetchSuppliers]);

  // Options for what the source order already uses, in case the first 100 of a lookup leave them out.
  const knownMaterials = useMemo(() => {
    const byId = new Map<string, { material_id: string; material_name: string; material_price: number }>();
    (source ? orderLines(source) : []).forEach((line) => line.material && byId.set(line.material_id, line.material));
    materials.forEach((material) => byId.set(material.material_id, material));
    return byId;
  }, [materials, source]);

  const knownUnits = useMemo(() => {
    const byId = new Map<string, ProductUnitOption>();
    (source ? orderLines(source) : []).forEach((line) => line.productUnit && byId.set(String(line.productUnit.product_unit_id), line.productUnit));
    units.forEach((unit) => byId.set(String(unit.product_unit_id), unit));
    return byId;
  }, [units, source]);

  const supplier: FormSupplier | null = useMemo(() => {
    const listed = suppliers.find((item) => item.supplier_id === supplierId);
    if (listed) return listed;
    if (source?.supplier && source.supplier.supplier_id === supplierId) return source.supplier as FormSupplier;
    return null;
  }, [suppliers, supplierId, source]);

  /** The VAT the API saves for this supplier when the form leaves it alone, if known. */
  const supplierDefaultVat: VatType | null = supplier?.vat_type
    ? supplier.vat_type
    : supplier?.is_vat_register === false
      ? 'none'
      : supplier?.is_vat_register === true
        ? 'exclude'
        : null;

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

  const setName = (value: string) => {
    touch();
    clearError('name');
    setNameState(value);
  };

  const setDetail = (value: string) => {
    touch();
    clearError('detail');
    setDetailState(value);
  };

  const setSupplierId = (value: string) => {
    touch();
    clearError('supplier');
    setSupplierIdState(value);
    const picked = suppliers.find((item) => item.supplier_id === value);
    const pickedDefault = picked?.vat_type ?? (picked?.is_vat_register === false ? 'none' : picked?.is_vat_register === true ? 'exclude' : null);
    // An unregistered supplier is always saved without VAT by the API, so the form follows it.
    if (picked?.is_vat_register === false) setVatTypeState('none');
    else if (!vatChosen && pickedDefault) setVatTypeState(pickedDefault);
  };

  const setVatType = (value: VatType) => {
    touch();
    setVatChosen(true);
    setVatTypeState(value);
  };

  const addLine = (): PoLineDraft => {
    touch();
    const line = newLine();
    setLines((current) => [...current, line]);
    return line;
  };

  const removeLine = (key: string) => {
    touch();
    setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith(`line-${key}-`))));
  };

  const updateLine = (key: string, field: 'material_id' | 'product_unit_id' | 'qty' | 'price', value: string) => {
    touch();
    clearError(`line-${key}-${field === 'material_id' ? 'material' : field === 'product_unit_id' ? 'unit' : field}`);
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, [field]: value };
        if (field === 'material_id' && !line.price.trim()) {
          const material = knownMaterials.get(value);
          if (material && Number(material.material_price) > 0) next.price = String(Number(material.material_price));
        }
        return next;
      }),
    );
  };

  const baseAmount = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const vatSummary = calculateVatSummary(baseAmount, vatType, vatRate);

  const validate = (): PoFieldErrors => {
    const next: PoFieldErrors = {};
    if (!name.trim()) next.name = 'กรุณากรอกชื่อใบสั่งซื้อ';
    if (!supplierId) next.supplier = 'กรุณาเลือกผู้จำหน่าย';
    if (!detail.trim()) next.detail = 'กรุณากรอกรายละเอียด';
    const used = new Map<string, number>();
    lines.forEach((line) => line.material_id && used.set(line.material_id, (used.get(line.material_id) ?? 0) + 1));
    lines.forEach((line, index) => {
      const at = `รายการที่ ${index + 1}`;
      if (!line.material_id) next[`line-${line.key}-material`] = `${at}: กรุณาเลือกวัตถุดิบ`;
      else if ((used.get(line.material_id) ?? 0) > 1) next[`line-${line.key}-material`] = `${at}: วัตถุดิบซ้ำกับรายการอื่น`;
      const qty = parseQty(line.qty);
      if (line.qty.trim() === '') next[`line-${line.key}-qty`] = `${at}: กรุณากรอกจำนวน`;
      else if (qty === null) next[`line-${line.key}-qty`] = `${at}: จำนวนสั่งซื้อต้องเป็นจำนวนเต็ม`;
      else if (qty < 1) next[`line-${line.key}-qty`] = `${at}: จำนวนต้องมากกว่า 0`;
      const price = parsePrice(line.price);
      if (line.price.trim() === '') next[`line-${line.key}-price`] = `${at}: กรุณากรอกราคาต่อหน่วย`;
      else if (price === null) next[`line-${line.key}-price`] = `${at}: ราคาเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง`;
      else if (price <= 0) next[`line-${line.key}-price`] = `${at}: ราคาต้องมากกว่า 0`;
      if (!line.product_unit_id) next[`line-${line.key}-unit`] = `${at}: กรุณาเลือกหน่วย`;
    });
    setErrors(next);
    return next;
  };

  /** Saves with the same body the old dialogs sent; returns the saved order, or null when it did not save. */
  const submit = async (): Promise<PurchaseOrder | null> => {
    if (saving) return null;
    if (Object.keys(validate()).length > 0) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      const purchaseOrderLists = lines.map((line) => {
        const qty = parseQty(line.qty) ?? 0;
        const price = parsePrice(line.price) ?? 0;
        return {
          material_id: line.material_id,
          purchase_order_list_qty: qty,
          purchase_order_list_price: price,
          purchase_order_list_total: qty * price,
          product_unit_id: Number(line.product_unit_id) || 0,
        };
      });
      const common = {
        purchase_order_name: name,
        purchase_order_detail: detail,
        supplier_id: supplierId,
        vat_type: vatType,
        purchase_order_subtotal: vatSummary.subtotal,
        purchase_order_vat_amount: vatSummary.vatAmount,
      };
      const saved =
        mode === 'edit' && source
          ? await purchaseOrderModel.updatePurchaseOrder({
              purchase_order_id: source.purchase_order_id,
              ...common,
              update_by: user.employee_id,
              purchase_order_total: vatSummary.total,
              purchaseOrderLists,
            })
          : await purchaseOrderModel.createPurchaseOrder({
              ...common,
              create_by: user.employee_id,
              purchase_order_total: vatSummary.total,
              purchaseOrderLists,
            });
      setDirty(false);
      return saved;
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const text = Array.isArray(message) ? message.join(' ') : message || (error instanceof Error ? error.message : '');
      setSaveError(`บันทึกไม่สำเร็จ ${text || 'ลองอีกครั้ง'} ข้อมูลที่กรอกยังอยู่`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return {
    mode,
    copying,
    vatRate,
    name,
    detail,
    supplierId,
    supplier,
    supplierDefaultVat,
    vatType,
    lines,
    dirty,
    errors,
    saving,
    saveError,
    materials: knownMaterials,
    units: knownUnits,
    suppliers,
    loadErrors,
    fetchMaterials,
    fetchUnits,
    fetchSuppliers,
    setName,
    setDetail,
    setSupplierId,
    setVatType,
    addLine,
    removeLine,
    updateLine,
    vatSummary,
    validate,
    submit,
  };
}

export type PurchaseOrderForm = ReturnType<typeof usePurchaseOrderForm>;
