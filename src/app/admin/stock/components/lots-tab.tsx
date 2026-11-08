'use client';

import { useCallback, useEffect, useState } from 'react';
import StoreLotModel from '@/models/store-lot';
import type { StoreLot, StoreLotStatus } from '@/types/store-lot';
import type { PaginationMeta } from '@/types/pagination';
import { usePermissions } from '@/hooks/usePermissions';
import { refreshStockPending } from '@/hooks/useStockPending';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate, formatThaiDateTime } from '@/lib/date-format';
import ReleaseLotModal, { variantLabel, waitedLabel } from './release-modal';
import { EmptyState, LoadFailed, LoadingRows } from './states';

const storeLotModel = new StoreLotModel();
const PAGE_SIZE = 20;
const formatQty = (value: number) => value.toLocaleString('th-TH');

export default function LotsTab() {
  const { can } = usePermissions();
  const canEdit = can('store_fulfillment', 'edit');
  const [status, setStatus] = useState<StoreLotStatus>('unreleased');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lots, setLots] = useState<StoreLot[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [counts, setCounts] = useState<Record<StoreLotStatus, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<StoreLot | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const other: StoreLotStatus = status === 'unreleased' ? 'released' : 'unreleased';
      const [result, otherResult] = await Promise.all([
        storeLotModel.getStoreLots(page, PAGE_SIZE, status, search || undefined),
        storeLotModel.getStoreLots(1, 1, other, search || undefined),
      ]);
      setLots(result.data);
      setMeta(result.meta);
      setCounts({ [status]: result.meta.total, [other]: otherResult.meta.total } as Record<StoreLotStatus, number>);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const pick = (next: StoreLotStatus) => {
    setStatus(next);
    setPage(1);
    setNotice('');
  };

  return (
    <>
      <div className="fbar">
        <form
          className="fs"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <input
            type="search"
            aria-label="ค้นหาล็อต"
            placeholder="ค้นหาชื่อสินค้าหรือรหัสงานผลิต"
            maxLength={100}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </form>
        <div className="seg" role="group" aria-label="สถานะล็อต">
          <button type="button" className={status === 'unreleased' ? 'on' : ''} aria-pressed={status === 'unreleased'} onClick={() => pick('unreleased')}>
            รอเปิดขาย{counts ? ` ${formatQty(counts.unreleased)}` : ''}
          </button>
          <button type="button" className={status === 'released' ? 'on' : ''} aria-pressed={status === 'released'} onClick={() => pick('released')}>
            เปิดขายแล้ว{counts ? ` ${formatQty(counts.released)}` : ''}
          </button>
        </div>
        <p className="cap fnote">ล็อตที่ยังไม่เปิดขายจะขายหรือจองไม่ได้ ทั้งหน้าร้านและใบสั่งขายใน Admin</p>
      </div>

      {notice && <p role="status" className="stock-notice">{notice}</p>}

      {error ? (
        <LoadFailed title="โหลดล็อตไม่สำเร็จ" detail={error} onRetry={() => void load()} />
      ) : loading ? (
        <LoadingRows />
      ) : lots.length === 0 ? (
        <EmptyState
          icon="store"
          title={search ? 'ไม่พบล็อตตามคำค้น' : status === 'unreleased' ? 'ไม่มีล็อตรอเปิดขาย' : 'ยังไม่มีล็อตที่เปิดขาย'}
        />
      ) : (
        <div className="lots">
          {lots.map((lot) => (
            <article className="lot" key={lot.stockProductId}>
              <div className="row">
                <div className="grow">
                  <h3 className="lot-name">{lot.productName}</h3>
                  <div className="cap">{variantLabel(lot)}{lot.sourceName ? ` · จาก ${lot.sourceName}` : ''}</div>
                </div>
                <span className={`bd ${status === 'unreleased' ? 'inf' : 'ok'}`}>{status === 'unreleased' ? 'รอเปิดขาย' : 'เปิดขายแล้ว'}</span>
              </div>
              <dl className="n3">
                <div><dt>จำนวน</dt><dd>{formatQty(lot.remainingQty)}</dd></div>
                <div><dt>ผลิตเสร็จ</dt><dd className="sm">{formatThaiDate(lot.producedAt)}</dd></div>
                {!lot.releasedAt && <div><dt>รอมาแล้ว</dt><dd className="sm">{waitedLabel(lot.producedAt)}</dd></div>}
                {lot.releasedAt && <div><dt>เปิดขาย</dt><dd className="sm">{formatThaiDate(lot.releasedAt)}</dd></div>}
              </dl>
              {lot.releasedAt && (
                <p className="cap">
                  {/* Lots released before TASK-0108 have no releaser on record. */}
                  เปิดโดย {lot.releasedBy ? lot.releasedBy.name || 'ไม่พบชื่อพนักงาน' : 'ไม่มีบันทึกผู้เปิด'} {formatThaiDateTime(lot.releasedAt)}
                  {lot.releaseNote ? ` · ${lot.releaseNote}` : ''}
                </p>
              )}
              {status === 'unreleased' && canEdit && (
                <button type="button" className="ka-btn" onClick={() => setSelected(lot)}>เปิดขายทั้งล็อต</button>
              )}
            </article>
          ))}
        </div>
      )}

      {!error && meta && meta.last_page > 1 && (
        <div className="pager">
          <button type="button" className="ka-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <span className="cap">หน้า {page} จาก {meta.last_page}</span>
          <button type="button" className="ka-btn" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>ถัดไป</button>
        </div>
      )}

      {selected && (
        <ReleaseLotModal
          lot={selected}
          onClose={() => setSelected(null)}
          onReleased={(released) => {
            setSelected(null);
            setNotice(
              released.alreadyReleased
                ? `ล็อตนี้ถูกเปิดขายไปแล้วโดย ${released.releasedBy?.name || 'พนักงานคนอื่น'}`
                : `เปิดขาย ${released.productName} (${variantLabel(released)}) แล้ว`,
            );
            refreshStockPending();
            void load();
          }}
        />
      )}
    </>
  );
}
