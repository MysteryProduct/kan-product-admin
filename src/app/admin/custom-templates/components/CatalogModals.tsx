'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import CustomCatalogModel from '@/models/custom-catalog';
import type { CustomProductType } from '@/types/custom-catalog';
import CustomSelect from '@/components/CustomSelect';

const model = new CustomCatalogModel();

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

interface TypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** A product type: a kind of job (mug, shirt, sticker) and what one unit sold is called. */
export function TypeModal({ isOpen, onClose, onSaved }: TypeModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('ชิ้น');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => {
    setCode('');
    setName('');
    setUnit('ชิ้น');
    setError('');
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(code.trim())) {
      setError('รหัสประเภทงานใช้ a-z 0-9 และ - เท่านั้น');
      return;
    }
    if (!name.trim() || !unit.trim()) {
      setError('กรุณากรอกชื่อประเภทงานและหน่วยที่ขาย');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await model.createType({ type_code: code.trim(), type_name: name.trim(), sale_unit: unit.trim() });
      onSaved();
      close();
    } catch (e) {
      setError(messageOf(e, 'บันทึกประเภทงานไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal guardUnsaved
      isOpen={isOpen}
      onClose={close}
      title="เพิ่มประเภทงาน"
      description="เช่น แก้ว เสื้อ สติกเกอร์ — กำหนดหน่วยที่ขาย (ชิ้น หรือ แผ่น)"
      size="md"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      footer={
        <>
          <button type="button" onClick={close} disabled={saving} className="ka-btn">
            ยกเลิก
          </button>
          <button type="submit" form="custom-type-form" disabled={saving} className="ka-btn ka-btn--primary">
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </>
      }
    >
      <form id="custom-type-form" onSubmit={submit} className="space-y-4">
        <div className="ka-field">
          <label className="ka-label" htmlFor="type-code">รหัสประเภทงาน</label>
          <input id="type-code" className="ka-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น mug" />
        </div>
        <div className="ka-field">
          <label className="ka-label" htmlFor="type-name">ชื่อประเภทงาน</label>
          <input id="type-name" className="ka-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="ka-field">
          <label className="ka-label" htmlFor="type-unit">หน่วยที่ขาย</label>
          <input id="type-unit" className="ka-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <p className="ka-help">จำนวนที่ลูกค้าสั่งเป็นจำนวนเต็มของหน่วยนี้ เช่น สติกเกอร์ขายเป็นแผ่น</p>
        </div>
        {error && <p role="alert" className="ka-error whitespace-pre-line">{error}</p>}
      </form>
    </Modal>
  );
}

interface TemplateModalProps {
  isOpen: boolean;
  types: CustomProductType[];
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function TemplateModal({ isOpen, types, onClose, onCreated }: TemplateModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const active = types.filter((t) => t.is_active);

  const close = () => {
    setCode('');
    setName('');
    setTypeId('');
    setError('');
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code.trim())) {
      setError('รหัสแบบสินค้าใช้ A-Z 0-9 และ - (2–40 ตัว)');
      return;
    }
    if (!name.trim() || !typeId) {
      setError('กรุณากรอกชื่อแบบสินค้าและเลือกประเภทงาน');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const created = await model.createTemplate({
        template_code: code.trim(),
        template_name: name.trim(),
        custom_product_type_id: typeId,
      });
      onCreated(created.custom_template_id);
      close();
    } catch (e) {
      setError(messageOf(e, 'สร้างแบบสินค้าไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal guardUnsaved
      isOpen={isOpen}
      onClose={close}
      title="เพิ่มแบบสินค้า Custom"
      description="สร้างแล้วจะเป็นฉบับร่าง ลูกค้ายังไม่เห็นจนกว่าจะเผยแพร่"
      size="md"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      footer={
        <>
          <button type="button" onClick={close} disabled={saving} className="ka-btn">
            ยกเลิก
          </button>
          <button type="submit" form="custom-template-form" disabled={saving} className="ka-btn ka-btn--primary">
            {saving ? 'กำลังสร้าง...' : 'สร้างและแก้ไขต่อ'}
          </button>
        </>
      }
    >
      <form id="custom-template-form" onSubmit={submit} className="space-y-4">
        <div className="ka-field">
          <label className="ka-label" htmlFor="tpl-code">รหัสแบบสินค้า</label>
          <input id="tpl-code" className="ka-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="เช่น MUG-11OZ" />
          <p className="ka-help">ใช้อ้างอิงในคำขอของลูกค้า แก้ไขภายหลังไม่ได้</p>
        </div>
        <div className="ka-field">
          <label className="ka-label" htmlFor="tpl-name">ชื่อแบบสินค้า</label>
          <input id="tpl-name" className="ka-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="ka-field">
          <label className="ka-label" htmlFor="tpl-type">ประเภทงาน</label>
          <CustomSelect
            id="tpl-type"
            value={typeId}
            onChange={(value) => setTypeId(value)}
            options={active.map((t) => ({ value: t.custom_product_type_id, label: `${t.type_name}(${t.sale_unit})` }))}
            placeholder="เลือกประเภทงาน"
          />
          {active.length === 0 && <p className="ka-help">ยังไม่มีประเภทงานที่เปิดใช้ กรุณาเพิ่มประเภทงานก่อน</p>}
        </div>
        {error && <p role="alert" className="ka-error whitespace-pre-line">{error}</p>}
      </form>
    </Modal>
  );
}
