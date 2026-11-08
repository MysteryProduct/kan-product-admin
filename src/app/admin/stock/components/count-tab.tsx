'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate } from '@/lib/date-format';
import StockModel, {
  COUNT_SCOPES,
  type CountRound,
  type ListMeta,
  type StockKind,
} from '@/models/stock';
import { Icon } from './icons';
import { EmptyState, LoadFailed, LoadingRows } from './states';

const stockModel = new StockModel();
const PAGE_SIZE = 20;
const KIND_NAMES: Record<StockKind, string> = { material: 'วัตถุดิบ', product: 'สินค้าสำเร็จรูป' };
const STATUS = {
  counting: { label: 'กำลังนับ', tone: 'inf', meter: '' },
  reviewing: { label: 'รอตรวจผล', tone: 'wn', meter: 'w' },
  closed: { label: 'ปิดรอบแล้ว', tone: 'ok', meter: 'g' },
} as const;
const formatCount = (value: number) => value.toLocaleString('th-TH');

function progressText(round: CountRound) {
  if (round.status === 'counting') {
    return `นับแล้ว ${formatCount(round.countedCount)} จาก ${formatCount(round.itemCount)} รายการ`;
  }
  if (round.status === 'reviewing') return `นับครบ ${formatCount(round.itemCount)} รายการ`;
  return `${formatCount(round.itemCount)} รายการ · ${round.closedAt ? formatThaiDate(round.closedAt) : '-'}`;
}

/** What this employee can do with the round; a round with no way in shows its status only. */
function actionLabel(round: CountRound, can: { view: boolean; add: boolean; edit: boolean }) {
  if (round.status === 'counting') return can.add ? 'นับต่อ' : can.view ? 'ดูความคืบหน้า' : '';
  if (round.status === 'reviewing' && can.view) return can.edit ? 'ตรวจผลนับ' : 'ดูผล';
  return round.status === 'closed' && can.view ? 'ดูผล' : '';
}

export default function CountTab({
  kind,
  canView,
  canAdd,
  canEdit,
}: {
  kind: StockKind;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CountRound[]>();
  const [meta, setMeta] = useState<ListMeta>();
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await stockModel.listRounds(kind, { page, limit: PAGE_SIZE }, canView);
      setRows(result.data);
      setMeta(result.meta);
    } catch (err) {
      setRows(undefined);
      setError(getApiErrorMessage(err));
    }
  }, [kind, page, canView]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) {
    return (
      <LoadFailed title="โหลดรอบนับไม่สำเร็จ" detail={error} onRetry={() => void load()} />
    );
  }
  if (!rows) return <LoadingRows />;
  if (rows.length === 0) {
    return (
      <EmptyState icon="clip" title="ยังไม่มีรอบนับ" lead="เริ่มรอบนับเพื่อเทียบของจริงกับยอดในระบบ" />
    );
  }

  return (
    <>
      <div>
        {rows.map((round) => {
          const status = STATUS[round.status];
          const label = actionLabel(round, { view: canView, add: canAdd, edit: canEdit });
          const done = round.status === 'counting' && round.itemCount > 0
            ? Math.floor((round.countedCount / round.itemCount) * 100)
            : 100;
          return (
            <div className="drow" key={round.id}>
              <span className={`ric ${status.tone}`}><Icon name="clip" /></span>
              <div className="grow">
                <div className="dhead">
                  <span className="code strong">{round.code}</span>
                  <span className={`bd ${status.tone}`}>{status.label}</span>
                </div>
                <div className="hname">
                  {round.scope === 'all' ? `${KIND_NAMES[kind]}ทั้งหมด` : COUNT_SCOPES[round.scope]} · เปิดโดย {round.openedByName}
                </div>
              </div>
              <div className="dmid">
                <div className={`meter ${status.meter}`}><i style={{ width: `${done}%` }} /></div>
                <div className="cap num">{progressText(round)}</div>
              </div>
              <div className="dact">
                {label && <Link className="ka-btn" href={`/admin/stock/${kind}/count/${round.id}`}>{label}</Link>}
              </div>
            </div>
          );
        })}
      </div>
      {meta && meta.last_page > 1 && (
        <div className="pager">
          <button type="button" className="ka-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <span className="cap">หน้า {page} จาก {meta.last_page}</span>
          <button type="button" className="ka-btn" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>ถัดไป</button>
        </div>
      )}
    </>
  );
}
