'use client';

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { printAspect, printHeightLimitMm, wrapLimitMm } from '@/lib/custom-catalog';
import type { ModelFileInfo, ModelForm, ModelShape } from '@/types/custom-catalog';
import { BACK_TINT, FRONT_TINT } from './ModelViewer';

// three is large; load it only when a file is there to look at.
const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false });

const sectionClass = 'ka-card ka-ct__section relative';
const MAX_BYTES = 15 * 1024 * 1024;

const SHAPES: { value: ModelShape; label: string; hint: string }[] = [
  { value: 'flat', label: 'แผ่นเรียบ', hint: 'สติ๊กเกอร์ ป้าย แผ่นพิมพ์' },
  { value: 'shirt', label: 'เสื้อ', hint: 'พิมพ์ด้านหน้าและด้านหลัง' },
  { value: 'cup', label: 'แก้ว', hint: 'พิมพ์รอบตัวแก้ว' },
];

interface ShapeProps {
  form: ModelForm;
  onChange: (next: ModelForm) => void;
  readOnly: boolean;
  /** Whether a file is stored: the Builder draws its own stand-in without one. */
  hasFile: boolean;
}

function MmField({ id, label, value, onChange, disabled, help }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean; help?: string }) {
  return (
    <div className="ka-field content-start">
      <label className="ka-label" htmlFor={id}>{label}</label>
      <div className="ka-input-wrap">
        <input id={id} className="ka-input" inputMode="decimal" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-describedby={help ? `${id}-help` : undefined} />
        <span className="ka-suffix" aria-hidden="true">มม.</span>
      </div>
      {help && <p id={`${id}-help`} className="ka-help">{help}</p>}
    </div>
  );
}

/** Proportions of the front print area, drawn to scale so a typo shows at once. */
function AreaSketch({ form }: { form: ModelForm }) {
  const aspect = printAspect(form.front);
  if (aspect === null) return null;
  const box = 150;
  const w = aspect >= 1 ? box : box * aspect;
  const h = aspect >= 1 ? box / aspect : box;
  return (
    <figure className="flex items-center gap-3">
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} role="img" aria-label={`สัดส่วนพื้นที่พิมพ์ ${aspect.toFixed(2)} ต่อ 1`} className="shrink-0 rounded-lg bg-[var(--bg-subtle)]">
        <rect x={(box - w) / 2} y={(box - h) / 2} width={w} height={h} rx="3" fill="var(--brand-soft)" stroke="var(--action)" strokeWidth="1.5" />
      </svg>
      <figcaption className="text-sm text-[var(--ink-muted)]">
        <span className="font-medium tabular-nums text-[var(--ink)]">{aspect.toFixed(2)} : 1</span>
        <br />
        กว้าง ÷ สูง ของพื้นที่พิมพ์ที่ลูกค้าจะออกแบบ
      </figcaption>
    </figure>
  );
}

export function ShapeSection({ form, onChange, readOnly, hasFile }: ShapeProps) {
  const name = useId();
  const patch = (changes: Partial<ModelForm>) => onChange({ ...form, ...changes });
  const wrap = form.shape === 'cup' ? wrapLimitMm(form) : null;
  const room = form.shape === 'cup' ? printHeightLimitMm(form) : null;
  const tooWide = wrap !== null && Number(form.front.width) > wrap * 1.001;
  const tooTall = room !== null && Number(form.front.height) > room + 0.05;

  return (
    <section className={sectionClass} aria-labelledby="sec-shape">
      <h3 id="sec-shape" className="text-base font-semibold text-[var(--ink)]">รูปทรงและพื้นที่พิมพ์</h3>
      <p className="text-sm text-[var(--ink-muted)]">
        ขนาดจริงของผิวที่รับภาพ ลูกค้าออกแบบในสัดส่วนนี้ — ไม่กรอกจะใช้ขนาดพื้นฐานของระบบ
        {!hasFile && ' และโมเดลพื้นฐาน'}
      </p>

      <fieldset className="mt-4" disabled={readOnly}>
        <legend className="ka-label">รูปทรงสินค้า</legend>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SHAPES.map((s) => (
            <label
              key={s.value}
              className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-[var(--border-control)] bg-[var(--bg-surface)] px-3 py-2 has-[:checked]:border-[var(--action)] has-[:checked]:bg-[var(--brand-soft)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                <input type="radio" name={name} className="accent-[var(--action)]" checked={form.shape === s.value} onChange={() => patch({ shape: s.value })} />
                {s.label}
              </span>
              <span className="pl-6 text-xs text-[var(--ink-muted)]">{s.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          {form.shape === 'cup' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MmField id="cup-top" label="เส้นผ่านศูนย์กลางปาก" value={form.cup.top} disabled={readOnly} onChange={(v) => patch({ cup: { ...form.cup, top: v } })} />
              <MmField id="cup-bottom" label="เส้นผ่านศูนย์กลางก้น" value={form.cup.bottom} disabled={readOnly} onChange={(v) => patch({ cup: { ...form.cup, bottom: v } })} />
              <MmField id="cup-height" label="ความสูงแก้ว" value={form.cup.height} disabled={readOnly} onChange={(v) => patch({ cup: { ...form.cup, height: v } })} />
              <MmField id="cup-mt" label="ระยะขอบบน" value={form.cup.marginTop} disabled={readOnly} onChange={(v) => patch({ cup: { ...form.cup, marginTop: v } })} help="จากปากแก้วถึงขอบบนของผิวพิมพ์" />
              <MmField id="cup-mb" label="ระยะขอบล่าง" value={form.cup.marginBottom} disabled={readOnly} onChange={(v) => patch({ cup: { ...form.cup, marginBottom: v } })} help="จากก้นแก้วถึงขอบล่างของผิวพิมพ์" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <MmField
              id="front-w"
              label={form.shape === 'cup' ? 'กว้างรอบแก้ว (พื้นที่พิมพ์)' : form.shape === 'shirt' ? 'ด้านหน้า กว้าง' : 'พื้นที่พิมพ์ กว้าง'}
              value={form.front.width}
              disabled={readOnly}
              onChange={(v) => patch({ front: { ...form.front, width: v } })}
              help={wrap !== null ? `รอบได้มากสุด ≈ ${wrap.toFixed(1)} มม. (จากด้านที่ใหญ่กว่า)` : undefined}
            />
            <MmField
              id="front-h"
              label={form.shape === 'cup' ? 'สูง (พื้นที่พิมพ์)' : form.shape === 'shirt' ? 'ด้านหน้า สูง' : 'พื้นที่พิมพ์ สูง'}
              value={form.front.height}
              disabled={readOnly}
              onChange={(v) => patch({ front: { ...form.front, height: v } })}
              help={room !== null ? `สูงได้มากสุด ≈ ${room.toFixed(1)} มม. ระหว่างขอบ` : undefined}
            />
            {form.shape === 'shirt' && (
              <>
                <MmField id="back-w" label="ด้านหลัง กว้าง" value={form.back.width} disabled={readOnly} onChange={(v) => patch({ back: { ...form.back, width: v } })} />
                <MmField id="back-h" label="ด้านหลัง สูง" value={form.back.height} disabled={readOnly} onChange={(v) => patch({ back: { ...form.back, height: v } })} />
              </>
            )}
          </div>

          {(tooWide || tooTall) && (
            <div className="ka-banner ka-banner--warning" role="status">
              <span>
                {tooWide && `ความกว้างเกินเส้นรอบวงที่แก้วนี้พิมพ์ได้ (≈ ${wrap!.toFixed(1)} มม.) `}
                {tooTall && `ความสูงเกินช่วงระหว่างระยะขอบ (≈ ${room!.toFixed(1)} มม.)`}
              </span>
            </div>
          )}
        </div>
        <AreaSketch form={form} />
      </div>
    </section>
  );
}

interface ModelProps {
  form: ModelForm;
  onChange: (next: ModelForm) => void;
  readOnly: boolean;
  file: ModelFileInfo | null;
  busy: boolean;
  loadBytes: () => Promise<ArrayBuffer>;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  /** Values of the colour group, for previewing a colour on the model. */
  colors: { key: string; label: string; hex: string }[];
}

const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function ModelSection({ form, onChange, readOnly, file, busy, loadBytes, onUpload, onRemove, colors }: ModelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [viewerNote, setViewerNote] = useState('');
  const [fileNote, setFileNote] = useState('');
  const [previewKey, setPreviewKey] = useState('');
  const fileId = file?.custom_model_file_id ?? null;
  const load = useRef(loadBytes);
  useEffect(() => {
    load.current = loadBytes;
  });

  useEffect(() => {
    setBytes(null);
    setViewerNote('');
    if (!fileId) return;
    let live = true;
    load.current()
      .then((b) => live && setBytes(b))
      .catch(() => live && setViewerNote('โหลดไฟล์มาแสดงตัวอย่างไม่สำเร็จ — เลือก mesh จากรายการด้านบนได้ตามปกติ'));
    return () => {
      live = false;
    };
  }, [fileId]);

  const patch = (changes: Partial<ModelForm>) => onChange({ ...form, ...changes });
  const choose = async (picked: File | undefined) => {
    if (!picked) return;
    setFileNote('');
    if (!/\.glb$/i.test(picked.name)) return setFileNote('เลือกได้เฉพาะไฟล์ .glb');
    if (picked.size > MAX_BYTES) return setFileNote('ไฟล์ใหญ่เกิน 15 MB');
    try {
      await onUpload(picked);
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const meshes = file?.meshes ?? [];
  const printOptions = (current: string) => (
    <>
      <option value="">ยังไม่เลือก</option>
      {current && !meshes.some((m) => m.name === current) && <option value={current}>{current} (ไม่พบในไฟล์)</option>}
      {meshes.map((m) => (
        <option key={m.name} value={m.name} disabled={!m.has_uv}>
          {m.name}{m.has_uv ? '' : ' — ไม่มี UV รับภาพไม่ได้'}
        </option>
      ))}
    </>
  );
  const preview = colors.find((c) => c.key === previewKey) ?? colors[0];

  return (
    <section className={sectionClass} aria-labelledby="sec-model">
      <h3 id="sec-model" className="text-base font-semibold text-[var(--ink)]">โมเดล 3D</h3>
      <p className="text-sm text-[var(--ink-muted)]">ไฟล์ของร้านเอง (GLB) — ถ้าไม่มี ลูกค้าจะเห็นโมเดลพื้นฐานที่ปรับตามรูปทรงด้านบน</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={input} id="model-file" type="file" accept=".glb,model/gltf-binary" className="sr-only" disabled={readOnly || busy} onChange={(e) => void choose(e.target.files?.[0])} />
        {!readOnly && (
          <label htmlFor="model-file" className={`ka-btn ka-btn--sm ${busy ? 'opacity-50' : 'cursor-pointer'}`} aria-disabled={busy}>
            {busy ? 'กำลังอัปโหลด…' : file ? 'เปลี่ยนไฟล์ GLB' : 'เลือกไฟล์ GLB'}
          </label>
        )}
        {!readOnly && file && (
          <button type="button" className="ka-btn ka-btn--danger ka-btn--sm" disabled={busy} onClick={() => void onRemove()}>
            ลบไฟล์
          </button>
        )}
        <span className="text-sm text-[var(--ink-muted)]">GLB เท่านั้น ไม่เกิน 15 MB — ระบบตรวจจากเนื้อไฟล์</span>
      </div>
      {fileNote && <p className="mt-2 text-sm text-[var(--danger)]" role="alert">{fileNote}</p>}

      {!file && <p className="mt-3 text-sm text-[var(--ink-muted)]">ยังไม่มีไฟล์โมเดล</p>}
      {file && (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div><dt className="text-[var(--ink-muted)]">ไฟล์</dt><dd className="break-all font-medium text-[var(--ink)]">{file.original_name}</dd></div>
          <div><dt className="text-[var(--ink-muted)]">ขนาด</dt><dd className="font-medium tabular-nums text-[var(--ink)]">{sizeText(file.size_bytes)}</dd></div>
          <div><dt className="text-[var(--ink-muted)]">สามเหลี่ยม</dt><dd className="font-medium tabular-nums text-[var(--ink)]">{file.triangle_count.toLocaleString('en-US')}</dd></div>
          <div><dt className="text-[var(--ink-muted)]">mesh</dt><dd className="font-medium tabular-nums text-[var(--ink)]">{file.meshes.length}</dd></div>
        </dl>
      )}

      {file && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="ka-field content-start">
              <label className="ka-label" htmlFor="mesh-front">{form.shape === 'shirt' ? 'mesh พิมพ์ด้านหน้า' : 'mesh ที่รับภาพพิมพ์'}</label>
              <select id="mesh-front" className="ka-input" disabled={readOnly} value={form.front.mesh} onChange={(e) => patch({ front: { ...form.front, mesh: e.target.value } })}>
                {printOptions(form.front.mesh)}
              </select>
              <p className="ka-help"><span aria-hidden="true" className="mr-1 inline-block size-2.5 rounded-sm align-baseline" style={{ background: FRONT_TINT }} />ไฮไลต์ส้มในตัวอย่าง</p>
            </div>
            {form.shape === 'shirt' && (
              <div className="ka-field content-start">
                <label className="ka-label" htmlFor="mesh-back">mesh พิมพ์ด้านหลัง</label>
                <select id="mesh-back" className="ka-input" disabled={readOnly} value={form.back.mesh} onChange={(e) => patch({ back: { ...form.back, mesh: e.target.value } })}>
                  {printOptions(form.back.mesh)}
                </select>
                <p className="ka-help"><span aria-hidden="true" className="mr-1 inline-block size-2.5 rounded-sm align-baseline" style={{ background: BACK_TINT }} />ไฮไลต์เขียวในตัวอย่าง</p>
              </div>
            )}
            <div className="ka-field content-start">
              <label className="ka-label" htmlFor="mesh-body">mesh ตัวสินค้า (รับสี)</label>
              <select id="mesh-body" className="ka-input" disabled={readOnly} value={form.body_mesh} onChange={(e) => patch({ body_mesh: e.target.value })}>
                <option value="">ไม่ย้อมสี</option>
                {form.body_mesh && !meshes.some((m) => m.name === form.body_mesh) && <option value={form.body_mesh}>{form.body_mesh} (ไม่พบในไฟล์)</option>}
                {meshes.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
              <p className="ka-help">สีที่ลูกค้าเลือกจะย้อมเฉพาะ mesh นี้ ไม่ย้อมผิวพิมพ์</p>
            </div>
            {colors.length > 0 && (
              <div className="ka-field content-start">
                <label className="ka-label" htmlFor="preview-color">ดูตัวอย่างสี</label>
                <select id="preview-color" className="ka-input" value={preview?.key ?? ''} onChange={(e) => setPreviewKey(e.target.value)}>
                  {colors.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.hex})</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            {bytes && !viewerNote ? (
              <ModelViewer bytes={bytes} frontMesh={form.front.mesh} backMesh={form.shape === 'shirt' ? form.back.mesh : ''} bodyMesh={form.body_mesh} colorHex={preview?.hex ?? ''} onFailed={setViewerNote} />
            ) : (
              !viewerNote && <p className="grid h-40 place-items-center rounded-xl bg-[var(--bg-subtle)] text-sm text-[var(--ink-muted)]" role="status">กำลังโหลดไฟล์…</p>
            )}
            {viewerNote && <div className="ka-banner ka-banner--warning" role="status"><span>{viewerNote}</span></div>}
            <p className="ka-help mt-2">ตัวอย่างใช้ดูเท่านั้น ลากเพื่อหมุน เลื่อนล้อเมาส์เพื่อซูม — เลือก mesh จากรายการได้ครบโดยไม่ต้องใช้ตัวอย่าง</p>
          </div>
        </div>
      )}
    </section>
  );
}
