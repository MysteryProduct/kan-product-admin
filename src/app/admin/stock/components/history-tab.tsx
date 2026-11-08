'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/lib/api-error';
import StockModel, {
  MOVEMENT_LABELS,
  type ListMeta,
  type StockKind,
  type StockMovement,
  type StockMovementGroup,
  type StockMovementSummary,
} from '@/models/stock';
import { Icon, type IconName } from './icons';
import { EmptyState, LoadFailed, LoadingRows } from './states';

const stockModel = new StockModel();
const PAGE_SIZE = 50;
const BAR_UP_PX = 40;
const BAR_DOWN_PX = 28;
const SEGMENTS: { key: '' | StockMovementGroup; label: string }[] = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'in', label: 'เข้า' },
  { key: 'out', label: 'ออก' },
  { key: 'reserve', label: 'จอง' },
  { key: 'adjust', label: 'ปรับยอด' },
];
const TYPE_VIEW: Record<string, { tone: string; icon: IconName }> = {
  receive: { tone: 'ok', icon: 'in' },
  produce: { tone: 'ok', icon: 'in' },
  return: { tone: 'ok', icon: 'undo' },
  consume: { tone: 'br', icon: 'out' },
  receive_reverse: { tone: 'br', icon: 'undo' },
  reserve: { tone: 'inf', icon: 'mark' },
  unreserve: { tone: 'inf', icon: 'mark' },
  reserve_transfer: { tone: 'inf', icon: 'mark' },
  adjust: { tone: 'wn', icon: 'adj' },
};
const fmt = (value: number) => value.toLocaleString('th-TH');
const signed = (value: number) => `${value > 0 ? '+' : ''}${fmt(value)}`;

const DAY_MONTH = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
const dayMonth = (date: string) => DAY_MONTH.format(new Date(`${date}T12:00:00+07:00`));

const bangkokParts = (value: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};

function MovementRow({ move }: { move: StockMovement }) {
  const view = TYPE_VIEW[move.movementType] ?? { tone: 'nt', icon: 'clock' as const };
  const delta = move.remainDelta || move.reserveDelta;
  const isReserve = move.group === 'reserve';
  const after = isReserve ? `จองแล้ว ${fmt(move.itemReserveAfter)}` : `คงเหลือ ${fmt(move.itemRemainAfter)}`;
  const variant = [move.colorName, move.sizeName].filter(Boolean).join(' ');
  return (
    <div className="hrow">
      <span className={`tic ${view.tone}`}><Icon name={view.icon} /></span>
      <div className="hname">
        <div className="strong">{move.itemName}{variant ? ` ${variant}` : ''}</div>
        <div className="cap">{MOVEMENT_LABELS[move.movementType] ?? 'ความเคลื่อนไหว'} · {bangkokParts(move.createdAt).time} น.</div>
      </div>
      <div className="hdoc cap">
        {move.documentCode && <><span className="code doc">{move.documentCode}</span> · </>}
        {move.actorName ?? 'ระบบ'}
      </div>
      <div className={`qty r${isReserve ? '' : delta > 0 ? ' plus' : ' minus'}`}>{signed(delta)}</div>
      <div className="haft cap r num">{after}</div>
    </div>
  );
}

function FlowChart({ summary, day, onPick }: { summary: StockMovementSummary; day: string; onPick: (date: string) => void }) {
  const peak = Math.max(1, ...summary.days.flatMap((item) => [item.in, item.out]));
  return (
    <div className="flow" role="group" aria-label="กราฟเข้าออกรายวัน">
      {summary.days.map((item) => {
        const short = Number(item.date.slice(8));
        const label = dayMonth(item.date);
        const tip = `${label}: เข้า ${fmt(item.in)} ออก ${fmt(item.out)} รายการ`;
        return (
          <button
            type="button"
            key={item.date}
            className={`fc${day === item.date ? ' on' : ''}`}
            aria-pressed={day === item.date}
            aria-label={`${tip} กดเพื่อกรองวันนี้`}
            onClick={() => onPick(item.date)}
          >
            <span className="fu" style={{ height: `${Math.round((item.in / peak) * BAR_UP_PX)}px` }} />
            <span className="fb" />
            <span className="fd" style={{ height: `${Math.round((item.out / peak) * BAR_DOWN_PX)}px` }} />
            <span className="fl">{short}</span>
            <span className="tt">{tip}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function HistoryTab({ kind, itemId, onClearItem }: { kind: StockKind; itemId?: string; onClearItem: () => void }) {
  const [group, setGroup] = useState<'' | StockMovementGroup>('');
  const [day, setDay] = useState('');
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<StockMovementSummary>();
  const [summaryError, setSummaryError] = useState('');
  const [rows, setRows] = useState<StockMovement[]>();
  const [meta, setMeta] = useState<ListMeta>();
  const [error, setError] = useState('');
  const [itemName, setItemName] = useState('');

  // A new filter starts at page 1 in the same render, so the old page is never requested.
  const filterKey = `${kind}|${itemId ?? ''}|${group}|${day ?? ''}`;
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (filterKey !== seenFilter) {
    setSeenFilter(filterKey);
    setPage(1);
  }

  const loadSummary = useCallback(async () => {
    setSummaryError('');
    setSummary(undefined);
    try {
      setSummary(await stockModel.getMovementSummary(kind, itemId));
    } catch (err) {
      setSummaryError(getApiErrorMessage(err));
    }
  }, [kind, itemId]);

  const loadRows = useCallback(async () => {
    setError('');
    setRows(undefined);
    try {
      const result = await stockModel.listMovements(kind, {
        item_id: itemId,
        group: group || undefined,
        date_from: day || undefined,
        date_to: day || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setRows(result.data);
      setMeta(result.meta);
      if (itemId && result.data[0]) setItemName(result.data[0].itemName);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [kind, itemId, group, day, page]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const groups = useMemo(() => {
    const byDay = new Map<string, StockMovement[]>();
    for (const row of rows ?? []) {
      const key = bangkokParts(row.createdAt).day;
      byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }
    return [...byDay.entries()];
  }, [rows]);

  const today = bangkokParts(new Date().toISOString()).day;

  return (
    <>
      <div className="hgrid">
        {summaryError ? (
          <div className="hfail" role="alert">
            <p className="cap">โหลดสรุปไม่สำเร็จ: {summaryError}</p>
            <button type="button" className="ka-btn" onClick={() => void loadSummary()}>ลองใหม่</button>
          </div>
        ) : (
          <>
            <div className="hs">
              <div className="stat"><span className="cap">รับเข้า</span><span className="qty">{summary ? `${fmt(summary.totals.in)} ครั้ง` : '…'}</span></div>
              <div className="stat"><span className="cap">ตัดออก</span><span className="qty">{summary ? `${fmt(summary.totals.out)} ครั้ง` : '…'}</span></div>
              <div className="stat"><span className="cap">จอง/ปรับยอด</span><span className="qty">{summary ? `${fmt(summary.totals.reserveAdjust)} ครั้ง` : '…'}</span></div>
            </div>
            <div>
              <div className="row between wrap fhead">
                <h3>จำนวนรายการเข้า-ออก 7 วันล่าสุด</h3>
                <div className="lg flg"><span><i className="l-in" />เข้า</span><span><i className="l-out" />ออก</span></div>
              </div>
              {summary && <FlowChart summary={summary} day={day} onPick={(date) => setDay(day === date ? '' : date)} />}
            </div>
          </>
        )}
      </div>

      <div className="fbar">
        <div className="seg" role="group" aria-label="กรองชนิดความเคลื่อนไหว">
          {SEGMENTS.map((item) => (
            <button type="button" key={item.key} className={group === item.key ? 'on' : ''} aria-pressed={group === item.key} onClick={() => setGroup(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        {day && <button type="button" className="ka-btn ka-btn--ghost" onClick={() => setDay('')}>เฉพาะ {dayMonth(day)} ล้าง</button>}
        {itemId && <button type="button" className="ka-btn ka-btn--ghost" onClick={onClearItem}>เฉพาะ {itemName || 'รายการนี้'} ล้าง</button>}
        <p className="cap hkeep">ประวัติเริ่มนับจากวันที่เปิดใช้เมนูนี้ และเก็บ 2 ปี</p>
      </div>

      {error ? (
        <LoadFailed title="โหลดประวัติไม่สำเร็จ" detail={error} onRetry={() => void loadRows()} />
      ) : !rows ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon="clock" title="ไม่มีความเคลื่อนไหวตามตัวกรอง" lead="ลองเลือกวันหรือชนิดอื่น" />
      ) : (
        groups.map(([date, moves]) => (
          <div key={date}>
            <div className="dayh">{date === today ? `วันนี้ · ${dayMonth(date)}` : dayMonth(date)}</div>
            {moves.map((move) => <MovementRow key={move.stockMovementId} move={move} />)}
          </div>
        ))
      )}

      {meta && meta.last_page > 1 && !error && (
        <div className="pager">
          <button type="button" className="ka-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <span className="cap">หน้า {page} จาก {meta.last_page}</span>
          <button type="button" className="ka-btn" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>ถัดไป</button>
        </div>
      )}
    </>
  );
}
