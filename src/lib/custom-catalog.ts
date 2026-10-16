import type { DraftForm, RevisionDetail, RevisionStatus } from '@/types/custom-catalog';

export const REVISION_STATUS_LABEL: Record<RevisionStatus, string> = {
  draft: 'ฉบับร่าง',
  published: 'เผยแพร่อยู่',
  archived: 'เก็บถาวร',
};

export const REVISION_STATUS_TONE: Record<RevisionStatus, 'warning' | 'success' | 'neutral'> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral',
};

const KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const MONEY = /^-?\d{1,9}(\.\d{1,2})?$/;
const POSITIVE_MONEY = /^(?!0+(\.0{1,2})?$)\d{1,9}(\.\d{1,2})?$/;
const WHOLE = /^\d{1,7}$/;
const MAX_WHOLE = 1_000_000;

export const emptyGroup = () => ({
  group_key: '',
  group_label: '',
  is_required: true,
  values: [{ value_key: '', value_label: '', unit_price_delta: '0' }],
});

/** The editable form for a revision; absent numbers become empty text. */
export function formFromRevision(r: RevisionDetail): DraftForm {
  return {
    template_name: r.template_name,
    description: r.description ?? '',
    model_version: r.model_version ?? '',
    base_unit_price: r.base_unit_price ?? '',
    min_quantity: String(r.min_quantity),
    max_quantity: r.max_quantity === null ? '' : String(r.max_quantity),
    groups: r.groups.map((g) => ({
      group_key: g.group_key,
      group_label: g.group_label,
      is_required: g.is_required,
      values: g.values.map((v) => ({ ...v })),
    })),
    rules: r.rules.map((x) => ({ ...x })),
    recipe: r.recipe.map((l) => ({
      group_key: l.group_key ?? '',
      value_key: l.value_key ?? '',
      material_id: l.material_id,
      product_unit_id: String(l.product_unit_id),
      qty_per_unit: String(l.qty_per_unit),
      setup_qty: String(l.setup_qty),
    })),
  };
}

/** The body PUT to the API: blanks are left out, numbers are numbers. */
export function bodyFromForm(f: DraftForm) {
  return {
    template_name: f.template_name.trim(),
    ...(f.description.trim() && { description: f.description.trim() }),
    ...(f.model_version.trim() && { model_version: f.model_version.trim() }),
    ...(f.base_unit_price.trim() && { base_unit_price: f.base_unit_price.trim() }),
    min_quantity: Number(f.min_quantity),
    ...(f.max_quantity.trim() && { max_quantity: Number(f.max_quantity) }),
    groups: f.groups.map((g, groupIndex) => ({
      group_key: g.group_key.trim(),
      group_label: g.group_label.trim(),
      is_required: g.is_required,
      sort_order: groupIndex,
      values: g.values.map((v, valueIndex) => ({
        value_key: v.value_key.trim(),
        value_label: v.value_label.trim(),
        unit_price_delta: v.unit_price_delta.trim() || '0',
        sort_order: valueIndex,
      })),
    })),
    rules: f.rules.map((x) => ({ ...x })),
    recipe: f.recipe.map((l) => ({
      ...(l.group_key && l.value_key && { group_key: l.group_key, value_key: l.value_key }),
      material_id: l.material_id,
      product_unit_id: Number(l.product_unit_id),
      qty_per_unit: Number(l.qty_per_unit || 0),
      setup_qty: Number(l.setup_qty || 0),
    })),
  };
}

/**
 * Mistakes the form can see before it asks the server. The server stays the
 * authority; this only saves a round trip and points at the field.
 */
export function formProblems(f: DraftForm): string[] {
  const out: string[] = [];
  if (!f.template_name.trim()) out.push('กรุณากรอกชื่อแบบสินค้า');
  if (f.base_unit_price.trim() && !POSITIVE_MONEY.test(f.base_unit_price.trim())) {
    out.push('ราคาต่อหน่วยต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');
  }
  if (!WHOLE.test(f.min_quantity.trim()) || Number(f.min_quantity) < 1 || Number(f.min_quantity) > MAX_WHOLE) {
    out.push(`จำนวนต่ำสุดต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง ${MAX_WHOLE}`);
  }
  if (f.max_quantity.trim()) {
    if (!WHOLE.test(f.max_quantity.trim()) || Number(f.max_quantity) < Number(f.min_quantity) || Number(f.max_quantity) > MAX_WHOLE) {
      out.push(`จำนวนสูงสุดต้องเป็นจำนวนเต็ม ไม่น้อยกว่าจำนวนต่ำสุด และไม่เกิน ${MAX_WHOLE}`);
    }
  }
  const groupKeys = new Set<string>();
  f.groups.forEach((g, i) => {
    const name = g.group_label.trim() || `กลุ่มที่ ${i + 1}`;
    if (!KEY.test(g.group_key.trim())) out.push(`${name}: รหัสกลุ่มใช้ a-z 0-9 _ - และขึ้นต้นด้วยตัวอักษรหรือตัวเลข`);
    if (groupKeys.has(g.group_key.trim())) out.push(`${name}: รหัสกลุ่มซ้ำ`);
    groupKeys.add(g.group_key.trim());
    if (!g.group_label.trim()) out.push(`${name}: กรุณากรอกชื่อกลุ่ม`);
    const valueKeys = new Set<string>();
    g.values.forEach((v, j) => {
      const vname = v.value_label.trim() || `ตัวเลือกที่ ${j + 1}`;
      if (!KEY.test(v.value_key.trim())) out.push(`${name} / ${vname}: รหัสตัวเลือกไม่ถูกต้อง`);
      if (valueKeys.has(v.value_key.trim())) out.push(`${name} / ${vname}: รหัสตัวเลือกซ้ำ`);
      valueKeys.add(v.value_key.trim());
      if (!v.value_label.trim()) out.push(`${name}: ตัวเลือกที่ ${j + 1} ยังไม่มีชื่อ`);
      if (!MONEY.test(v.unit_price_delta.trim() || '0')) out.push(`${name} / ${vname}: ราคาที่บวกเพิ่มไม่ถูกต้อง`);
    });
  });
  const known = new Set(f.groups.flatMap((g) => g.values.map((v) => `${g.group_key.trim()}/${v.value_key.trim()}`)));
  f.rules.forEach((x, i) => {
    if (!known.has(`${x.group_key}/${x.value_key}`) || !known.has(`${x.other_group_key}/${x.other_value_key}`)) {
      out.push(`กฎความเข้ากันได้ข้อ ${i + 1}: ต้องเลือกตัวเลือกที่มีอยู่ทั้งสองข้าง`);
    }
  });
  f.recipe.forEach((l, i) => {
    const name = `สูตรวัสดุข้อ ${i + 1}`;
    if (!l.material_id) out.push(`${name}: กรุณาเลือกวัสดุ`);
    if (!l.product_unit_id) out.push(`${name}: กรุณาเลือกหน่วย`);
    const perUnit = l.qty_per_unit.trim() || '0';
    const setup = l.setup_qty.trim() || '0';
    if (!WHOLE.test(perUnit) || !WHOLE.test(setup) || Number(perUnit) > MAX_WHOLE || Number(setup) > MAX_WHOLE) {
      out.push(`${name}: จำนวนต้องเป็นจำนวนเต็มไม่เกิน ${MAX_WHOLE}`);
    }
    else if (Number(perUnit) + Number(setup) < 1) out.push(`${name}: ต้องมีจำนวนต่อชิ้นหรือจำนวนเตรียมงานอย่างน้อยหนึ่งค่า`);
    if (Boolean(l.group_key) !== Boolean(l.value_key)) out.push(`${name}: ต้องเลือกตัวเลือกให้ครบ หรือเลือกเป็นสูตรพื้นฐาน`);
    if (l.group_key && l.value_key && !known.has(`${l.group_key}/${l.value_key}`)) out.push(`${name}: ตัวเลือกที่เลือกไม่มีอยู่แล้ว`);
  });
  return out;
}

/** Lowest price a customer can reach: required groups at their cheapest value. */
export function priceFrom(f: DraftForm): string | null {
  const base = Number(f.base_unit_price);
  if (!f.base_unit_price.trim() || Number.isNaN(base)) return null;
  let satang = Math.round(base * 100);
  for (const g of f.groups) {
    const deltas = g.values.map((v) => Math.round(Number(v.unit_price_delta || 0) * 100)).filter((n) => !Number.isNaN(n));
    if (!deltas.length) continue;
    const least = Math.min(...deltas);
    satang += g.is_required ? least : Math.min(0, least);
  }
  return (satang / 100).toFixed(2);
}
