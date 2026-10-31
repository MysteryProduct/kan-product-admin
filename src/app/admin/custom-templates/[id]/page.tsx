'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadErrorBanner, { loadErrorText, partialLoadText } from '@/components/LoadErrorBanner';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import StatusBadge from '@/components/StatusBadge';
import { usePermissions } from '@/hooks/usePermissions';
import {
  bodyFromForm,
  clearMeshPicks,
  formFromRevision,
  formProblems,
  REVISION_STATUS_LABEL,
  REVISION_STATUS_TONE,
} from '@/lib/custom-catalog';
import CustomCatalogModel, { MaterialChoice } from '@/models/custom-catalog';
import type { ProductUnit } from '@/types/product-unit';
import type { CustomTemplateHead, DraftForm, RevisionDetail } from '@/types/custom-catalog';
import RevisionEditor from '../components/RevisionEditor';

const model = new CustomCatalogModel();

type Notice = { tone: 'success' | 'error'; text: string } | null;

// The sections of the editor, in page order; each heading carries the id.
const TOC = [
  { id: 'sec-general', label: 'ข้อมูลทั่วไป' },
  { id: 'sec-shape', label: 'รูปทรงและพื้นที่พิมพ์' },
  { id: 'sec-model', label: 'โมเดล 3D' },
  { id: 'sec-groups', label: 'กลุ่มตัวเลือก' },
  { id: 'sec-rules', label: 'ความเข้ากัน' },
  { id: 'sec-recipe', label: 'สูตรวัสดุ' },
];

export default function CustomTemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { can } = usePermissions();
  const canAdd = can('products', 'add');
  const canEdit = can('products', 'edit');

  const [head, setHead] = useState<CustomTemplateHead | null>(null);
  const [revision, setRevision] = useState<RevisionDetail | null>(null);
  const [form, setForm] = useState<DraftForm | null>(null);
  const [saved, setSaved] = useState('');
  const [materials, setMaterials] = useState<MaterialChoice[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirm, setConfirm] = useState<'publish' | 'discard' | 'draft' | null>(null);
  const [pendingRevision, setPendingRevision] = useState<number | null>(null);
  const [section, setSection] = useState(TOC[0].id);
  const [modelBusy, setModelBusy] = useState(false);

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== saved, [form, saved]);

  const open = useCallback(
    async (templateId: string, number?: number) => {
      const t = await model.getTemplate(templateId);
      const target =
        number ??
        t.revisions.find((r) => r.status === 'draft')?.revision ??
        t.revisions.find((r) => r.status === 'published')?.revision ??
        t.revisions[0].revision;
      const detail = await model.getRevision(templateId, target);
      const next = formFromRevision(detail);
      setHead(t);
      setRevision(detail);
      setForm(next);
      setSaved(JSON.stringify(next));
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await open(id);
    } catch (error) {
      setLoadError(loadErrorText('แบบสินค้า', error));
    }
    const [m, u] = await Promise.allSettled([model.getMaterialChoices(), model.getUnitChoices()]);
    if (m.status === 'fulfilled') setMaterials(m.value);
    if (u.status === 'fulfilled') setUnits(u.value);
    setChoiceError(partialLoadText([m.status === 'rejected' && 'วัตถุดิบ', u.status === 'rejected' && 'หน่วย'].filter(Boolean) as string[]));
    setLoading(false);
  }, [id, open]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDraft = revision?.status === 'draft';
  const editable = isDraft && canEdit;
  const problems = form && editable ? formProblems(form) : [];
  const hasDraft = head?.revisions.some((r) => r.status === 'draft') ?? false;

  const run = async (work: () => Promise<void>, failure: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error && error.message ? error.message : failure });
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<boolean> => {
    if (!form || !revision) return false;
    const found = formProblems(form);
    if (found.length > 0) {
      setNotice({ tone: 'error', text: found.join('\n') });
      return false;
    }
    let ok = false;
    await run(async () => {
      const detail = await model.saveDraft(id, revision.revision, bodyFromForm(form));
      const next = formFromRevision(detail);
      setRevision(detail);
      setForm(next);
      setSaved(JSON.stringify(next));
      setNotice({ tone: 'success', text: 'บันทึกฉบับร่างแล้ว' });
      ok = true;
    }, 'บันทึกฉบับร่างไม่สำเร็จ');
    return ok;
  };

  /**
   * The file is stored on the server at once (it is too big to hold back until
   * "save"), and the server drops the old mesh picks with the old file. The
   * other unsaved edits stay; the saved snapshot loses the same picks so the
   * "unsaved" marker stays honest.
   */
  const afterModelChange = (detail: RevisionDetail) => {
    setRevision(detail);
    setForm((prev) => (prev ? clearMeshPicks(prev) : prev));
    setSaved((prev) => (prev ? JSON.stringify(clearMeshPicks(JSON.parse(prev) as DraftForm)) : prev));
  };

  const uploadModel = async (file: File) => {
    if (!revision) return;
    setModelBusy(true);
    setNotice(null);
    try {
      afterModelChange(await model.uploadModel(id, revision.revision, file));
      setNotice({ tone: 'success', text: 'อัปโหลดไฟล์โมเดลแล้ว เลือก mesh ที่รับภาพพิมพ์แล้วบันทึกฉบับร่าง' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error && error.message ? error.message : 'อัปโหลดไฟล์โมเดลไม่สำเร็จ' });
    } finally {
      setModelBusy(false);
    }
  };

  const removeModel = async () => {
    if (!revision) return;
    setModelBusy(true);
    setNotice(null);
    try {
      afterModelChange(await model.deleteModel(id, revision.revision));
      setNotice({ tone: 'success', text: 'ลบไฟล์โมเดลแล้ว ลูกค้าจะเห็นโมเดลพื้นฐาน' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error && error.message ? error.message : 'ลบไฟล์โมเดลไม่สำเร็จ' });
    } finally {
      setModelBusy(false);
    }
  };

  const publish = async () => {
    if (!revision) return;
    setConfirm(null);
    if (dirty && !(await save())) return;
    await run(async () => {
      await model.publish(id, revision.revision);
      await open(id, revision.revision);
      setNotice({ tone: 'success', text: `เผยแพร่ฉบับที่ ${revision.revision} แล้ว ลูกค้าเห็นฉบับนี้ทันที` });
    }, 'เผยแพร่ไม่สำเร็จ');
  };

  const discard = async () => {
    if (!revision) return;
    setConfirm(null);
    await run(async () => {
      await model.discardDraft(id, revision.revision);
      await open(id);
      setNotice({ tone: 'success', text: 'ทิ้งฉบับร่างแล้ว' });
    }, 'ทิ้งฉบับร่างไม่สำเร็จ');
  };

  const createDraft = async () => {
    setConfirm(null);
    await run(async () => {
      const created = await model.createDraft(id);
      await open(id, created.revision);
      setNotice({ tone: 'success', text: `สร้างฉบับร่างที่ ${created.revision} จากฉบับล่าสุดแล้ว` });
    }, 'สร้างฉบับร่างไม่สำเร็จ');
  };

  const choose = async (number: number) => {
    if (revision && number === revision.revision) return;
    if (dirty) {
      setPendingRevision(number);
      return;
    }
    await run(() => open(id, number), 'โหลดฉบับไม่สำเร็จ');
  };

  const published = head?.revisions.find((r) => r.status === 'published');
  const latest = head ? Math.max(...head.revisions.map((r) => r.revision)) : 0;
  const draftRevision = head?.revisions.find((r) => r.status === 'draft')?.revision;

  return (
    <div className="ka-page-body ka-ct">
      {(loading || busy) && <LoadingSkeleton />}
      <LoadErrorBanner message={loadError} onRetry={() => void load()} />
      <LoadErrorBanner message={choiceError} onRetry={() => void load()} />

      {head && revision && form && (
        <>
          <div className="ka-ph">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="ka-code">{head.template_code}</span>
                <StatusBadge tone={REVISION_STATUS_TONE[revision.status]}>{REVISION_STATUS_LABEL[revision.status]}</StatusBadge>
              </div>
              <h1 className="ka-ph__title mt-1">{head.template_name}</h1>
              <p className="ka-ph__lead">
                {head.type_name} · ขายเป็น{head.sale_unit}
                {dirty ? ' · มีการแก้ไขที่ยังไม่บันทึก' : ''}
              </p>
            </div>
            <div className="ka-ct__acts">
              <label htmlFor="ct-revision" className="sr-only">ฉบับ</label>
              <select id="ct-revision" className="ka-input" value={revision.revision} disabled={busy} onChange={(event) => void choose(Number(event.target.value))}>
                {head.revisions
                  .slice()
                  .sort((a, b) => b.revision - a.revision)
                  .map((r) => (
                    <option key={r.revision} value={r.revision}>
                      ฉบับ {r.revision} · {REVISION_STATUS_LABEL[r.status]}
                    </option>
                  ))}
              </select>
              {!isDraft && !hasDraft && canAdd && (
                <button type="button" className="ka-btn ka-btn--primary" disabled={busy} onClick={() => setConfirm('draft')}>
                  สร้างฉบับร่างใหม่
                </button>
              )}
              {!isDraft && hasDraft && draftRevision !== undefined && (
                <button type="button" className="ka-btn" onClick={() => void choose(draftRevision)}>
                  ไปที่ฉบับร่าง {draftRevision}
                </button>
              )}
              <button type="button" className="ka-btn ka-btn--ghost" onClick={() => router.push('/admin/custom-templates')}>
                ← รายการแบบสินค้า
              </button>
            </div>
          </div>

          {!isDraft && (
            <div role="note" className="ka-banner mb-4">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" />
              </svg>
              <div>
                <strong>{revision.status === 'published' ? 'ฉบับนี้เผยแพร่แล้ว แก้ไขไม่ได้' : 'ฉบับนี้เก็บถาวรแล้ว แก้ไขไม่ได้'}</strong>
                <div className="text-[14px]">ราคาและสูตรที่ลูกค้าสั่งไปแล้วต้องคงเดิม ถ้าจะเปลี่ยน ให้สร้างฉบับร่างใหม่จากฉบับล่าสุด</div>
              </div>
            </div>
          )}
          {isDraft && !canEdit && (
            <div role="note" className="ka-banner mb-4">
              <span>คุณดูฉบับร่างนี้ได้ แต่ไม่มีสิทธิ์แก้ไข</span>
            </div>
          )}

          {notice && (
            <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`ka-banner ka-banner--${notice.tone === 'error' ? 'danger' : 'success'} mb-4 whitespace-pre-line`}>
              <span>{notice.text}</span>
            </div>
          )}

          <div className="ka-ct__layout">
            <nav className="ka-toc" aria-label="ส่วนของแบบสินค้า">
              {TOC.map((item) => (
                <a key={item.id} href={`#${item.id}`} aria-current={section === item.id ? 'location' : undefined} onClick={() => setSection(item.id)}>
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="min-w-0">
              <RevisionEditor
                form={form}
                setForm={setForm as never}
                readOnly={!editable}
                saleUnit={head.sale_unit}
                materials={materials}
                units={units}
                modelFile={revision.model_file}
                modelBusy={modelBusy}
                loadModelBytes={() => model.getModelBytes(id, revision.revision)}
                onUploadModel={uploadModel}
                onRemoveModel={removeModel}
              />
            </div>
          </div>

          {editable && (
            <div className="ka-savebar" aria-label="การดำเนินการกับฉบับร่าง">
              {problems.length > 0 ? (
                <span className="ka-error ka-savebar__hint" role="status">
                  {problems[0]}
                  {problems.length > 1 ? ` และอีก ${problems.length - 1} ข้อ` : ''}
                </span>
              ) : (
                <span className="ka-todo__cap ka-savebar__hint" role="status">{dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'บันทึกแล้ว'}</span>
              )}
              <span className="ka-table-tools__spacer" />
              {head.revisions.length > 1 && (
                <button type="button" className="ka-btn ka-btn--danger" disabled={busy} onClick={() => setConfirm('discard')}>
                  ทิ้งฉบับร่าง
                </button>
              )}
              <button type="button" className="ka-btn" disabled={busy || !dirty || problems.length > 0} onClick={() => void save()}>
                บันทึกฉบับร่าง
              </button>
              <button type="button" className="ka-btn ka-btn--primary" disabled={busy || problems.length > 0} onClick={() => setConfirm('publish')}>
                {dirty ? 'บันทึกและเผยแพร่' : 'เผยแพร่'}
              </button>
            </div>
          )}

          <ConfirmDialog
            isOpen={confirm === 'draft'}
            title={`สร้างฉบับ ${latest + 1} จากฉบับ ${published?.revision ?? latest}`}
            message={`ฉบับร่างจะคัดลอกทุกอย่างจากฉบับ ${published?.revision ?? latest}${published ? ` ฉบับ ${published.revision} ยังเปิดขายต่อจนกว่าคุณจะเผยแพร่ฉบับใหม่` : ''} ขั้นตอน: ร่าง → ตรวจ → เผยแพร่`}
            tone="neutral"
            confirmLabel="สร้างฉบับร่าง"
            onConfirm={() => void createDraft()}
            onCancel={() => setConfirm(null)}
          />
          <ConfirmDialog
            isOpen={confirm === 'publish'}
            title={`เผยแพร่ฉบับ ${revision.revision}?`}
            message="ลูกค้าจะเห็นตัวเลือกและราคานี้ทันที ฉบับที่เผยแพร่อยู่เดิมจะถูกเก็บถาวร และฉบับที่เผยแพร่แล้วแก้ไขไม่ได้"
            tone="neutral"
            confirmLabel="เผยแพร่ฉบับนี้"
            onConfirm={() => void publish()}
            onCancel={() => setConfirm(null)}
          />
          <ConfirmDialog
            isOpen={confirm === 'discard'}
            title={`ทิ้งฉบับร่าง ${revision.revision}?`}
            message="การแก้ไขในฉบับร่างนี้จะหายไปทั้งหมด ฉบับที่เผยแพร่อยู่ไม่ได้รับผลกระทบ"
            confirmLabel="ทิ้งฉบับร่าง"
            onConfirm={() => void discard()}
            onCancel={() => setConfirm(null)}
          />
          <ConfirmDialog
            isOpen={pendingRevision !== null}
            title="ยังไม่ได้บันทึกการแก้ไข"
            message="ถ้าเปลี่ยนฉบับตอนนี้ การแก้ไขในฉบับร่างนี้จะหายไป"
            confirmLabel="ทิ้งการแก้ไขและเปลี่ยนฉบับ"
            cancelLabel="แก้ไขต่อ"
            onConfirm={() => {
              const target = pendingRevision;
              setPendingRevision(null);
              if (target !== null) void run(() => open(id, target), 'โหลดฉบับไม่สำเร็จ');
            }}
            onCancel={() => setPendingRevision(null)}
          />
        </>
      )}
    </div>
  );
}
