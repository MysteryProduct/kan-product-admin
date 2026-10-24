import type { DraftForm, ModelConfig, ModelForm, RevisionDetail, RevisionStatus } from '@/types/custom-catalog';

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

// ---- print area, shape and model picks (millimetres) -----------------------

const MM = /^\d{1,4}(\.\d)?$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const MM_MAX = 2000;

export const emptyModel = (): ModelForm => ({
  shape: 'flat',
  front: { width: '', height: '', mesh: '' },
  back: { width: '', height: '', mesh: '' },
  cup: { top: '', bottom: '', height: '', marginTop: '0', marginBottom: '0' },
  body_mesh: '',
});

const mmText = (n: number | undefined) => (n === undefined ? '' : String(n));

export function modelFromConfig(c: ModelConfig | null): ModelForm {
  if (!c) return emptyModel();
  return {
    shape: c.cup ? 'cup' : c.faces.back ? 'shirt' : 'flat',
    front: { width: mmText(c.faces.front.width_mm), height: mmText(c.faces.front.height_mm), mesh: c.faces.front.mesh ?? '' },
    back: {
      width: mmText(c.faces.back?.width_mm),
      height: mmText(c.faces.back?.height_mm),
      mesh: c.faces.back?.mesh ?? '',
    },
    cup: {
      top: mmText(c.cup?.top_diameter_mm),
      bottom: mmText(c.cup?.bottom_diameter_mm),
      height: mmText(c.cup?.height_mm),
      marginTop: mmText(c.cup?.margin_top_mm ?? 0),
      marginBottom: mmText(c.cup?.margin_bottom_mm ?? 0),
    },
    body_mesh: c.body_mesh ?? '',
  };
}

/** The config the API stores; null while the front print area is still blank. */
export function configFromModel(m: ModelForm): ModelConfig | null {
  if (!m.front.width.trim() || !m.front.height.trim()) return null;
  const face = (f: ModelForm['front']) => ({
    width_mm: Number(f.width),
    height_mm: Number(f.height),
    ...(f.mesh && { mesh: f.mesh }),
  });
  return {
    faces: {
      front: face(m.front),
      ...(m.shape === 'shirt' && { back: face(m.back) }),
    },
    ...(m.shape === 'cup' && {
      cup: {
        top_diameter_mm: Number(m.cup.top),
        bottom_diameter_mm: Number(m.cup.bottom),
        height_mm: Number(m.cup.height),
        margin_top_mm: Number(m.cup.marginTop || 0),
        margin_bottom_mm: Number(m.cup.marginBottom || 0),
      },
    }),
    ...(m.body_mesh && { body_mesh: m.body_mesh }),
  };
}

/** The largest width a straight-sided cup can print all the way round. */
export function wrapLimitMm(m: ModelForm): number | null {
  const top = Number(m.cup.top);
  const bottom = Number(m.cup.bottom);
  if (!MM.test(m.cup.top) || !MM.test(m.cup.bottom)) return null;
  return Math.PI * Math.max(top, bottom);
}

/** Tallest print area that fits between the cup's margins. */
export function printHeightLimitMm(m: ModelForm): number | null {
  if (!MM.test(m.cup.height)) return null;
  const room = Number(m.cup.height) - Number(m.cup.marginTop || 0) - Number(m.cup.marginBottom || 0);
  return room > 0 ? room : null;
}

/** Width : height of the front print area, for the preview of its proportions. */
export function printAspect(f: ModelForm['front']): number | null {
  const w = Number(f.width);
  const h = Number(f.height);
  return MM.test(f.width) && MM.test(f.height) && w > 0 && h > 0 ? w / h : null;
}

/** Drops the mesh picks (a new file or none means the old names are gone). */
export function clearMeshPicks(f: DraftForm): DraftForm {
  return {
    ...f,
    model: {
      ...f.model,
      front: { ...f.model.front, mesh: '' },
      back: { ...f.model.back, mesh: '' },
      body_mesh: '',
    },
  };
}

/** The Store draws a cup for these model versions (same rule as its
 *  modelKind), and only a cup has a decoration. */
export const isCupVersion = (modelVersion: string) =>
  /^(cup|mug|glass|tumbler)/i.test(modelVersion.trim());

/** The editable form for a revision; absent numbers become empty text. */
export function formFromRevision(r: RevisionDetail): DraftForm {
  return {
    model: modelFromConfig(r.model_config),
    template_name: r.template_name,
    description: r.description ?? '',
    model_version: r.model_version ?? '',
    decoration: r.decoration ?? '',
    base_unit_price: r.base_unit_price ?? '',
    min_quantity: String(r.min_quantity),
    max_quantity: r.max_quantity === null ? '' : String(r.max_quantity),
    groups: r.groups.map((g) => ({
      group_key: g.group_key,
      group_label: g.group_label,
      is_required: g.is_required,
      is_color_group: g.is_color_group ?? false,
      values: g.values.map((v) => ({
        value_key: v.value_key,
        value_label: v.value_label,
        unit_price_delta: v.unit_price_delta,
        color_hex: v.color_hex ?? '',
      })),
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
  const model_config = configFromModel(f.model);
  return {
    ...(model_config && { model_config }),
    template_name: f.template_name.trim(),
    ...(f.description.trim() && { description: f.description.trim() }),
    ...(f.model_version.trim() && { model_version: f.model_version.trim() }),
    ...(f.decoration && { decoration: f.decoration }),
    ...(f.base_unit_price.trim() && { base_unit_price: f.base_unit_price.trim() }),
    min_quantity: Number(f.min_quantity),
    ...(f.max_quantity.trim() && { max_quantity: Number(f.max_quantity) }),
    groups: f.groups.map((g, groupIndex) => ({
      group_key: g.group_key.trim(),
      group_label: g.group_label.trim(),
      is_required: g.is_required,
      ...(g.is_color_group && { is_color_group: true }),
      sort_order: groupIndex,
      values: g.values.map((v, valueIndex) => ({
        value_key: v.value_key.trim(),
        value_label: v.value_label.trim(),
        unit_price_delta: v.unit_price_delta.trim() || '0',
        ...(g.is_color_group && { color_hex: (v.color_hex ?? '').trim().toLowerCase() }),
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

/** Print-area and shape mistakes, in the order the section shows its fields. */
export function modelProblems(m: ModelForm): string[] {
  const out: string[] = [];
  const anyFront = m.front.width.trim() || m.front.height.trim();
  const picked = m.front.mesh || m.back.mesh || m.body_mesh;
  if (m.shape === 'flat' && !anyFront && !picked) return out;
  const dims = (label: string, w: string, h: string) => {
    for (const [name, v] of [['กว้าง', w], ['สูง', h]] as const) {
      if (!MM.test(v.trim()) || Number(v) < 1 || Number(v) > MM_MAX) {
        out.push(`${label}: ${name}ต้องเป็นตัวเลข 1–${MM_MAX} มม. ทศนิยมไม่เกิน 1 ตำแหน่ง`);
      }
    }
  };
  dims(m.shape === 'cup' ? 'พื้นที่พิมพ์รอบแก้ว' : 'พื้นที่พิมพ์ด้านหน้า', m.front.width, m.front.height);
  if (m.shape === 'shirt') dims('พื้นที่พิมพ์ด้านหลัง', m.back.width, m.back.height);
  if (m.shape === 'cup') {
    for (const [name, v, min, max] of [
      ['เส้นผ่านศูนย์กลางปาก', m.cup.top, 10, 500],
      ['เส้นผ่านศูนย์กลางก้น', m.cup.bottom, 10, 500],
      ['ความสูงแก้ว', m.cup.height, 10, 500],
      ['ระยะขอบบน', m.cup.marginTop || '0', 0, 250],
      ['ระยะขอบล่าง', m.cup.marginBottom || '0', 0, 250],
    ] as const) {
      if (!MM.test(v.trim()) || Number(v) < min || Number(v) > max) out.push(`แก้ว: ${name}ต้องเป็นตัวเลข ${min}–${max} มม.`);
    }
    if (out.length === 0) {
      const wrap = wrapLimitMm(m);
      const room = printHeightLimitMm(m);
      if (room === null) out.push('แก้ว: ระยะขอบบนและล่างรวมกันต้องน้อยกว่าความสูงแก้ว');
      else if (Number(m.front.height) > room + 0.05) out.push(`แก้ว: ความสูงพื้นที่พิมพ์เกินช่วงระหว่างระยะขอบ (${room.toFixed(1)} มม.)`);
      if (wrap !== null && Number(m.front.width) > wrap * 1.001) out.push(`แก้ว: ความกว้างรอบเกินเส้นรอบวงของแก้ว (${wrap.toFixed(1)} มม.)`);
    }
  }
  if (m.front.mesh && m.shape === 'shirt' && m.front.mesh === m.back.mesh) out.push('ด้านหน้าและด้านหลังใช้ mesh เดียวกันไม่ได้');
  if (m.body_mesh && (m.body_mesh === m.front.mesh || (m.shape === 'shirt' && m.body_mesh === m.back.mesh))) {
    out.push('mesh ตัวสินค้า (รับสี) ต้องไม่ใช่ mesh พื้นที่พิมพ์');
  }
  return out;
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
  out.push(...modelProblems(f.model));
  if (f.groups.filter((g) => g.is_color_group).length > 1) out.push('กำหนดกลุ่มสีสินค้าได้เพียงหนึ่งกลุ่ม');
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
      if (g.is_color_group && !HEX.test((v.color_hex ?? '').trim())) out.push(`${name} / ${vname}: กรุณาระบุรหัสสีแบบ #rrggbb`);
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
