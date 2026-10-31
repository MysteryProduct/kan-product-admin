'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import axios from '@/lib/axios';
import Button from '@/components/Button';
import ConfirmDialog from '@/components/ConfirmDialog';
import Drawer from '@/components/Drawer';
import Popover from '@/components/Popover';
import { useToast } from '@/components/Toast';
import MaterialModel from '@/models/material';
import ProductModel from '@/models/product';
import JobOrderModel from '@/models/job-order';
import ColorModel from '@/models/color';
import SizeModel from '@/models/size';
import type { Material } from '@/types/material';
import type { CreateJobOrderDto, JobOrderType } from '@/types/job-order';
import type { Product } from '@/types/product';
import type { Color } from '@/types/color';
import type { Size } from '@/types/size';
import { formatThaiDate, todayLocalIso } from '@/lib/date-format';
import CustomSelect from '@/components/CustomSelect';

interface MaterialRow {
  id: string;
  material_id: string;
  material_qty: number;
  material_name?: string;
}

interface VariantChoice {
  value: string;
  productName: string;
  productCode?: string;
  sizeId?: number;
  colorId?: number;
  sizeName: string;
  colorName: string;
  colorHex?: string;
  price?: number;
  materials: { material_id: string; material_qty: number; material_name?: string }[];
}

interface CreateJobOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** A job to copy from, or a target date chosen on the calendar. */
  initialData?: Partial<CreateJobOrderDto> | null;
}

const materialModel = new MaterialModel();
const productModel = new ProductModel();
const jobOrderModel = new JobOrderModel();
const colorModel = new ColorModel();
const sizeModel = new SizeModel();

const TYPES: { value: JobOrderType; label: string; hint: string }[] = [
  { value: 'website', label: 'ขายบน Website', hint: 'เติมสต็อกหน้าร้าน' },
  { value: 'purchase', label: 'ตามคำสั่งซื้อ', hint: 'ผูกกับใบขาย' },
  { value: 'custom', label: 'สินค้า Custom', hint: 'จากแบบของลูกค้า ไม่เข้าสต็อกขาย' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);
const newRow = (): MaterialRow => ({ id: crypto.randomUUID(), material_id: '', material_qty: 1 });

const getUser = () => {
  try {
    const raw = Cookies.get('user');
    if (!raw) return null;
    return JSON.parse(raw) as { employee_id?: string; employee_firstname?: string; employee_lastname?: string; employee_fullname?: string; employee_username?: string };
  } catch {
    return null;
  }
};

/** How many days from today to a `YYYY-MM-DD`, in words. */
const daysAway = (date: string) => {
  if (!date) return '';
  const target = new Date(`${date}T00:00:00`);
  const today = new Date(`${todayLocalIso()}T00:00:00`);
  const days = Math.round((target.getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return 'วันนี้';
  if (days > 0) return `อีก ${count(days)} วัน`;
  return `ผ่านมาแล้ว ${count(-days)} วัน`;
};

/** `GET /stock-materials/material/:id` needs the stock-material view permission; without it the form still saves, only the warning is missing. */
const STOCK_FORBIDDEN = -1;

/** Remaining stock of each material, summed over the lots a job can draw from (`available` and `partial`, as the job-order service does). */
async function readStock(ids: string[]): Promise<Map<string, number>> {
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await axios.get<{ stock_material_remain_qty?: number; stock_material_status?: string }[]>(`/stock-materials/material/${id}`);
        const total = (response.data || [])
          .filter((lot) => ['available', 'partial'].includes(lot.stock_material_status || 'available'))
          .reduce((sum, lot) => sum + Number(lot.stock_material_remain_qty || 0), 0);
        return [id, total] as const;
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        return [id, status === 403 ? STOCK_FORBIDDEN : Number.NaN] as const;
      }
    }),
  );
  return new Map(entries);
}

/**
 * The create-job form as a side panel (a bottom sheet on phones). The product, size and colour are one
 * choice; the materials come from that variant's recipe and are multiplied by the quantity, with the stock
 * read for each so a shortage is shown before the job is saved.
 */
export default function CreateJobOrderDrawer({ isOpen, onClose, onSuccess, initialData }: CreateJobOrderDrawerProps) {
  const toast = useToast();
  const user = useMemo(() => getUser(), []);
  const assigneeName = user?.employee_fullname || `${user?.employee_firstname || ''} ${user?.employee_lastname || ''}`.trim() || user?.employee_username || '-';

  const [type, setType] = useState<JobOrderType>('website');
  const [variantId, setVariantId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('0');
  const [targetDate, setTargetDate] = useState(todayLocalIso());
  const [sizeId, setSizeId] = useState('');
  const [colorId, setColorId] = useState('');
  const [rows, setRows] = useState<MaterialRow[]>([newRow()]);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState('');
  const [stock, setStock] = useState<Map<string, number>>(new Map());

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const pickerRef = useRef<HTMLButtonElement>(null);

  const variants = useMemo<VariantChoice[]>(() => {
    const list: VariantChoice[] = [];
    for (const product of products) {
      for (const variant of product.product_variants || product.productVariants || []) {
        if (!variant.product_variant_id) continue;
        list.push({
          value: String(variant.product_variant_id),
          productName: product.product_name,
          productCode: product.product_code,
          sizeId: variant.size_id,
          colorId: variant.color_id,
          sizeName: variant.size?.size_name || '-',
          colorName: variant.color?.color_name || '-',
          colorHex: variant.color?.color_hex,
          price: variant.product_variant_price,
          materials: (variant.product_materials || variant.productMaterials || []).map((item) => ({
            material_id: item.material_id,
            material_qty: Number(item.material_qty) || 1,
            material_name: item.material?.material_name,
          })),
        });
      }
    }
    return list;
  }, [products]);
  const chosen = variants.find((item) => item.value === variantId);

  // Lists load once per opening; a failing list is named and the others still fill.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    (async () => {
      setLoadError('');
      const [m, p, c, s] = await Promise.allSettled([materialModel.getMaterials(1, 300), productModel.getProducts(1, 200), colorModel.getAllColors(), sizeModel.getAllSizes()]);
      if (!active) return;
      if (m.status === 'fulfilled') setMaterials(m.value.data || []);
      if (p.status === 'fulfilled') setProducts(p.value.data || []);
      if (c.status === 'fulfilled') setColors(c.value.data || []);
      if (s.status === 'fulfilled') setSizes(s.value.data || []);
      const failed = [m.status === 'rejected' && 'วัตถุดิบ', p.status === 'rejected' && 'สินค้า', c.status === 'rejected' && 'สี', s.status === 'rejected' && 'ขนาด'].filter(Boolean);
      if (failed.length) setLoadError(`โหลดรายการ${failed.join(', ')}ไม่สำเร็จ ปิดแล้วเปิดใหม่อีกครั้ง`);
    })();
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Reset to the seed each time the panel opens.
  useEffect(() => {
    if (!isOpen) return;
    setType((initialData?.job_order_type as JobOrderType) || 'website');
    setVariantId(initialData?.product_variant_id ? String(initialData.product_variant_id) : '');
    setName(initialData?.job_order_name || '');
    setDescription(initialData?.job_order_description || '');
    setQty(typeof initialData?.job_order_qty === 'number' ? String(initialData.job_order_qty) : '1');
    setPrice(typeof initialData?.job_order_price === 'number' ? String(initialData.job_order_price) : '0');
    setTargetDate(initialData?.target_date ? String(initialData.target_date).slice(0, 10) : todayLocalIso());
    setSizeId(initialData?.size_id ? String(initialData.size_id) : '');
    setColorId(initialData?.color_id ? String(initialData.color_id) : '');
    setRows(initialData?.jobOrderMaterials?.length ? initialData.jobOrderMaterials.map((item) => ({ id: crypto.randomUUID(), material_id: item.material_id, material_qty: Number(item.material_qty) || 1, material_name: item.material_name })) : [newRow()]);
    setErrors({});
    setSaveError('');
    setDirty(false);
    setPickerQuery('');
  }, [isOpen, initialData]);

  // Stock is read for the materials on the form whenever the set changes.
  const materialIds = rows.map((row) => row.material_id).filter(Boolean).join(',');
  useEffect(() => {
    if (!isOpen || !materialIds) return;
    let active = true;
    void readStock(materialIds.split(',')).then((result) => {
      if (active) setStock((prev) => new Map([...prev, ...result]));
    });
    return () => {
      active = false;
    };
  }, [isOpen, materialIds]);

  const touch = () => setDirty(true);

  const pickVariant = (choice: VariantChoice) => {
    touch();
    setVariantId(choice.value);
    setName(`${choice.productName} · ${choice.colorName}`);
    setSizeId(choice.sizeId ? String(choice.sizeId) : '');
    setColorId(choice.colorId ? String(choice.colorId) : '');
    setPrice(choice.price !== undefined && choice.price !== null ? String(choice.price) : '0');
    if (choice.materials.length > 0) setRows(choice.materials.map((item) => ({ id: crypto.randomUUID(), ...item })));
    setPickerOpen(false);
    setPickerQuery('');
  };

  const quantity = Math.max(0, Number(qty) || 0);
  const materialName = (id: string) => materials.find((item) => item.material_id === id);
  const shortages = rows
    .filter((row) => row.material_id)
    .map((row) => {
      const need = row.material_qty * quantity;
      const have = stock.get(row.material_id);
      return { row, need, have, short: have !== undefined && !Number.isNaN(have) && have !== STOCK_FORBIDDEN ? Math.max(0, need - have) : 0 };
    });
  const shortCount = shortages.filter((item) => item.short > 0).length;

  const validate = () => {
    const next: Record<string, string> = {};
    if (type === 'website' && !variantId) next.variant = 'เลือกสินค้าที่ผลิต';
    if (!name.trim()) next.name = 'กรอกชื่องานผลิต';
    if (!qty.trim() || !Number.isInteger(Number(qty)) || Number(qty) < 1) next.qty = 'จำนวนที่ผลิตต้องเป็นจำนวนเต็มอย่างน้อย 1';
    if (!targetDate) next.targetDate = 'เลือกวันที่เป้าหมาย';
    if (!sizeId) next.size = 'เลือกขนาด';
    if (!colorId) next.color = 'เลือกสี';
    if (price.trim() !== '' && (Number.isNaN(Number(price)) || Number(price) < 0)) next.price = 'ราคาต้องเป็นตัวเลข 0 ขึ้นไป';
    const used = rows.filter((row) => row.material_id);
    if (used.length === 0) next.materials = 'เพิ่มวัตถุดิบอย่างน้อย 1 รายการ';
    else if (used.some((row) => !Number.isInteger(row.material_qty) || row.material_qty < 1)) next.materials = 'จำนวนวัตถุดิบต่อชิ้นต้องเป็นจำนวนเต็มอย่างน้อย 1';
    else if (new Set(used.map((row) => row.material_id)).size !== used.length) next.materials = 'มีวัตถุดิบซ้ำ';
    // The API reserves every material when the job is created and refuses a shortfall.
    else if (shortCount > 0) next.materials = 'วัตถุดิบไม่พอสำหรับจอง บันทึกได้เมื่อรับของเข้าแล้ว หรือลดจำนวนที่ผลิต';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    setSaveError('');
    if (!validate()) {
      setSaveError('ยังกรอกไม่ครบ ตรวจช่องที่มีข้อความสีแดง');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateJobOrderDto = {
        job_order_name: name.trim(),
        job_order_description: description.trim(),
        job_order_qty: Number(qty) || 0,
        job_order_price: Number(price) || 0,
        job_order_type: type,
        job_order_status: 'pending',
        product_variant_id: type === 'website' ? variantId : null,
        size_id: sizeId ? Number(sizeId) : null,
        color_id: colorId ? Number(colorId) : null,
        target_date: targetDate,
        employee_id: user?.employee_id,
        create_by: user?.employee_id,
        jobOrderMaterials: rows
          .filter((row) => row.material_id && row.material_qty > 0)
          .map((row) => ({ material_id: row.material_id, material_qty: row.material_qty, material_name: row.material_name || materialName(row.material_id)?.material_name })),
      };
      const created = await jobOrderModel.createJobOrder(payload);
      setDirty(false);
      toast({ message: `สร้างงานผลิต ${created?.job_order_code ?? ''} แล้ว อยู่ในคอลัมน์ “รอดำเนินการ”`.replace('  ', ' ') });
      onSuccess();
      onClose();
    } catch (error) {
      setSaveError(`บันทึกไม่สำเร็จ ${error instanceof Error && error.message ? error.message : ''} ข้อมูลที่กรอกยังอยู่ ลองอีกครั้ง`);
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (saving) return;
    if (dirty) setLeaving(true);
    else onClose();
  };

  const filteredVariants = variants.filter((item) => {
    const q = pickerQuery.trim().toLowerCase();
    return !q || `${item.productCode ?? ''} ${item.productName} ${item.sizeName} ${item.colorName}`.toLowerCase().includes(q);
  });

  const FieldError = ({ id }: { id: string }) => (errors[id] ? <span id={`jo-${id}-error`} className="ka-error" role="alert">{errors[id]}</span> : null);
  const aria = (id: string) => ({ 'aria-invalid': errors[id] ? true : undefined, 'aria-describedby': errors[id] ? `jo-${id}-error` : undefined });

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={close}
        title="สร้างงานผลิต"
        description="งานใหม่จะอยู่ในคอลัมน์ “รอดำเนินการ”"
        closeOnBackdrop={!dirty && !saving}
        closeOnEscape={!saving}
        footer={
          <>
            <span className="ka-todo__cap mr-auto max-sm:hidden">Ctrl + Enter เพื่อบันทึก</span>
            <Button variant="ghost" onClick={close} disabled={saving}>ยกเลิก</Button>
            <Button variant="action" loading={saving} onClick={() => void save()}>บันทึกงานผลิต</Button>
          </>
        }
      >
        <form
          id="job-orders-create-form"
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              void save();
            }
          }}
        >
          {loadError && <div role="alert" className="ka-banner ka-banner--danger"><span>{loadError}</span></div>}
          {saveError && <div role="alert" className="ka-banner ka-banner--danger"><span>{saveError}</span></div>}

          <div className="ka-field">
            <span className="ka-label">ประเภทงาน <span className="ka-req">*</span></span>
            <div className="ka-types" role="radiogroup" aria-label="ประเภทงาน">
              {TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={type === item.value}
                  className="ka-opt"
                  onClick={() => {
                    touch();
                    setType(item.value);
                    if (item.value !== 'website') setVariantId('');
                  }}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="ka-todo__cap">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ka-field">
            <span className="ka-label">สินค้าที่ผลิต {type === 'website' && <span className="ka-req">*</span>}</span>
            <button
              ref={pickerRef}
              type="button"
              className="ka-pick"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((value) => !value)}
              {...aria('variant')}
            >
              <span className="ka-pick__thumb" aria-hidden="true">
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </span>
              {chosen ? (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-semibold">{chosen.productName}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="ka-pill">{chosen.sizeName}</span>
                    <span className="ka-pill">{chosen.colorName}</span>
                    {chosen.productCode && <span className="ka-todo__cap numeric">{chosen.productCode}</span>}
                  </span>
                </span>
              ) : (
                <span className="min-w-0 flex-1 text-left text-[var(--ink-muted)]">{type === 'website' ? 'เลือกสินค้า ขนาด และสี' : 'ไม่ผูกกับสินค้า (เลือกได้ถ้าต้องการสูตรวัตถุดิบ)'}</span>
              )}
              <span className="ka-btn ka-btn--ghost ka-btn--sm">{chosen ? 'เปลี่ยน' : 'เลือก'}</span>
            </button>
            <span className="ka-help">ค้นหาครั้งเดียว ได้ทั้งสินค้า ขนาด และสี</span>
            <FieldError id="variant" />
            <Popover open={pickerOpen} onClose={() => setPickerOpen(false)} anchorRef={pickerRef} title="เลือกสินค้าที่ผลิต" width={440}>
              <div className="ka-input-wrap mb-2">
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="search" className="ka-input" aria-label="ค้นหาสินค้า ขนาด หรือสี" placeholder="ชื่อ รหัส ขนาด หรือสี" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} />
              </div>
              <div className="ka-menu max-h-72 overflow-y-auto" role="listbox" aria-label="สินค้า">
                {filteredVariants.length === 0 && <p className="ka-panel__note px-2 py-2">{variants.length === 0 ? 'ยังไม่มีสินค้าที่มีแบบ' : 'ไม่พบสินค้าที่ตรงกับคำค้น'}</p>}
                {filteredVariants.slice(0, 60).map((item) => (
                  <button key={item.value} type="button" role="option" aria-selected={item.value === variantId} className="ka-menu__item" onClick={() => pickVariant(item)}>
                    <span className="min-w-0 flex-1">
                      <span className="block">{item.productName}</span>
                      <span className="ka-todo__cap">{[item.productCode, item.sizeName, item.colorName].filter(Boolean).join(' · ')}</span>
                    </span>
                    {item.colorHex && <i className="ka-swatch" style={{ background: item.colorHex, marginRight: 0 }} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </Popover>
          </div>

          <div className="ka-field">
            <label htmlFor="jo-name" className="ka-label">ชื่องานผลิต <span className="ka-req">*</span></label>
            <input id="jo-name" className="ka-input" value={name} maxLength={255} onChange={(event) => { touch(); setName(event.target.value); }} {...aria('name')} />
            <span className="ka-help">ตั้งจากสินค้าที่เลือก แก้ได้</span>
            <FieldError id="name" />
          </div>

          <div className="ka-editor__g2">
            <div className="ka-field">
              <label htmlFor="jo-qty" className="ka-label">จำนวนที่ผลิต <span className="ka-req">*</span></label>
              <div className="ka-step">
                <button type="button" aria-label="ลดจำนวน" onClick={() => { touch(); setQty(String(Math.max(1, (Number(qty) || 1) - 1))); }}>
                  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M6 12h12" /></svg>
                </button>
                <input id="jo-qty" type="number" min={1} step={1} inputMode="numeric" className="numeric" value={qty} onChange={(event) => { touch(); setQty(event.target.value); }} {...aria('qty')} />
                <button type="button" aria-label="เพิ่มจำนวน" onClick={() => { touch(); setQty(String((Number(qty) || 0) + 1)); }}>
                  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M12 6v12M6 12h12" /></svg>
                </button>
              </div>
              <FieldError id="qty" />
            </div>
            <div className="ka-field">
              <label htmlFor="jo-date" className="ka-label">วันที่เป้าหมาย <span className="ka-req">*</span></label>
              <input id="jo-date" type="date" className="ka-input" value={targetDate} onChange={(event) => { touch(); setTargetDate(event.target.value); }} {...aria('targetDate')} />
              <span className="ka-help">{targetDate ? `${formatThaiDate(targetDate)} · ${daysAway(targetDate)}` : ''}</span>
              <FieldError id="targetDate" />
            </div>
            <div className="ka-field">
              <label htmlFor="jo-size" className="ka-label">ขนาด <span className="ka-req">*</span></label>
              <CustomSelect
                id="jo-size"
                value={sizeId}
                onChange={(value) => { touch(); setSizeId(value); }}
                options={sizes.map((size) => ({ value: size.size_id, label: size.size_name }))}
                placeholder="เลือกขนาด"
                {...aria('size')}
              />
              <FieldError id="size" />
            </div>
            <div className="ka-field">
              <label htmlFor="jo-color" className="ka-label">สี <span className="ka-req">*</span></label>
              <CustomSelect
                id="jo-color"
                value={colorId}
                onChange={(value) => { touch(); setColorId(value); }}
                options={colors.map((color) => ({ value: color.color_id, label: color.color_name }))}
                placeholder="เลือกสี"
                {...aria('color')}
              />
              <FieldError id="color" />
            </div>
            <div className="ka-field">
              <label htmlFor="jo-owner" className="ka-label">ผู้รับผิดชอบ</label>
              <input id="jo-owner" className="ka-input" readOnly value={`${assigneeName} (คุณ)`} />
            </div>
            <div className="ka-field">
              <label htmlFor="jo-price" className="ka-label">ราคาสินค้า (บาท)</label>
              <input id="jo-price" type="number" min={0} step="0.01" inputMode="decimal" className="ka-input numeric text-right" value={price} onChange={(event) => { touch(); setPrice(event.target.value); }} {...aria('price')} />
              <span className="ka-help">ดึงจากราคาของแบบที่เลือก</span>
              <FieldError id="price" />
            </div>
          </div>

          <div className="ka-field">
            <label htmlFor="jo-desc" className="ka-label">รายละเอียด</label>
            <textarea id="jo-desc" className="ka-input ka-textarea" style={{ minHeight: 72 }} value={description} onChange={(event) => { touch(); setDescription(event.target.value); }} />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="ka-card__title" style={{ fontSize: 16, lineHeight: '26px' }}>วัตถุดิบที่ต้องใช้</h3>
              <Button variant="ghost" size="sm" onClick={() => { touch(); setRows((prev) => [...prev, newRow()]); }}>
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                เพิ่ม
              </Button>
            </div>
            <p className="ka-panel__note mb-2">{chosen ? 'จากสูตรของแบบ' : 'ต่อชิ้น'} × {count(quantity)} ชิ้น</p>
            <div className="ka-mats">
              {rows.map((row, index) => {
                const info = shortages.find((item) => item.row === row);
                const taken = new Set(rows.filter((other) => other.id !== row.id && other.material_id).map((other) => other.material_id));
                const picked = materialName(row.material_id);
                return (
                  <div key={row.id} className="ka-mat">
                    <div className="ka-mat__pick">
                      <CustomSelect
                        aria-label={`วัตถุดิบ ${index + 1}`}
                        value={row.material_id}
                        onChange={(value) => {
                          touch();
                          const next = materialName(value);
                          setRows((prev) => prev.map((other) => (other.id === row.id ? { ...other, material_id: value, material_name: next?.material_name } : other)));
                        }}
                        options={materials.map((material) => ({ value: material.material_id, label: `${material.material_code ? `${material.material_code} · ` : ''}${material.material_name}`, disabled: taken.has(material.material_id) }))}
                        placeholder="เลือกวัตถุดิบ"
                      />
                      {picked && info && (
                        <span className={`ka-todo__cap numeric ${info.short > 0 ? 'text-[var(--danger)]' : ''}`}>
                          {info.have === undefined ? 'กำลังอ่านสต็อก…' : info.have === STOCK_FORBIDDEN ? 'ไม่มีสิทธิ์ดูสต็อกวัตถุดิบ' : Number.isNaN(info.have) ? 'อ่านสต็อกไม่ได้' : `คงเหลือ ${count(info.have)}${info.short > 0 ? ` · ขาด ${count(info.short)}` : ''}`}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className="ka-input numeric text-right"
                      aria-label={`จำนวนวัตถุดิบ ${index + 1} ต่อชิ้น`}
                      value={row.material_qty}
                      onChange={(event) => { touch(); setRows((prev) => prev.map((other) => (other.id === row.id ? { ...other, material_qty: Math.max(0, Number(event.target.value)) } : other))); }}
                    />
                    <span className="numeric ka-mat__total" aria-label="รวมที่ต้องใช้">{count(row.material_qty * quantity)} ชิ้น</span>
                    <Button variant="ghost" size="sm" icon aria-label={`ลบวัตถุดิบ ${index + 1}`} disabled={rows.length === 1} onClick={() => { touch(); setRows((prev) => prev.filter((other) => other.id !== row.id)); }}>
                      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  </div>
                );
              })}
            </div>
            <FieldError id="materials" />
            {shortCount > 0 && (
              <div role="alert" className="ka-banner ka-banner--danger mt-2">
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4l9 16H3zM12 10v4M12 17h.01" /></svg>
                <span>
                  วัตถุดิบไม่พอ {count(shortCount)} รายการ ระบบจองวัตถุดิบตอนสร้างงาน จึงยังบันทึกงานนี้ไม่ได้ รับของเข้าก่อน หรือลดจำนวนที่ผลิต{' '}
                  <a href="/admin/purchase-orders" className="font-semibold whitespace-nowrap">สร้างใบสั่งซื้อ →</a>
                </span>
              </div>
            )}
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        isOpen={leaving}
        title="ยังไม่ได้บันทึกงานผลิต"
        message={`ถ้าออกตอนนี้ ข้อมูล${name.trim() ? ` “${name.trim()}”` : ''} ที่กรอกไว้จะหายไป`}
        confirmLabel="ทิ้งการแก้ไข"
        cancelLabel="แก้ไขต่อ"
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          setDirty(false);
          onClose();
        }}
      />
    </>
  );
}
