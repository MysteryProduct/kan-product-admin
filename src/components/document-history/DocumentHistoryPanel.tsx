'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import axiosInstance from '@/lib/axios';
import { formatThaiDateTime } from '@/lib/date-format';
import {
  ACTIONS,
  actionStyle,
  actorOf,
  fieldChanges,
  groupByDay,
  itemChanges,
  rangeText,
  summarize,
  timeOf,
  type Actor,
  type ActionIcon,
  type HistoryEntry,
  type ItemChange,
} from './history-entry';

export type DocumentHistoryEntry = Entry;

// A system or removed actor comes back as its id only; the short timeline leaves it out (the full history still shows it).
const ID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Entry = HistoryEntry;

type HistoryResponse = {
  data: Entry[];
  meta: { page: number; last_page: number; total?: number };
};

const ICON_PATHS: Record<ActionIcon, string> = {
  plus: 'M12 4.5v15m7.5-7.5h-15',
  pencil: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z',
  check: 'm4.5 12.75 6 6 9-13.5',
  send: 'M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5',
  swap: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  return: 'M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3',
  cash: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  cross: 'm9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  trash: 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.76-2.164-1.904-2.201a51.964 51.964 0 0 0-3.32 0c-1.144.037-1.904 1.022-1.904 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
  dot: '',
};
const CLOCK = 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z';
const SLIDERS = 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75';
const PERSON = 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z';
const ARROW = 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3';

function Icon({ d }: { d: string }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Avatar({ actor }: { actor: Actor }) {
  return (
    <span className="ka-hist__av" data-tone={actor.tone} aria-hidden="true">
      {actor.kind === 'person' ? actor.initials : <Icon d={actor.kind === 'system' ? SLIDERS : PERSON} />}
    </span>
  );
}

const ChangeArrow = () => (
  <svg className="ka-hist__to" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} role="img" aria-label="เปลี่ยนเป็น">
    <path strokeLinecap="round" strokeLinejoin="round" d={ARROW} />
  </svg>
);

const ITEM_TAG: Partial<Record<ItemChange['kind'], { label: string; tone: string }>> = {
  added: { label: 'เพิ่ม', tone: 'success' },
  removed: { label: 'นำออก', tone: 'danger' },
  qty: { label: 'แก้จำนวน', tone: 'info' },
  status: { label: 'สถานะ', tone: 'neutral' },
};

const count = (value: number | null | undefined) => (value === null || value === undefined ? '-' : value.toLocaleString('th-TH'));

function ItemRow({ change }: { change: ItemChange }) {
  const unit = change.unit ? ` ${change.unit}` : '';
  const tag = ITEM_TAG[change.kind];
  return (
    <li className="ka-hist__it" data-kind={change.kind}>
      {tag && <span className="ka-hist__tag" data-tone={tag.tone}>{tag.label}</span>}
      <span className="ka-hist__itname">{change.name}</span>
      <span className="ka-hist__itqty numeric">
        {change.kind === 'qty' ? (
          <>
            <span className="ka-hist__old">{count(change.previousQuantity)}</span> → <b>{count(change.quantity)}</b>{unit}
          </>
        ) : change.kind === 'status' && change.status ? (
          <span className="ka-hist__vals">
            {change.status.before && <StatusBadge tone={change.status.beforeTone}>{change.status.before}</StatusBadge>}
            {change.status.before && <ChangeArrow />}
            {change.status.after && <StatusBadge tone={change.status.afterTone}>{change.status.after}</StatusBadge>}
          </span>
        ) : (
          <>× {count(change.quantity)}{unit}</>
        )}
      </span>
    </li>
  );
}

/** What changed in one entry: fields, then the goods (a return has its own row). */
function ChangeBox({ entry }: { entry: Entry }) {
  const fields = fieldChanges(entry);
  const items = itemChanges(entry);
  const returned = items.filter((change) => change.kind === 'returned');
  const others = items.filter((change) => change.kind !== 'returned');
  if (fields.length === 0 && items.length === 0) return null;
  const rows: ReactNode[] = fields.map((change) => (
    <div key={change.key} className="ka-hist__row">
      <dt>{change.label}</dt>
      <dd className="ka-hist__vals">
        {change.status ? (
          <>
            {change.before && <StatusBadge tone={change.beforeTone}>{change.before}</StatusBadge>}
            {change.before && <ChangeArrow />}
            {change.after && <StatusBadge tone={change.afterTone}>{change.after}</StatusBadge>}
          </>
        ) : (
          <>
            {change.before && <span className="ka-hist__old">{change.before}</span>}
            {change.before && <ChangeArrow />}
            <b>{change.after ?? '-'}</b>
          </>
        )}
      </dd>
    </div>
  ));
  if (returned.length > 0) {
    rows.push(
      <div key="returned" className="ka-hist__row ka-hist__row--sep">
        <dt>สินค้าที่คืน</dt>
        <dd>
          <ul className="ka-hist__items">
            {returned.map((change, index) => (
              <li key={index} className="ka-hist__it">
                <span className="ka-hist__itname">{change.name}</span>
                <span className="ka-hist__itqty numeric"><b><span className="ka-hist__long">คืน {count(change.returned)} จาก {count(change.quantity)}</span><span className="ka-hist__short">คืน {count(change.returned)}/{count(change.quantity)}</span></b></span>
              </li>
            ))}
          </ul>
        </dd>
      </div>,
    );
  }
  if (others.length > 0) {
    rows.push(
      <div key="items" className="ka-hist__row ka-hist__row--sep">
        <dt>รายการสินค้า</dt>
        <dd>
          <ul className="ka-hist__items">
            {others.map((change, index) => <ItemRow key={index} change={change} />)}
          </ul>
        </dd>
      </div>,
    );
  }
  return <dl className="ka-hist__box">{rows}</dl>;
}

function HistoryItemView({ entry, last }: { entry: Entry; last: boolean }) {
  const style = actionStyle(entry.action);
  const actor = actorOf(entry);
  return (
    <li className="ka-hist__item">
      <div className="ka-hist__rail">
        <span className="ka-hist__ic" data-tone={style.tone} aria-hidden="true">
          {style.icon === 'dot' ? <i className="ka-hist__dot" /> : <Icon d={ICON_PATHS[style.icon]} />}
        </span>
        {!last && <span className="ka-hist__line" aria-hidden="true" />}
      </div>
      <div className="ka-hist__main">
        <div className="ka-hist__head">
          <span className="ka-hist__act">{style.label}</span>
          <span className="ka-hist__who">
            <Avatar actor={actor} />
            <span><span className="ka-hist__by">โดย </span>{actor.name}</span>
          </span>
          <time className="ka-hist__time numeric" dateTime={entry.created_at} title={formatThaiDateTime(entry.created_at)}>{timeOf(entry.created_at)}</time>
        </div>
        {entry.reason && (
          <p className="ka-hist__why" data-tone={style.tone}>
            <b>เหตุผล</b> {entry.reason}
          </p>
        )}
        <ChangeBox entry={entry} />
      </div>
    </li>
  );
}

/** Actions that moved the document forward, drawn with a green dot on the timeline. */
const PROGRESS_ACTIONS = new Set(['approved', 'submitted', 'status_changed']);

interface DocumentHistoryPanelProps {
  endpoint: string;
  /**
   * `button` (default): a button that opens the full history. `timeline`: the latest entries as a
   * timeline on the page, with a button to the full history.
   */
  variant?: 'button' | 'timeline';
  /** Timeline only: how many of the latest entries to show. */
  limit?: number;
  /** Timeline only: the first page of entries once loaded, newest first. */
  onEntries?: (entries: DocumentHistoryEntry[]) => void;
  /** The document's code and name under the dialog's title, e.g. "SO-2569-00128 · ของที่ระลึก…". */
  documentLabel?: string;
}

const PAGE_SIZE = 20;

export default function DocumentHistoryPanel({ endpoint, variant = 'button', limit = 5, onEntries, documentLabel }: DocumentHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  // Each load gets a number; an answer to an older one (the dialog was closed and opened again) is dropped.
  const request = useRef(0);

  const loadHistory = async (nextPage: number) => {
    const ticket = ++request.current;
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get<HistoryResponse>(endpoint, {
        params: { page: nextPage, limit: PAGE_SIZE },
      });
      if (ticket !== request.current) return;
      const loaded = response.data.data ?? [];
      setEntries((current) => (nextPage === 1 ? loaded : [...current, ...loaded]));
      setPage(response.data.meta?.page ?? nextPage);
      setLastPage(response.data.meta?.last_page ?? nextPage);
      setTotal((current) => response.data.meta?.total ?? (nextPage === 1 ? loaded.length : current + loaded.length));
    } catch {
      if (ticket !== request.current) return;
      setError(nextPage === 1 ? 'ไม่สามารถโหลดประวัติการเปลี่ยนแปลงได้' : 'โหลดประวัติเพิ่มเติมไม่สำเร็จ');
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  };

  const openHistory = () => {
    setOpen(true);
    setEntries([]);
    setPage(1);
    setLastPage(1);
    setTotal(0);
    void loadHistory(1);
  };

  // "โหลดประวัติเพิ่มเติม" and "ลองอีกครั้ง" leave the page once they have done their job; focus then stays in
  // the dialog (its panel) instead of falling to the page behind it.
  const panelFocus = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open || loading) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const panel = panelFocus.current?.closest<HTMLElement>('[role="dialog"]');
    panel?.focus();
  }, [open, loading, entries.length, error]);

  const [recent, setRecent] = useState<Entry[] | null>(null);
  const [recentError, setRecentError] = useState(false);
  const onEntriesRef = useRef(onEntries);
  useEffect(() => {
    onEntriesRef.current = onEntries;
  });
  useEffect(() => {
    if (variant !== 'timeline') return;
    let active = true;
    axiosInstance
      .get<HistoryResponse>(endpoint, { params: { page: 1, limit: PAGE_SIZE } })
      .then((response) => {
        if (!active) return;
        const loaded = response.data.data ?? [];
        setRecent(loaded);
        setRecentError(false);
        onEntriesRef.current?.(loaded);
      })
      .catch(() => {
        if (active) setRecentError(true);
      });
    return () => {
      active = false;
    };
  }, [endpoint, variant]);

  const summary = summarize(entries, total, lastPage, page);
  const firstLoad = loading && entries.length === 0;
  const morePages = !error && entries.length > 0 && page < lastPage;

  const fullHistory = (
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      title="ประวัติการเปลี่ยนแปลง"
      description={documentLabel ?? 'รายการล่าสุดแสดงก่อน และไม่แสดงราคา/ต้นทุน'}
      size="lg"
      layer="elevated"
      className="ka-hist"
      media={
        <span ref={panelFocus} className="ka-hist__tile" aria-hidden="true">
          <Icon d={CLOCK} />
        </span>
      }
      footer={
        entries.length > 0 ? (
          <div className="ka-hist__foot">
            <span className="ka-hist__count">
              แสดง {entries.length.toLocaleString('th-TH')} จาก {summary.total.toLocaleString('th-TH')} รายการ · ไม่แสดงราคาและต้นทุน
            </span>
            {morePages && (
              <button type="button" className="ka-btn" onClick={() => void loadHistory(page + 1)} disabled={loading} aria-busy={loading || undefined}>
                {loading ? 'กำลังโหลด…' : 'โหลดประวัติเพิ่มเติม'}
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {historyBody()}
    </Modal>
  );

  if (variant === 'timeline') {
    return (
      <>
        {recent === null && !recentError && <p role="status" className="ka-tl__note">กำลังโหลดประวัติ…</p>}
        {recentError && <p role="alert" className="ka-tl__note">ไม่สามารถโหลดประวัติได้</p>}
        {recent && recent.length === 0 && <p className="ka-tl__note">ยังไม่มีประวัติ</p>}
        {recent && recent.length > 0 && (
          <ol className="ka-tl">
            {recent.slice(0, limit).map((entry) => (
              <li key={entry.document_history_id}>
                <span className={`ka-tl__dot${PROGRESS_ACTIONS.has(entry.action) ? ' ka-tl__dot--done' : ''}`} aria-hidden="true" />
                <span className="ka-tl__body">
                  <span>
                    <strong>{ACTIONS[entry.action] ?? entry.action}</strong>
                    {entry.actor_name && !ID_ONLY.test(entry.actor_name) ? ` · ${entry.actor_name}` : ''}
                  </span>
                  {entry.reason && <span className="ka-tl__reason">เหตุผล: {entry.reason}</span>}
                  <time className="ka-tl__time numeric" dateTime={entry.created_at}>{formatThaiDateTime(entry.created_at)}</time>
                </span>
              </li>
            ))}
          </ol>
        )}
        <button type="button" onClick={openHistory} className="ka-btn ka-btn--ghost ka-btn--sm ka-tl__all">
          ดูประวัติทั้งหมด
        </button>
        {fullHistory}
      </>
    );
  }

  return (
    <>
      <div className="mt-6 border-t border-[var(--color-border)] pt-6">
        <button type="button" onClick={openHistory} className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-4 text-left hover:border-[var(--color-primary)]">
          <span>
            <strong className="block text-sm font-semibold text-[var(--color-text-primary)]">ประวัติการเปลี่ยนแปลง</strong>
            <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">ดูผู้ดำเนินการ วันเวลา และรายละเอียดทั้งหมด</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-[var(--brand-ink)]">ดูประวัติ</span>
        </button>
      </div>

      {fullHistory}
    </>
  );

  function summaryBlock() {
    const people = summary.actors;
    return (
      <>
        <div className="ka-hist__sum">
          <div className="ka-hist__stat">
            <span className="ka-hist__k">เหตุการณ์ทั้งหมด</span>
            <span className="ka-hist__v">{summary.total.toLocaleString('th-TH')} รายการ</span>
          </div>
          {summary.allLoaded ? (
            <>
              <div className="ka-hist__stat">
                <span className="ka-hist__k">ผู้ดำเนินการ</span>
                <span className="ka-hist__v ka-hist__v--sm">
                  <span className="ka-hist__stack" aria-hidden="true">
                    {people.slice(0, 3).map((actor) => <Avatar key={actor.key} actor={actor} />)}
                  </span>
                  {people.length.toLocaleString('th-TH')} คน
                </span>
              </div>
              <div className="ka-hist__stat">
                <span className="ka-hist__k">ช่วงเวลา</span>
                <span className="ka-hist__v ka-hist__v--sm">{summary.first && summary.last ? rangeText(summary.first, summary.last) : '-'}</span>
              </div>
            </>
          ) : (
            <div className="ka-hist__stat ka-hist__stat--wide">
              <span className="ka-hist__k">โหลดแล้ว</span>
              <span className="ka-hist__v ka-hist__v--sm">
                {summary.loaded.toLocaleString('th-TH')} จาก {summary.total.toLocaleString('th-TH')} รายการ
              </span>
            </div>
          )}
        </div>
        <p className="ka-hist__sumline">
          {summary.total.toLocaleString('th-TH')} รายการ
          {summary.allLoaded ? ` · ${people.length.toLocaleString('th-TH')} คน` : ` · โหลดแล้ว ${summary.loaded.toLocaleString('th-TH')}`}
        </p>
      </>
    );
  }

  function historyBody() {
    if (firstLoad) {
      return (
        <div className="ka-hist__skel" role="status" aria-label="กำลังโหลดประวัติ…">
          {[0, 1, 2].map((key) => (
            <div key={key} className="ka-hist__skelrow" aria-hidden="true">
              <span className="ka-hist__skelic" />
              <span className="ka-hist__skelbody"><i /><i /><i /></span>
            </div>
          ))}
        </div>
      );
    }
    if (error && entries.length === 0) {
      return (
        <div role="alert" className="ka-banner ka-banner--danger ka-hist__err">
          <span>{error}</span>
          <button type="button" className="ka-btn ka-btn--sm" onClick={() => void loadHistory(1)}>ลองอีกครั้ง</button>
        </div>
      );
    }
    if (entries.length === 0) {
      return (
        <div className="ka-hist__empty">
          <span className="ka-hist__tile" aria-hidden="true"><Icon d={CLOCK} /></span>
          <p>ยังไม่มีประวัติการเปลี่ยนแปลง</p>
        </div>
      );
    }
    const groups = groupByDay(entries);
    const lastId = entries[entries.length - 1]?.document_history_id;
    return (
      <>
        {summaryBlock()}
        <div className="ka-hist__days">
          {groups.map((group) => (
            <section key={group.key} className="ka-hist__day" aria-label={group.label}>
              <h3 className="ka-hist__dayh">{group.label}</h3>
              <ol className="ka-hist__list">
                {group.entries.map((entry) => (
                  <HistoryItemView key={entry.document_history_id} entry={entry} last={entry.document_history_id === lastId && !morePages} />
                ))}
              </ol>
            </section>
          ))}
        </div>
        {error && (
          <div role="alert" className="ka-banner ka-banner--danger ka-hist__err">
            <span>{error}</span>
            <button type="button" className="ka-btn ka-btn--sm" onClick={() => void loadHistory(page + 1)}>ลองอีกครั้ง</button>
          </div>
        )}
      </>
    );
  }
}
