'use client';

import type { ReactNode } from 'react';
import { priceFrom } from '@/lib/custom-catalog';
import type { MaterialChoice } from '@/models/custom-catalog';
import type { ProductUnit } from '@/types/product-unit';
import type { DraftForm } from '@/types/custom-catalog';

const SHAPE_LABELS = { flat: 'แผ่นเรียบ', shirt: 'เสื้อ', cup: 'แก้ว' } as const;
const DECORATION_LABELS = { '': 'ไม่ระบุ (ถือเป็นเลเซอร์)', laser: 'เลเซอร์', sticker: 'สติกเกอร์' } as const;
const sectionClass = 'ka-card ka-ct__section';

const mm = (value: string) => (value.trim() ? `${value} มม.` : '-');
const text = (value: string | null | undefined) => (value && value.trim() ? value : '-');

function Fields({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="ka-dl">
      {items.map(([term, value]) => (
        <div key={term} className="ka-dl__row">
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Props {
  form: DraftForm;
  saleUnit: string;
  materials: MaterialChoice[];
  units: ProductUnit[];
  /** The 3D model section, which shows the file and its preview in read-only mode itself. */
  model: ReactNode;
}

/**
 * A published revision cannot change, so it reads as text and tables rather than disabled
 * fields. Same sections and anchors as the editor, so the table of contents still works.
 */
export default function RevisionReadOnly({ form, saleUnit, materials, units, model }: Props) {
  const lowest = priceFrom(form);
  const shape = form.model;
  const optionLabel = (groupKey: string | null, valueKey: string | null) => {
    if (!groupKey || !valueKey) return 'ทุกครั้ง (สูตรพื้นฐาน)';
    const group = form.groups.find((g) => g.group_key === groupKey);
    const value = group?.values.find((v) => v.value_key === valueKey);
    return `${group?.group_label || groupKey} › ${value?.value_label || valueKey}`;
  };
  const materialName = (id: string) => {
    const found = materials.find((m) => m.material_id === id);
    return found ? `${found.material_code} · ${found.material_name}` : 'วัสดุที่บันทึกไว้';
  };
  const unitName = (id: string) => units.find((u) => String(u.product_unit_id) === String(id))?.product_unit_name ?? '-';

  return (
    <div className="space-y-6">
      <section className={sectionClass} aria-labelledby="sec-general">
        <h3 id="sec-general" className="ka-ct__title">ข้อมูลทั่วไปและราคา</h3>
        <Fields
          items={[
            ['ชื่อแบบสินค้า', text(form.template_name)],
            ['รุ่นโมเดล 3D', text(form.model_version)],
            ['วิธีตกแต่ง', DECORATION_LABELS[form.decoration]],
            ['คำอธิบาย', <span key="d" className="whitespace-pre-wrap">{text(form.description)}</span>],
            [`ราคาต่อ${saleUnit}`, form.base_unit_price ? <span key="p" className="numeric">฿{form.base_unit_price}</span> : '-'],
            ['ราคาต่ำสุดที่ลูกค้าเห็น', lowest ? <span key="l" className="numeric">{lowest} บาท/{saleUnit}</span> : '-'],
            [`จำนวน (${saleUnit})`, <span key="q" className="numeric">{form.min_quantity || '-'} – {form.max_quantity || 'ไม่จำกัด'}</span>],
          ]}
        />
      </section>

      <section className={sectionClass} aria-labelledby="sec-shape">
        <h3 id="sec-shape" className="ka-ct__title">รูปทรงและพื้นที่พิมพ์</h3>
        <Fields
          items={[
            ['รูปทรงสินค้า', SHAPE_LABELS[shape.shape]],
            ...(shape.shape === 'cup'
              ? ([
                  ['เส้นผ่านศูนย์กลางปาก / ก้น', `${mm(shape.cup.top)} / ${mm(shape.cup.bottom)}`],
                  ['ความสูงแก้ว', mm(shape.cup.height)],
                  ['ระยะขอบบน / ล่าง', `${mm(shape.cup.marginTop)} / ${mm(shape.cup.marginBottom)}`],
                ] as [string, ReactNode][])
              : []),
            [shape.shape === 'shirt' ? 'ด้านหน้า (กว้าง × สูง)' : 'พื้นที่พิมพ์ (กว้าง × สูง)', `${mm(shape.front.width)} × ${mm(shape.front.height)}`],
            ...(shape.shape === 'shirt'
              ? ([['ด้านหลัง (กว้าง × สูง)', `${mm(shape.back.width)} × ${mm(shape.back.height)}`]] as [string, ReactNode][])
              : []),
          ]}
        />
      </section>

      {model}

      <section className={sectionClass} aria-labelledby="sec-groups">
        <h3 id="sec-groups" className="ka-ct__title">กลุ่มตัวเลือก</h3>
        {form.groups.length === 0 ? (
          <p className="ka-help">ไม่มีกลุ่มตัวเลือก</p>
        ) : (
          form.groups.map((group) => (
            <div key={group.group_key} className="ka-ct__table">
              <p className="ka-ct__caption">
                {group.group_label || group.group_key}
                <span className="ka-todo__cap"> · {group.is_required ? 'ต้องเลือก' : 'ไม่บังคับ'}{group.is_color_group ? ' · กลุ่มสีของสินค้า' : ''}</span>
              </p>
              <div className="ka-table-scroll">
                <table className="ka-table">
                  <thead>
                    <tr>
                      <th scope="col">ตัวเลือก</th>
                      <th scope="col">รหัส</th>
                      <th scope="col" className="text-right">บวกเพิ่ม (บาท)</th>
                      {group.is_color_group && <th scope="col">สี</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.values.map((value) => (
                      <tr key={value.value_key}>
                        <td>{value.value_label || '-'}</td>
                        <td className="numeric">{value.value_key}</td>
                        <td className="numeric text-right">{value.unit_price_delta || '0'}</td>
                        {group.is_color_group && (
                          <td>
                            {value.color_hex ? <i className="ka-swatch" style={{ background: value.color_hex }} aria-hidden="true" /> : null}
                            <span className="numeric">{value.color_hex || '-'}</span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <section className={sectionClass} aria-labelledby="sec-rules">
        <h3 id="sec-rules" className="ka-ct__title">ความเข้ากันได้ของตัวเลือก</h3>
        {form.rules.length === 0 ? (
          <p className="ka-help">ไม่มีกฎ เลือกตัวเลือกใดร่วมกันก็ได้</p>
        ) : (
          <ul className="ka-ct__rules">
            {form.rules.map((rule, index) => (
              <li key={index}>
                {optionLabel(rule.group_key, rule.value_key)} <b>{rule.kind === 'requires' ? 'ต้องเลือกร่วมกับ' : 'ห้ามเลือกร่วมกับ'}</b>{' '}
                {optionLabel(rule.other_group_key, rule.other_value_key)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={sectionClass} aria-labelledby="sec-recipe">
        <h3 id="sec-recipe" className="ka-ct__title">สูตรวัสดุ</h3>
        {form.recipe.length === 0 ? (
          <p className="ka-help">ไม่มีสูตรวัสดุ</p>
        ) : (
          <div className="ka-table-scroll ka-ct__table">
            <table className="ka-table">
              <thead>
                <tr>
                  <th scope="col">ใช้เมื่อ</th>
                  <th scope="col">วัสดุ</th>
                  <th scope="col">หน่วย</th>
                  <th scope="col" className="text-right">ต่อ{saleUnit}</th>
                  <th scope="col" className="text-right">ตั้งเครื่อง</th>
                </tr>
              </thead>
              <tbody>
                {form.recipe.map((line, index) => (
                  <tr key={index}>
                    <td>{optionLabel(line.group_key, line.value_key)}</td>
                    <td>{materialName(line.material_id)}</td>
                    <td>{unitName(line.product_unit_id)}</td>
                    <td className="numeric text-right">{line.qty_per_unit || '0'}</td>
                    <td className="numeric text-right">{line.setup_qty || '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
