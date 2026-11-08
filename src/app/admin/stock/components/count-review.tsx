'use client';

import { useState } from 'react';
import axios from 'axios';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/CustomSelect';
import { getApiErrorMessage } from '@/lib/api-error';
import StockModel, {
  ADJUSTMENT_REASONS,
  countItemLabel,
  type AdjustmentReason,
  type CountDetail,
  type CountLine,
  type StockKind,
} from '@/models/stock';
import { Icon } from './icons';

const stockModel = new StockModel();
const REASON_OPTIONS = Object.entries(ADJUSTMENT_REASONS).map(([value, label]) => ({ value, label }));
const NO_COST = 'ไม่มีต้นทุน';
const formatCount = (value: number) => value.toLocaleString('th-TH');
const signed = (value: number) =>
  value === 0 ? '0' : `${value > 0 ? '+' : '−'}${formatCount(Math.abs(value))}`;
const money = (value: number) =>
  `${value < 0 ? '−' : value > 0 ? '+' : ''}฿${Math.abs(value).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

type Draft = { reason: AdjustmentReason | ''; detail: string; saving: boolean; error: string };

const draftsOf = (lines: CountLine[]) =>
  Object.fromEntries(
    lines.map((line) => [
      line.id,
      { reason: line.reason ?? '', detail: line.detail ?? '', saving: false, error: '' } as Draft,
    ]),
  );

/** The close refusal names its items; the plain message alone would not say which. */
function closeIssues(error: unknown) {
  if (!axios.isAxiosError<{ items?: { id: string; itemName: string; reason?: string }[] }>(error)) return [];
  return error.response?.data?.items ?? [];
}

export default function CountReview({
  kind,
  round,
  canEdit,
  onRefresh,
  onClosed,
}: {
  kind: StockKind;
  round: CountDetail;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
  onClosed: (codes: string[]) => void;
}) {
  const open = round.status === 'reviewing';
  const editable = open && canEdit;
  const lines = round.items.filter((line) => line.diffQty !== 0);
  const summary = round.summary;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftsOf(round.items));
  const [savedReasons, setSavedReasons] = useState<Record<string, boolean>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<{ id: string; itemName: string; reason?: string }[]>([]);

  const [seenRound, setSeenRound] = useState(round);
  if (round !== seenRound) {
    setSeenRound(round);
    setDrafts(draftsOf(round.items));
    setSavedReasons(Object.fromEntries(round.items.map((line) => [line.id, Boolean(line.reason)])));
  }

  const patch = (id: string, next: Partial<Draft>) =>
    setDrafts((all) => ({ ...all, [id]: { ...all[id], ...next } }));

  async function saveReason(line: CountLine, reason: AdjustmentReason, detail: string) {
    patch(line.id, { saving: true, error: '' });
    try {
      await stockModel.saveCountReason(kind, round.id, line.id, reason, detail.trim());
      setSavedReasons((all) => ({ ...all, [line.id]: true }));
      patch(line.id, { saving: false });
    } catch (err) {
      setSavedReasons((all) => ({ ...all, [line.id]: false }));
      patch(line.id, { saving: false, error: `บันทึกเหตุผลไม่สำเร็จ: ${getApiErrorMessage(err)}` });
    }
  }

  function pickReason(line: CountLine, value: string) {
    const reason = value as AdjustmentReason;
    patch(line.id, { reason });
    // "อื่น ๆ" needs its detail first; the row saves when that is filled in.
    if (reason === 'other' && !drafts[line.id]?.detail.trim()) {
      setSavedReasons((all) => ({ ...all, [line.id]: false }));
      return;
    }
    void saveReason(line, reason, drafts[line.id]?.detail ?? '');
  }

  const toggleMark = (id: string) => {
    const next = new Set(marked);
    if (!next.delete(id)) next.add(id);
    setMarked(next);
  };

  async function recount() {
    setConfirming(false);
    setPending(true);
    setError('');
    try {
      await stockModel.recountRound(kind, round.id, [...marked]);
      await onRefresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setPending(false);
    }
  }

  async function close() {
    setPending(true);
    setError('');
    setIssues([]);
    try {
      const { adjustmentCodes } = await stockModel.closeRound(kind, round.id);
      onClosed(adjustmentCodes);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setIssues(closeIssues(err));
      setPending(false);
    }
  }

  const missing = lines.filter((line) => !savedReasons[line.id]).length;
  const blocked = lines.filter((line) => line.blockedReason).length;
  const saving = Object.values(drafts).some((draft) => draft.saving);
  const allNoCost = summary ? summary.noCost > 0 && summary.noCost >= summary.short + summary.over : false;
  const message = !open
    ? 'รอบนี้ปิดแล้ว ดูผลได้อย่างเดียว'
    : !canEdit
      ? 'รอผู้มีสิทธิ์ตรวจผลนับ'
      : blocked > 0
        ? `มี ${formatCount(blocked)} รายการที่สร้างคำขอปรับยอดไม่ได้ ส่งทั้งรอบไม่ได้จนกว่าจะแก้หรือส่งนับซ้ำ`
        : missing > 0
          ? `เลือกเหตุผลให้ครบ เหลือ ${formatCount(missing)} รายการ`
          : lines.length === 0
            ? 'รอบนี้ไม่มีผลต่าง ปิดรอบได้เลย'
            : 'ส่งแล้วระบบสร้างคำขอปรับยอดตามรายการนี้ ยอดจริงเปลี่ยนเมื่ออนุมัติ';

  return (
    <>
      <div className="ph">
        <div>
          <h1>{open ? 'ตรวจผลนับ' : 'ผลนับ'} <span className="code">{round.code}</span></h1>
          <p className="cap lead">เทียบยอดที่ควรมีกับของจริง ยอดที่ควรมีหักความเคลื่อนไหวระหว่างนับแล้ว</p>
        </div>
      </div>

      {summary && (
        <dl className="sum4" aria-label="สรุปผลนับ">
          <div className="stat"><dt>ตรงกัน</dt><dd>{formatCount(summary.matched)}</dd></div>
          <div className="stat"><dt>ขาด</dt><dd>{formatCount(summary.short)}</dd></div>
          <div className="stat"><dt>เกิน</dt><dd>{formatCount(summary.over)}</dd></div>
          <div className="stat">
            <dt>มูลค่าต่างสุทธิ</dt>
            <dd>{allNoCost ? NO_COST : money(summary.netValue)}</dd>
            {!allNoCost && summary.noCost > 0 && (
              <span className="cap">ไม่รวม {formatCount(summary.noCost)} รายการที่{NO_COST}</span>
            )}
          </div>
        </dl>
      )}

      <section className="card sess">
        <div className="chd">
          <h2>รายการที่ไม่ตรง</h2>
          <span className={`bd ${lines.length ? 'wn' : 'ok'}`}>{formatCount(lines.length)} รายการ</span>
        </div>
        {lines.length === 0 ? (
          <div className="empty">
            <span className="ric ok"><Icon name="tick" /></span>
            <h3>ตรงทุกรายการ</h3>
            <p className="cap">รอบนี้ไม่มีผลต่าง</p>
          </div>
        ) : (
          <>
            <div className="diff h" aria-hidden="true">
              <span>รายการ</span><span className="r">ยอดระบบ</span><span className="r">ระหว่างนับ</span>
              <span className="r">นับได้</span><span className="r">ต่าง</span><span className="r">มูลค่า</span>
              <span className="hmd">เหตุผล</span><span className="hmd" />
            </div>
            {lines.map((line) => {
              const name = countItemLabel(line);
              const draft = drafts[line.id];
              const diff = line.diffQty ?? 0;
              const codes = line.lots?.map((lot) => lot.adjustmentCode).filter(Boolean) ?? [];
              return (
                <div className="diff" key={line.id}>
                  <div className="dname">
                    <div className="hname strong">{name}</div>
                    <div className="cap code">{line.itemCode ?? '-'}</div>
                  </div>
                  <div className="r num" data-l="ยอดระบบ">{formatCount(line.openingQty ?? 0)}</div>
                  <div className="r num" data-l="ระหว่างนับ">{signed(line.movementQty ?? 0)}</div>
                  <div className="r num strong" data-l="นับได้">{formatCount(line.countedQty ?? 0)}</div>
                  <div className={`r qty ${diff > 0 ? 'plus' : 'minus'}`} data-l="ต่าง">{signed(diff)}</div>
                  <div className="r num" data-l="มูลค่า">{line.diffValue == null ? NO_COST : money(line.diffValue)}</div>
                  <div className="dreason">
                    {editable ? (
                      <CustomSelect
                        options={REASON_OPTIONS}
                        value={draft?.reason ?? ''}
                        placeholder="เลือกเหตุผล"
                        aria-label={`เหตุผลของ ${name}`}
                        disabled={pending || marked.has(line.id)}
                        onChange={(value) => pickReason(line, value)}
                      />
                    ) : (
                      <span>{line.reason ? ADJUSTMENT_REASONS[line.reason] : '-'}</span>
                    )}
                  </div>
                  <div className="dbtn">
                    {editable && (
                      <button
                        type="button"
                        className={`ka-btn ka-btn--sm${marked.has(line.id) ? ' ka-btn--primary' : ' ka-btn--ghost'}`}
                        aria-pressed={marked.has(line.id)}
                        disabled={pending}
                        onClick={() => toggleMark(line.id)}
                      >
                        นับซ้ำ
                      </button>
                    )}
                  </div>
                  {editable && draft?.reason === 'other' && (
                    <label className="dnote">
                      <span className="cap">รายละเอียดของเหตุผล (จำเป็น)</span>
                      <input
                        className="cin wide"
                        type="text"
                        maxLength={500}
                        value={draft.detail}
                        disabled={pending}
                        onChange={(event) => patch(line.id, { detail: event.target.value })}
                        onBlur={() => {
                          if (draft.detail.trim()) void saveReason(line, 'other', draft.detail);
                        }}
                      />
                    </label>
                  )}
                  {!editable && line.detail && <p className="dnote cap">{line.detail}</p>}
                  {line.blockedReason && (
                    <p className="dnote field-error" role="alert">สร้างคำขอไม่ได้: {line.blockedReason}</p>
                  )}
                  {open && !line.blockedReason && (line.lots?.length ?? 0) > 1 && (
                    <p className="dnote cap">แยกเป็น {formatCount(line.lots!.length)} คำขอตามล็อต</p>
                  )}
                  {codes.length > 0 && <p className="dnote cap">คำขอปรับยอด <span className="code">{codes.join(', ')}</span></p>}
                  {draft?.error && <p className="dnote field-error" role="alert">{draft.error}</p>}
                </div>
              );
            })}
          </>
        )}

        <div className="sbar">
          <span className="cap sbm">{message}</span>
          {error && (
            <div role="alert" className="field-error sbe">
              {error}
              {issues.map((item) => (
                <div key={item.id}>{item.itemName}{item.reason ? `: ${item.reason}` : ''}</div>
              ))}
            </div>
          )}
          {editable && (
            <div className="sba">
              {marked.size > 0 && (
                <button type="button" className="ka-btn" disabled={pending} onClick={() => setConfirming(true)}>
                  ส่งกลับไปนับซ้ำ {formatCount(marked.size)} รายการ
                </button>
              )}
              <button
                type="button"
                className="ka-btn ka-btn--primary"
                disabled={pending || saving || missing > 0 || blocked > 0 || marked.size > 0}
                onClick={() => void close()}
              >
                {pending ? 'กำลังส่ง...' : lines.length === 0 ? 'ปิดรอบนับ' : 'ส่งผลต่างขออนุมัติ'}
              </button>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirming}
        title="ส่งกลับไปนับซ้ำ"
        message={`ยอดนับของ ${formatCount(marked.size)} รายการจะถูกล้าง และรอบนี้กลับไปสถานะกำลังนับ`}
        confirmLabel="ส่งกลับไปนับซ้ำ"
        tone="neutral"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void recount()}
      />
    </>
  );
}
