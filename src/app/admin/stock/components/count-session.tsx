'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { getApiErrorMessage } from '@/lib/api-error';
import StockModel, {
  COUNT_SCOPES,
  countItemLabel,
  type CountDetail,
  type CountLine,
  type StockKind,
} from '@/models/stock';
import { Icon } from './icons';

const stockModel = new StockModel();
const PAGE_SIZE = 50;
const MAX_COUNT = 2147483647;
const KIND_NAMES: Record<StockKind, string> = { material: 'วัตถุดิบ', product: 'สินค้าสำเร็จรูป' };
const formatCount = (value: number) => value.toLocaleString('th-TH');

type Entry = { text: string; saving: boolean; error: string; retry: boolean };

const savedOf = (items: CountLine[]) =>
  Object.fromEntries(items.map((item) => [item.id, item.countedQty ?? null]));

export default function CountSession({
  kind,
  round,
  canAdd,
  onRefresh,
  onSubmitted,
}: {
  kind: StockKind;
  round: CountDetail;
  canAdd: boolean;
  onRefresh: () => Promise<void>;
  onSubmitted: () => void;
}) {
  const [saved, setSaved] = useState<Record<string, number | null>>(() => savedOf(round.items));
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [show, setShow] = useState<'all' | 'todo'>('all');
  const [page, setPage] = useState(1);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  // One save at a time per item, so an older value cannot land after a newer one.
  const queues = useRef<Record<string, Promise<void>>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const [seenRound, setSeenRound] = useState(round);
  if (round !== seenRound) {
    setSeenRound(round);
    setSaved(savedOf(round.items));
  }

  const patch = (id: string, next: Partial<Entry>) =>
    setEntries((all) => {
      const entry: Entry = all[id] ?? { text: '', saving: false, error: '', retry: false };
      return { ...all, [id]: { ...entry, ...next } };
    });

  function commit(item: CountLine) {
    const entry = entries[item.id];
    if (!entry) return;
    const text = entry.text.trim();
    const current = saved[item.id];
    if (!text) {
      patch(item.id, {
        retry: false,
        error: current === null ? '' : `ยังใช้ยอดที่บันทึกไว้ ${formatCount(current)} กรอกจำนวนใหม่ถ้าต้องการแก้`,
      });
      return;
    }
    if (!/^\d+$/.test(text) || Number(text) > MAX_COUNT) {
      patch(item.id, { retry: false, error: 'กรอกจำนวนเต็มตั้งแต่ 0 ขึ้นไป ไม่ต้องมีจุลภาค' });
      return;
    }
    const qty = Number(text);
    if (qty === current) {
      patch(item.id, { error: '', retry: false });
      return;
    }
    patch(item.id, { saving: true, error: '', retry: false });
    const run = async () => {
      try {
        await stockModel.saveCount(kind, round.id, item.id, qty);
        setSaved((all) => ({ ...all, [item.id]: qty }));
        patch(item.id, { saving: false });
      } catch (err) {
        // The typed figure stays so the counter can retry it.
        patch(item.id, { saving: false, retry: true, error: `บันทึกไม่สำเร็จ: ${getApiErrorMessage(err)}` });
      }
    };
    queues.current[item.id] = (queues.current[item.id] ?? Promise.resolve()).then(run);
  }

  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const inputs = [...(listRef.current?.querySelectorAll<HTMLInputElement>('input') ?? [])];
    const next = inputs[inputs.indexOf(event.currentTarget) + 1];
    if (next) next.focus();
    else event.currentTarget.blur();
  };

  const total = round.items.length;
  const done = round.items.filter((item) => saved[item.id] != null).length;
  const left = total - done;
  const percent = total ? Math.floor((done / total) * 100) : 0;
  const open = Object.values(entries);
  const busy = open.some((entry) => entry.saving);
  const failed = open.some((entry) => entry.error);

  const visible = useMemo(
    () => (show === 'all' ? round.items : round.items.filter((item) => saved[item.id] == null || entries[item.id]?.error)),
    [show, round.items, saved, entries],
  );
  const lastPage = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const shownPage = Math.min(page, lastPage);
  const rows = visible.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE);

  async function send() {
    setSending(true);
    setSendError('');
    try {
      await stockModel.submitRound(kind, round.id);
      onSubmitted();
    } catch (err) {
      setSendError(getApiErrorMessage(err));
      setSending(false);
      // Another counter's change is the usual cause: show the round as it stands.
      await onRefresh().catch(() => undefined);
    }
  }

  const message = !canAdd
    ? 'รอบนี้กำลังนับ ดูความคืบหน้าได้อย่างเดียว'
    : failed
      ? 'มีรายการที่ยังบันทึกไม่ได้ แก้ก่อนส่งตรวจ'
      : left > 0
        ? `ยังเหลือ ${formatCount(left)} รายการ บันทึกอัตโนมัติ ปิดแล้วกลับมานับต่อได้`
        : 'นับครบแล้ว ส่งให้ผู้ตรวจเทียบยอดได้';

  return (
    <section className="card sess">
      <div className="sesh">
        <div
          className="ring"
          style={{ background: `conic-gradient(var(--color-action) ${percent}%, var(--bg-muted) 0)` }}
          role="img"
          aria-label={`นับแล้ว ${formatCount(done)} จาก ${formatCount(total)} รายการ`}
        >
          <span>{percent}%</span>
        </div>
        <div className="grow sesht">
          <h1>นับสต็อก <span className="code">{round.code}</span></h1>
          <p className="cap">
            {round.scope === 'all' ? `${KIND_NAMES[kind]}ทั้งหมด` : COUNT_SCOPES[round.scope]} ·{' '}
            {round.hideSystemQty ? 'ซ่อนยอดในระบบ' : 'แสดงยอดในระบบ'} · นับแล้ว {formatCount(done)} จาก {formatCount(total)} รายการ
          </p>
        </div>
        <div className="seg" role="group" aria-label="กรองรายการนับ">
          <button type="button" className={show === 'all' ? 'on' : ''} aria-pressed={show === 'all'} onClick={() => { setShow('all'); setPage(1); }}>ทั้งหมด</button>
          <button type="button" className={show === 'todo' ? 'on' : ''} aria-pressed={show === 'todo'} onClick={() => { setShow('todo'); setPage(1); }}>ยังไม่นับ {formatCount(left)}</button>
        </div>
      </div>

      <div className="crows" ref={listRef}>
        {rows.length === 0 && (
          <div className="empty">
            <h3>นับครบทุกรายการแล้ว</h3>
            <p className="cap">กดทั้งหมดเพื่อดูหรือแก้ยอดที่นับ</p>
          </div>
        )}
        {rows.map((item) => {
          const entry = entries[item.id];
          const value = saved[item.id];
          const name = countItemLabel(item);
          const errorId = `count-error-${item.id}`;
          return (
            <div className={`crow${value != null && !entry?.error ? ' done' : ''}`} key={item.id}>
              <span className="ric nt"><Icon name="clip" /></span>
              <div className="grow">
                <div className="hname strong">{name}</div>
                <div className="cap">
                  <span className="code">{item.itemCode ?? '-'}</span>
                  {item.unitName ? ` · หน่วย${item.unitName}` : ''}
                  {!round.hideSystemQty && item.systemQty !== undefined ? ` · ในระบบ ${formatCount(item.systemQty)}` : ''}
                </div>
              </div>
              {canAdd ? (
                <input
                  className="cin"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`จำนวนที่นับได้ของ ${name}`}
                  aria-invalid={Boolean(entry?.error)}
                  aria-describedby={entry?.error ? errorId : undefined}
                  placeholder="นับได้"
                  disabled={sending}
                  value={entry ? entry.text : value == null ? '' : String(value)}
                  onChange={(event) => patch(item.id, { text: event.target.value })}
                  onBlur={() => commit(item)}
                  onKeyDown={onEnter}
                />
              ) : (
                <span className="num cval">{value == null ? '-' : formatCount(value)}</span>
              )}
              <div className="cst">
                {entry?.saving ? (
                  <span className="bd plain nt" role="status">กำลังบันทึก</span>
                ) : entry?.error ? (
                  <span className="bd dnb">ยังไม่บันทึก</span>
                ) : value != null ? (
                  <span className="bd ok">นับแล้ว</span>
                ) : (
                  <span className="bd plain nt">ยังไม่นับ</span>
                )}
              </div>
              {entry?.error && (
                <p id={errorId} role="alert" className="field-error cerr">
                  {entry.error}
                  {entry.retry && (
                    <button type="button" className="link" onClick={() => commit(item)}>ลองใหม่</button>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {lastPage > 1 && (
        <div className="pager">
          <button type="button" className="ka-btn" disabled={shownPage <= 1} onClick={() => setPage(shownPage - 1)}>ก่อนหน้า</button>
          <span className="cap">หน้า {shownPage} จาก {lastPage}</span>
          <button type="button" className="ka-btn" disabled={shownPage >= lastPage} onClick={() => setPage(shownPage + 1)}>ถัดไป</button>
        </div>
      )}

      <div className="sbar">
        <span className="cap sbm">{message}</span>
        {sendError && <span role="alert" className="field-error">{sendError}</span>}
        {canAdd && (
          <button
            type="button"
            className="ka-btn ka-btn--primary"
            disabled={left > 0 || busy || failed || sending}
            onClick={() => void send()}
          >
            {sending ? 'กำลังส่ง...' : 'ส่งตรวจผลนับ'}
          </button>
        )}
      </div>
    </section>
  );
}
