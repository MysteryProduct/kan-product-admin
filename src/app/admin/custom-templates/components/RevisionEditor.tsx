'use client';

import type { Dispatch, SetStateAction } from 'react';
import { emptyGroup, isCupVersion, priceFrom } from '@/lib/custom-catalog';
import type { MaterialChoice } from '@/models/custom-catalog';
import type { ProductUnit } from '@/types/product-unit';
import type { DraftForm, ModelFileInfo } from '@/types/custom-catalog';
import { ModelSection, ShapeSection } from './ModelSection';
import CustomSelect from '@/components/CustomSelect';

const COLOR = /^#[0-9a-fA-F]{6}$/;

interface Props {
  modelFile: ModelFileInfo | null;
  modelBusy: boolean;
  loadModelBytes: () => Promise<ArrayBuffer>;
  onUploadModel: (file: File) => Promise<void>;
  onRemoveModel: () => Promise<void>;
  form: DraftForm;
  setForm: Dispatch<SetStateAction<DraftForm>>;
  readOnly: boolean;
  saleUnit: string;
  materials: MaterialChoice[];
  units: ProductUnit[];
}

const sectionClass = 'ka-card ka-ct__section';

/** "ขนาด › 11 oz" style choices for the rule and recipe pickers. */
function optionChoices(form: DraftForm) {
  return form.groups.flatMap((g) =>
    g.values
      .filter((v) => g.group_key.trim() && v.value_key.trim())
      .map((v) => ({
        id: `${g.group_key.trim()}/${v.value_key.trim()}`,
        label: `${g.group_label.trim() || g.group_key} › ${v.value_label.trim() || v.value_key}`,
      })),
  );
}

const split = (id: string): [string, string] => {
  const at = id.indexOf('/');
  return at < 0 ? ['', ''] : [id.slice(0, at), id.slice(at + 1)];
};

const DECORATIONS: { value: DraftForm['decoration']; label: string }[] = [
  { value: '', label: 'ไม่ระบุ (ถือเป็นเลเซอร์)' },
  { value: 'laser', label: 'เลเซอร์' },
  { value: 'sticker', label: 'สติกเกอร์' },
];

export default function RevisionEditor({ form, setForm, readOnly, saleUnit, materials, units, modelFile, modelBusy, loadModelBytes, onUploadModel, onRemoveModel }: Props) {
  const choices = optionChoices(form);
  const lowest = priceFrom(form);

  const patch = (changes: Partial<DraftForm>) => setForm((prev) => ({ ...prev, ...changes }));
  const patchGroup = (index: number, changes: Partial<DraftForm['groups'][number]>) =>
    patch({ groups: form.groups.map((g, i) => (i === index ? { ...g, ...changes } : g)) });
  const patchValue = (gi: number, vi: number, changes: Partial<DraftForm['groups'][number]['values'][number]>) =>
    patchGroup(gi, { values: form.groups[gi].values.map((v, i) => (i === vi ? { ...v, ...changes } : v)) });

  const colorGroup = form.groups.find((g) => g.is_color_group);
  const colors = (colorGroup?.values ?? [])
    .filter((v) => COLOR.test((v.color_hex ?? '').trim()))
    .map((v) => ({ key: v.value_key, label: v.value_label.trim() || v.value_key, hex: (v.color_hex ?? '').trim().toLowerCase() }));

  return (
    <div className="space-y-6">
      <section className={sectionClass} aria-labelledby="sec-general">
        <h3 id="sec-general" className="text-base font-semibold text-[var(--ink)]">ข้อมูลทั่วไปและราคา</h3>
        <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <div className="ka-field content-start">
            <label className="ka-label" htmlFor="f-name">ชื่อแบบสินค้า</label>
            <input id="f-name" className="ka-input" value={form.template_name} disabled={readOnly} onChange={(e) => patch({ template_name: e.target.value })} />
          </div>
          <div className="ka-field content-start">
            <label className="ka-label" htmlFor="f-model">รุ่นโมเดล 3D</label>
            <input id="f-model" className="ka-input" value={form.model_version} disabled={readOnly} onChange={(e) => patch({ model_version: e.target.value })} placeholder="เช่น mug-v1" />
            <p className="ka-help">ชื่อรุ่นที่ใช้ระบุโมเดล (ไฟล์ GLB อัปโหลดด้านล่าง) — ไม่ใช่ไฟล์ของลูกค้า</p>
          </div>
          {(isCupVersion(form.model_version) || form.decoration !== '') && (
          <fieldset className="ka-field content-start md:col-span-2" disabled={readOnly}>
            <legend className="ka-label">วิธีตกแต่ง (ใช้กับแก้วเท่านั้น)</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {DECORATIONS.map((d) => (
                <label key={d.value || 'unset'} className="flex min-h-[44px] items-center gap-2 text-sm text-[var(--ink)]">
                  <input type="radio" name="f-decoration" checked={form.decoration === d.value} onChange={() => patch({ decoration: d.value })} />
                  {d.label}
                </label>
              ))}
            </div>
            <p className="ka-help">
              {readOnly
                ? 'ฉบับนี้แก้ไม่ได้ ถ้าต้องการเปลี่ยนวิธีตกแต่ง ให้สร้างฉบับใหม่'
                : 'เลเซอร์: ข้อความสีเดียวและรูปเป็นขาวดำตัดขอบ · สติกเกอร์: รูปและข้อความใช้สีได้เต็มที่ · ไม่ระบุ: ระบบถือเป็นเลเซอร์'}
            </p>
            {readOnly && form.decoration === '' && (
              <p className="ka-help">ฉบับนี้ยังไม่ระบุวิธีตกแต่ง ลูกค้าจึงเห็นเป็นเลเซอร์</p>
            )}
          </fieldset>
          )}
          <div className="ka-field content-start md:col-span-2">
            <label className="ka-label" htmlFor="f-desc">คำอธิบาย</label>
            <textarea id="f-desc" className="ka-textarea" value={form.description} disabled={readOnly} onChange={(e) => patch({ description: e.target.value })} />
          </div>
          <div className="ka-field content-start">
            <label className="ka-label" htmlFor="f-price">ราคาต่อ{saleUnit} (บาท รวม VAT)</label>
            <input id="f-price" className="ka-input" inputMode="decimal" value={form.base_unit_price} disabled={readOnly} onChange={(e) => patch({ base_unit_price: e.target.value })} />
            <p className="ka-help">
              {lowest ? `ราคาต่ำสุดที่ลูกค้าจะเห็น ${lowest} บาท/${saleUnit}` : 'ร้านเป็นผู้กำหนดราคา — ยังไม่มีราคาจะเผยแพร่ไม่ได้'}
            </p>
          </div>
          <div className="grid grid-cols-2 items-start gap-4">
            <div className="ka-field content-start">
              <label className="ka-label" htmlFor="f-min">จำนวนต่ำสุด ({saleUnit})</label>
              <input id="f-min" className="ka-input" inputMode="numeric" value={form.min_quantity} disabled={readOnly} onChange={(e) => patch({ min_quantity: e.target.value })} />
            </div>
            <div className="ka-field content-start">
              <label className="ka-label" htmlFor="f-max">จำนวนสูงสุด ({saleUnit})</label>
              <input id="f-max" className="ka-input" inputMode="numeric" value={form.max_quantity} disabled={readOnly} onChange={(e) => patch({ max_quantity: e.target.value })} placeholder="ไม่จำกัด" />
            </div>
          </div>
        </div>
      </section>

      <ShapeSection form={form.model} onChange={(model) => patch({ model })} readOnly={readOnly} hasFile={modelFile !== null} />

      <ModelSection
        form={form.model}
        onChange={(model) => patch({ model })}
        readOnly={readOnly}
        file={modelFile}
        busy={modelBusy}
        loadBytes={loadModelBytes}
        onUpload={onUploadModel}
        onRemove={onRemoveModel}
        colors={colors}
      />

      <section className={sectionClass} aria-labelledby="sec-groups">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="sec-groups" className="text-base font-semibold text-[var(--ink)]">กลุ่มตัวเลือก</h3>
            <p className="text-sm text-[var(--ink-muted)]">เช่น ขนาด สี ขนาดแผ่น (A4/A5) — ราคาที่บวกเพิ่มต่อ{saleUnit}ติดลบได้</p>
          </div>
          {!readOnly && (
            <button type="button" className="ka-btn ka-btn--sm" onClick={() => patch({ groups: [...form.groups, emptyGroup()] })}>
              เพิ่มกลุ่มตัวเลือก
            </button>
          )}
        </div>
        {form.groups.length === 0 && <p className="mt-3 text-sm text-[var(--ink-muted)]">ยังไม่มีกลุ่มตัวเลือก</p>}
        <div className="mt-4 space-y-4">
          {form.groups.map((g, gi) => (
            <fieldset key={gi} className="rounded-xl border border-[var(--border)] p-3" disabled={readOnly}>
              <legend className="px-1 text-sm font-medium text-[var(--ink-muted)]">กลุ่มที่ {gi + 1}</legend>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-end">
                <div className="ka-field content-start">
                  <label className="ka-label" htmlFor={`g-label-${gi}`}>ชื่อกลุ่ม</label>
                  <input id={`g-label-${gi}`} className="ka-input" value={g.group_label} onChange={(e) => patchGroup(gi, { group_label: e.target.value })} />
                </div>
                <div className="ka-field content-start">
                  <label className="ka-label" htmlFor={`g-key-${gi}`}>รหัสกลุ่ม</label>
                  <input id={`g-key-${gi}`} className="ka-input" value={g.group_key} onChange={(e) => patchGroup(gi, { group_key: e.target.value })} placeholder="เช่น size" />
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
                  <input type="checkbox" checked={g.is_required} onChange={(e) => patchGroup(gi, { is_required: e.target.checked })} />
                  ต้องเลือก
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={Boolean(g.is_color_group)}
                    disabled={Boolean(colorGroup) && colorGroup !== g}
                    onChange={(e) => patchGroup(gi, { is_color_group: e.target.checked })}
                  />
                  กลุ่มนี้คือสีสินค้า
                </label>
                {!readOnly && (
                  <button type="button" className="ka-btn ka-btn--danger ka-btn--sm" onClick={() => patch({ groups: form.groups.filter((_, i) => i !== gi) })}>
                    ลบกลุ่ม
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {g.values.map((v, vi) => (
                  <div key={vi} className={`grid grid-cols-1 gap-2 sm:items-end ${g.is_color_group ? 'sm:grid-cols-[1fr_1fr_9rem_9rem_auto]' : 'sm:grid-cols-[1fr_1fr_9rem_auto]'}`}>
                    <div className="ka-field content-start">
                      <label className="ka-label" htmlFor={`v-label-${gi}-${vi}`}>ตัวเลือก</label>
                      <input id={`v-label-${gi}-${vi}`} className="ka-input" value={v.value_label} onChange={(e) => patchValue(gi, vi, { value_label: e.target.value })} />
                    </div>
                    <div className="ka-field content-start">
                      <label className="ka-label" htmlFor={`v-key-${gi}-${vi}`}>รหัส</label>
                      <input id={`v-key-${gi}-${vi}`} className="ka-input" value={v.value_key} onChange={(e) => patchValue(gi, vi, { value_key: e.target.value })} placeholder="เช่น a4" />
                    </div>
                    <div className="ka-field content-start">
                      <label className="ka-label" htmlFor={`v-delta-${gi}-${vi}`}>บวกเพิ่ม (บาท)</label>
                      <input id={`v-delta-${gi}-${vi}`} className="ka-input" inputMode="decimal" value={v.unit_price_delta} onChange={(e) => patchValue(gi, vi, { unit_price_delta: e.target.value })} />
                    </div>
                    {g.is_color_group && (
                      <div className="ka-field content-start">
                        <label className="ka-label" htmlFor={`v-color-${gi}-${vi}`}>สี (#rrggbb)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            aria-label={`เลือกสี ${v.value_label || vi + 1}`}
                            className="size-11 shrink-0 cursor-pointer rounded-lg border border-[var(--border-control)] bg-[var(--bg-surface)] p-1 disabled:cursor-not-allowed"
                            value={COLOR.test((v.color_hex ?? '').trim()) ? (v.color_hex ?? '').trim().toLowerCase() : '#ffffff'}
                            onChange={(e) => patchValue(gi, vi, { color_hex: e.target.value })}
                          />
                          <input
                            id={`v-color-${gi}-${vi}`}
                            className="ka-input min-w-0 tabular-nums"
                            value={v.color_hex ?? ''}
                            aria-invalid={Boolean(v.color_hex) && !COLOR.test(v.color_hex!.trim())}
                            onChange={(e) => patchValue(gi, vi, { color_hex: e.target.value })}
                            placeholder="#c0392b"
                            maxLength={7}
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        className="ka-btn ka-btn--ghost ka-btn--sm"
                        onClick={() => patchGroup(gi, { values: g.values.filter((_, i) => i !== vi) })}
                        aria-label={`ลบตัวเลือก ${v.value_label || vi + 1}`}
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button
                    type="button"
                    className="ka-btn ka-btn--ghost ka-btn--sm"
                    onClick={() => patchGroup(gi, { values: [...g.values, { value_key: '', value_label: '', unit_price_delta: '0', color_hex: '' }] })}
                  >
                    เพิ่มตัวเลือก
                  </button>
                )}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="sec-rules">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="sec-rules" className="text-base font-semibold text-[var(--ink)]">ความเข้ากันได้ของตัวเลือก</h3>
            <p className="text-sm text-[var(--ink-muted)]">เมื่อเลือกตัวเลือกแรก ต้องเลือกร่วม หรือห้ามเลือกร่วม กับตัวเลือกที่สอง</p>
          </div>
          {!readOnly && (
            <button
              type="button"
              className="ka-btn ka-btn--sm"
              disabled={choices.length < 2}
              onClick={() =>
                patch({
                  rules: [
                    ...form.rules,
                    {
                      group_key: split(choices[0].id)[0],
                      value_key: split(choices[0].id)[1],
                      other_group_key: split(choices[1].id)[0],
                      other_value_key: split(choices[1].id)[1],
                      kind: 'excludes',
                    },
                  ],
                })
              }
            >
              เพิ่มกฎ
            </button>
          )}
        </div>
        {form.rules.length === 0 && <p className="mt-3 text-sm text-[var(--ink-muted)]">ไม่มีกฎ — ทุกตัวเลือกใช้ร่วมกันได้</p>}
        <div className="mt-3 space-y-2">
          {form.rules.map((r, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_12rem_1fr_auto] md:items-end">
              <div className="ka-field content-start">
                <label className="ka-label" htmlFor={`r-a-${i}`}>ถ้าเลือก</label>
                <CustomSelect
                  id={`r-a-${i}`}
                  value={`${r.group_key}/${r.value_key}`}
                  onChange={(value) => {
                    const [g, v] = split(value);
                    patch({ rules: form.rules.map((x, j) => (j === i ? { ...x, group_key: g, value_key: v } : x)) });
                  }}
                  options={[
                    ...(!choices.some((c) => c.id === `${r.group_key}/${r.value_key}`) ? [{ value: `${r.group_key}/${r.value_key}`, label: '(ไม่พบตัวเลือก)' }] : []),
                    ...choices.map((c) => ({ value: c.id, label: c.label })),
                  ]}
                  disabled={readOnly}
                />
              </div>
              <div className="ka-field content-start">
                <label className="ka-label" htmlFor={`r-k-${i}`}>เงื่อนไข</label>
                <CustomSelect
                  id={`r-k-${i}`}
                  value={r.kind}
                  onChange={(value) => patch({ rules: form.rules.map((x, j) => (j === i ? { ...x, kind: value as 'requires' | 'excludes' } : x)) })}
                  options={[
                    { value: "excludes", label: 'ห้ามเลือกร่วมกับ' },
                    { value: "requires", label: 'ต้องเลือกร่วมกับ' },
                  ]}
                  disabled={readOnly}
                />
              </div>
              <div className="ka-field content-start">
                <label className="ka-label" htmlFor={`r-b-${i}`}>ตัวเลือกที่สอง</label>
                <CustomSelect
                  id={`r-b-${i}`}
                  value={`${r.other_group_key}/${r.other_value_key}`}
                  onChange={(value) => {
                    const [g, v] = split(value);
                    patch({ rules: form.rules.map((x, j) => (j === i ? { ...x, other_group_key: g, other_value_key: v } : x)) });
                  }}
                  options={[
                    ...(!choices.some((c) => c.id === `${r.other_group_key}/${r.other_value_key}`) ? [{ value: `${r.other_group_key}/${r.other_value_key}`, label: '(ไม่พบตัวเลือก)' }] : []),
                    ...choices.map((c) => ({ value: c.id, label: c.label })),
                  ]}
                  disabled={readOnly}
                />
              </div>
              {!readOnly && (
                <button type="button" className="ka-btn ka-btn--ghost ka-btn--sm" onClick={() => patch({ rules: form.rules.filter((_, j) => j !== i) })} aria-label={`ลบกฎข้อ ${i + 1}`}>
                  ลบ
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="sec-recipe">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="sec-recipe" className="text-base font-semibold text-[var(--ink)]">สูตรวัสดุ</h3>
            <p className="text-sm text-[var(--ink-muted)]">
              วัสดุที่ใช้ต่อ{saleUnit} (จำนวนเต็ม) และจำนวนเตรียมงานที่ใช้ครั้งเดียวต่อรายการ — ไม่ใช้ตัวเลือกก็ได้ และเลือกหลายวัสดุต่อตัวเลือกได้
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              className="ka-btn ka-btn--sm"
              onClick={() =>
                patch({
                  recipe: [...form.recipe, { group_key: '', value_key: '', material_id: '', product_unit_id: '', qty_per_unit: '1', setup_qty: '0' }],
                })
              }
            >
              เพิ่มวัสดุ
            </button>
          )}
        </div>
        {form.recipe.length === 0 && <p className="mt-3 text-sm text-[var(--ink-muted)]">ยังไม่มีสูตรวัสดุ</p>}
        <div className="mt-3 space-y-3">
          {form.recipe.map((l, i) => {
            const set = (changes: Partial<DraftForm['recipe'][number]>) =>
              patch({ recipe: form.recipe.map((x, j) => (j === i ? { ...x, ...changes } : x)) });
            const known = l.material_id === '' || materials.some((m) => m.material_id === l.material_id);
            return (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--border)] p-3 md:grid-cols-6 md:items-end">
                <div className="ka-field content-start md:col-span-2">
                  <label className="ka-label" htmlFor={`l-use-${i}`}>ใช้เมื่อ</label>
                  <CustomSelect
                    id={`l-use-${i}`}
                    value={l.group_key && l.value_key ? `${l.group_key}/${l.value_key}` : ''}
                    onChange={(value) => {
                      const [g, v] = split(value);
                      set({ group_key: g, value_key: v });
                    }}
                    options={[
                      { value: "", label: 'ทุกครั้ง (สูตรพื้นฐาน)' },
                      ...(l.group_key && l.value_key && !choices.some((c) => c.id === `${l.group_key}/${l.value_key}`) ? [{ value: `${l.group_key}/${l.value_key}`, label: '(ไม่พบตัวเลือก)' }] : []),
                      ...choices.map((c) => ({ value: c.id, label: c.label })),
                    ]}
                    disabled={readOnly}
                  />
                </div>
                <div className="ka-field content-start md:col-span-2">
                  <label className="ka-label" htmlFor={`l-mat-${i}`}>วัสดุ</label>
                  <CustomSelect
                    id={`l-mat-${i}`}
                    value={l.material_id}
                    onChange={(value) => set({ material_id: value })}
                    options={[
                      ...(!known ? [{ value: l.material_id, label: '(วัสดุที่บันทึกไว้)' }] : []),
                      ...materials.map((m) => ({ value: m.material_id, label: `${m.material_code}· ${m.material_name}` })),
                    ]}
                    placeholder="เลือกวัสดุ"
                    disabled={readOnly}
                  />
                </div>
                <div className="ka-field content-start">
                  <label className="ka-label" htmlFor={`l-unit-${i}`}>หน่วย</label>
                  <CustomSelect
                    id={`l-unit-${i}`}
                    value={l.product_unit_id}
                    onChange={(value) => set({ product_unit_id: value })}
                    options={units.map((u) => ({ value: u.product_unit_id, label: u.product_unit_name }))}
                    placeholder="เลือก"
                    disabled={readOnly}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="ka-field content-start">
                    <label className="ka-label" htmlFor={`l-q-${i}`}>ต่อ{saleUnit}</label>
                    <input id={`l-q-${i}`} className="ka-input" inputMode="numeric" disabled={readOnly} value={l.qty_per_unit} onChange={(e) => set({ qty_per_unit: e.target.value })} />
                  </div>
                  <div className="ka-field content-start">
                    <label className="ka-label" htmlFor={`l-s-${i}`}>เตรียมงาน</label>
                    <input id={`l-s-${i}`} className="ka-input" inputMode="numeric" disabled={readOnly} value={l.setup_qty} onChange={(e) => set({ setup_qty: e.target.value })} />
                  </div>
                </div>
                {!readOnly && (
                  <div className="md:col-span-6">
                    <button type="button" className="ka-btn ka-btn--ghost ka-btn--sm" onClick={() => patch({ recipe: form.recipe.filter((_, j) => j !== i) })}>
                      ลบวัสดุข้อ {i + 1}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
