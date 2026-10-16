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
  const [confirm, setConfirm] = useState<'publish' | 'discard' | null>(null);

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

  const publish = async () => {
    if (!revision) return;
    if (dirty && !(await save())) return;
    await run(async () => {
      await model.publish(id, revision.revision);
      await open(id, revision.revision);
      setNotice({ tone: 'success', text: `เผยแพร่ฉบับที่ ${revision.revision} แล้ว ลูกค้าเห็นฉบับนี้ทันที` });
    }, 'เผยแพร่ไม่สำเร็จ');
  };

  const discard = async () => {
    if (!revision) return;
    await run(async () => {
      await model.discardDraft(id, revision.revision);
      await open(id);
      setNotice({ tone: 'success', text: 'ทิ้งฉบับร่างแล้ว' });
    }, 'ทิ้งฉบับร่างไม่สำเร็จ');
  };

  const createDraft = async () => {
    await run(async () => {
      const created = await model.createDraft(id);
      await open(id, created.revision);
      setNotice({ tone: 'success', text: `สร้างฉบับร่างที่ ${created.revision} จากฉบับล่าสุดแล้ว` });
    }, 'สร้างฉบับร่างไม่สำเร็จ');
  };

  const choose = async (number: number) => {
    if (revision && number === revision.revision) return;
    if (dirty && !window.confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการเปลี่ยนฉบับและทิ้งการแก้ไขนี้หรือไม่?')) return;
    await run(() => open(id, number), 'โหลดฉบับไม่สำเร็จ');
  };

  return (
    <div className="space-y-6 bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
      {(loading || busy) && <LoadingSkeleton />}
      <LoadErrorBanner message={loadError} onRetry={() => void load()} />
      <LoadErrorBanner message={choiceError} onRetry={() => void load()} />

      {head && revision && form && (
        <>
          <section className="rounded-2xl bg-[var(--bg-surface)] p-4 shadow-sm">
            <button type="button" className="ka-btn ka-btn--ghost ka-btn--sm" onClick={() => router.push('/admin/custom-templates')}>
              ← กลับรายการแบบสินค้า
            </button>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--ink)]">
                  {head.template_code} · {head.template_name}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {head.type_name} · ขายเป็น{head.sale_unit}
                </p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="เลือกฉบับ">
                {head.revisions.map((r) => (
                  <button
                    key={r.revision}
                    type="button"
                    className={`ka-btn ka-btn--sm ${r.revision === revision.revision ? 'ka-btn--primary' : ''}`}
                    aria-pressed={r.revision === revision.revision}
                    onClick={() => void choose(r.revision)}
                  >
                    ฉบับ {r.revision} · {REVISION_STATUS_LABEL[r.status]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge tone={REVISION_STATUS_TONE[revision.status]}>{REVISION_STATUS_LABEL[revision.status]}</StatusBadge>
              {!isDraft && (
                <span className="text-sm text-[var(--ink-muted)]">
                  ฉบับที่เผยแพร่แล้วเปลี่ยนไม่ได้ ราคาและสูตรที่คำขอเก่าใช้จึงคงเดิม — ต้องการเปลี่ยนให้สร้างฉบับร่างใหม่
                </span>
              )}
              {!isDraft && !hasDraft && canAdd && (
                <button type="button" className="ka-btn ka-btn--sm ka-btn--primary" disabled={busy} onClick={() => void createDraft()}>
                  สร้างฉบับร่างใหม่จากฉบับล่าสุด
                </button>
              )}
              {!isDraft && hasDraft && (
                <button
                  type="button"
                  className="ka-btn ka-btn--sm"
                  onClick={() => void choose(head.revisions.find((r) => r.status === 'draft')!.revision)}
                >
                  ไปที่ฉบับร่าง
                </button>
              )}
            </div>
          </section>

          {notice && (
            <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`ka-banner ka-banner--${notice.tone === 'error' ? 'danger' : 'success'} whitespace-pre-line`}>
              <span>{notice.text}</span>
            </div>
          )}

          <RevisionEditor form={form} setForm={setForm as never} readOnly={!editable} saleUnit={head.sale_unit} materials={materials} units={units} />

          {editable && (
            <section className="sticky bottom-0 z-10 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-sm" aria-label="การดำเนินการกับฉบับร่าง">
              {problems.length > 0 && (
                <ul className="mb-2 list-disc pl-5 text-sm text-[var(--danger)]">
                  {problems.slice(0, 4).map((p) => <li key={p}>{p}</li>)}
                  {problems.length > 4 && <li>และอีก {problems.length - 4} ข้อ</li>}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {dirty && <span className="mr-auto text-sm text-[var(--ink-muted)]">มีการแก้ไขที่ยังไม่บันทึก</span>}
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
            </section>
          )}

          <ConfirmDialog
            isOpen={confirm === 'publish'}
            title="ยืนยันการเผยแพร่"
            message={`เผยแพร่ฉบับที่ ${revision.revision}? ลูกค้าจะเห็นตัวเลือกและราคานี้ทันที ฉบับที่เผยแพร่อยู่เดิมจะถูกเก็บถาวร และฉบับที่เผยแพร่แล้วแก้ไขไม่ได้`}
            bottom_className="ka-btn ka-btn--primary min-h-11"
            onConfirm={() => void publish()}
            onCancel={() => setConfirm(null)}
          />
          <ConfirmDialog
            isOpen={confirm === 'discard'}
            title="ยืนยันการทิ้งฉบับร่าง"
            message={`ทิ้งฉบับร่างที่ ${revision.revision} ทั้งหมด? การแก้ไขในฉบับร่างนี้จะหายไป`}
            onConfirm={() => void discard()}
            onCancel={() => setConfirm(null)}
          />
        </>
      )}
    </div>
  );
}
