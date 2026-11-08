'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/api-error';
import StockModel, { type StockItem, type StockKind, type StockStatus } from '@/models/stock';
import type { ListMeta } from '@/models/stock';
import { EmptyState, LoadFailed, LoadingRows } from './states';

const stockModel = new StockModel();
const PAGE_SIZE = 20;
const BOX_ICON =
  'm20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z';
const SEGMENTS: { key: '' | StockStatus; label: string }[] = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'normal', label: 'ปกติ' },
  { key: 'low', label: 'เหลือน้อย' },
  { key: 'out', label: 'หมด' },
];
const STATUS_VIEW: Record<StockStatus, { label: string; badge: string; tank: string; meter: string }> = {
  normal: { label: 'ปกติ', badge: 'ok', tank: 't-ok', meter: '' },
  low: { label: 'เหลือน้อย', badge: 'wn', tank: 't-wn', meter: 'm-wn' },
  out: { label: 'หมด', badge: 'dnb', tank: 't-dn', meter: 'm-dn' },
};
const fmt = (value: number) => value.toLocaleString('th-TH');

/** Bar geometry only: every quantity it draws comes from the API (G6). */
function meterOf(item: StockItem) {
  const cap = Math.max(item.remainQty, item.threshold * 2.5, 1);
  const pct = (value: number) => `${Math.round((value / cap) * 1000) / 10}%`;
  return {
    level: pct(item.remainQty),
    available: pct(item.availableQty),
    reserved: pct(item.reservedQty),
    hold: pct(item.pendingReleaseQty ?? 0),
    tick: pct(item.threshold),
  };
}

function hintOf(kind: StockKind, item: StockItem) {
  const hold = item.pendingReleaseQty ?? 0;
  if (item.incomingQty > 0) {
    return `${kind === 'material' ? 'ค้างรับ' : 'กำลังผลิต'} ${fmt(item.incomingQty)} ${item.unitName ?? ''}`.trim();
  }
  if (hold > 0 && item.availableQty === 0) return 'มีของแต่รอเปิดขาย';
  if (item.status === 'out') return kind === 'material' ? 'ไม่มีใบสั่งซื้อค้างรับ' : 'ไม่มีงานผลิตค้าง';
  return '';
}

function Tank({ item }: { item: StockItem }) {
  return (
    <span className={`tank ${STATUS_VIEW[item.status].tank}`}>
      <span className="lv" style={{ height: meterOf(item).level }} />
      <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d={BOX_ICON} /></svg>
    </span>
  );
}

function Meter({ item, availLabel }: { item: StockItem; availLabel: string }) {
  const m = meterOf(item);
  const aria = `คงเหลือ ${fmt(item.remainQty)} ${item.unitName ?? ''} จองแล้ว ${fmt(item.reservedQty)} ${availLabel} ${fmt(item.availableQty)} จุดเตือน ${fmt(item.threshold)}`;
  return (
    <div className={`mt ${STATUS_VIEW[item.status].meter}`} role="img" aria-label={aria}>
      <div className="mtf">
        <i className="sa" style={{ width: m.available }} />
        <i className="sr" style={{ width: m.reserved }} />
        <i className="sh" style={{ width: m.hold }} />
      </div>
      <span className="tk" style={{ left: m.tick }} />
    </div>
  );
}

export function reorderHref(kind: StockKind, id: string) {
  return kind === 'material'
    ? `/admin/purchase-orders/new?material=${encodeURIComponent(id)}`
    : `/admin/job-orders?create=1&product=${encodeURIComponent(id)}`;
}

export default function ListTab({ kind, canReorder }: { kind: StockKind; canReorder: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | StockStatus>('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StockItem[]>();
  const [meta, setMeta] = useState<ListMeta>();
  const [error, setError] = useState('');

  const isProduct = kind === 'product';
  const availLabel = isProduct ? 'พร้อมขาย' : 'พร้อมใช้';
  const detailHref = (item: StockItem) => `/admin/stock/${kind}/${item.id}`;

  const load = useCallback(async () => {
    setError('');
    setRows(undefined);
    try {
      const result = await stockModel.listItems(kind, { q: q || undefined, status: status || undefined, page, limit: PAGE_SIZE });
      setRows(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [kind, q, status, page]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  const clear = () => {
    setInput('');
    setQ('');
    setStatus('');
    setPage(1);
  };

  return (
    <>
      <div className="fbar">
        <label className="fs">
          <input
            type="search"
            maxLength={100}
            aria-label="ค้นหาด้วยชื่อหรือรหัส"
            placeholder={`ค้นหาชื่อหรือรหัส ${isProduct ? 'PD' : 'MT'}`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
        <div className="seg" role="group" aria-label="กรองตามสถานะ">
          {SEGMENTS.map((seg) => (
            <button
              type="button"
              key={seg.key}
              className={status === seg.key ? 'on' : ''}
              aria-pressed={status === seg.key}
              onClick={() => { setStatus(seg.key); setPage(1); }}
            >
              {seg.label}
            </button>
          ))}
        </div>
        <div className="lg" aria-label="คำอธิบายแถบระดับสต็อก">
          <span><i className="l-a" />{availLabel}</span>
          <span><i className="l-r" />จองแล้ว</span>
          {isProduct && <span><i className="l-h" />รอเปิดขาย</span>}
          <span><i className="l-t" />จุดเตือน</span>
        </div>
      </div>

      {error ? (
        <LoadFailed title="โหลดยอดสต็อกไม่สำเร็จ" detail={error} onRetry={() => void load()} />
      ) : !rows ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        q || status ? (
          <EmptyState icon="search" title="ไม่พบรายการตามตัวกรอง" lead="ลองเปลี่ยนคำค้นหรือสถานะ">
            <button type="button" className="ka-btn" onClick={clear}>ล้างตัวกรอง</button>
          </EmptyState>
        ) : (
          <EmptyState
            icon="box"
            title={isProduct ? 'ยังไม่มีสินค้าสำเร็จรูปในคลัง' : 'ยังไม่มีวัตถุดิบในคลัง'}
            lead={isProduct ? 'ยอดจะเข้ามาเมื่อปิดงานผลิต' : 'ยอดจะเข้ามาเมื่ออนุมัติใบรับสินค้า'}
          >
            <Link className="ka-btn" href={isProduct ? '/admin/job-orders' : '/admin/purchase-receipt'}>
              {isProduct ? 'ไปที่งานผลิต' : 'ไปที่ใบรับสินค้า'}
            </Link>
          </EmptyState>
        )
      ) : (
        <>
          <div className="tw list">
            <table className={`lt stk${isProduct ? '' : ' nohold'}`}>
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th style={{ width: 190 }}>ระดับสต็อก</th>
                  <th className="r">คงเหลือ</th>
                  <th className="r hmd">จองแล้ว</th>
                  {isProduct && <th className="r hmd">รอเปิดขาย</th>}
                  <th className="r">{availLabel}</th>
                  <th className="r hmd">จุดเตือน</th>
                  <th>สถานะ</th>
                  <th><span className="vh">การทำงาน</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const hint = hintOf(kind, item);
                  const view = STATUS_VIEW[item.status];
                  return (
                    <tr key={item.id} onClick={() => router.push(detailHref(item))}>
                      <td>
                        <div className="row">
                          <Tank item={item} />
                          <div className="grow">
                            <Link className="nm" href={detailHref(item)} onClick={(event) => event.stopPropagation()}>{item.name}</Link>
                            <div className="cap"><span className="code">{item.code}</span>{hint && ` · ${hint}`}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Meter item={item} availLabel={availLabel} />
                        <div className="cap smd num">
                          จอง {fmt(item.reservedQty)}
                          {(item.pendingReleaseQty ?? 0) > 0 && ` · รอเปิด ${fmt(item.pendingReleaseQty ?? 0)}`}
                          {` · เตือน ${fmt(item.threshold)}`}
                        </div>
                      </td>
                      <td className="r num strong">{fmt(item.remainQty)}<div className="cap">{item.unitName}</div></td>
                      <td className="r num hmd">{fmt(item.reservedQty)}</td>
                      {isProduct && <td className="r num hmd">{fmt(item.pendingReleaseQty ?? 0)}</td>}
                      <td className="r num strong">{fmt(item.availableQty)}</td>
                      <td className="r num hmd">
                        {fmt(item.threshold)}
                        <div className="cap">{item.thresholdSource === 'custom' ? 'ตั้งเอง' : 'ค่ากลาง'}</div>
                      </td>
                      <td><span className={`bd ${view.badge}`}>{view.label}</span></td>
                      <td className="r">
                        {canReorder && item.status !== 'normal' && (
                          <Link className="ka-btn ka-btn--sm" href={reorderHref(kind, item.id)} onClick={(event) => event.stopPropagation()}>
                            {isProduct ? 'สั่งผลิต' : 'สั่งซื้อ'}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mlist">
            {rows.map((item) => {
              const hint = hintOf(kind, item);
              const view = STATUS_VIEW[item.status];
              const hold = item.pendingReleaseQty ?? 0;
              return (
                <div className="mc2" key={item.id}>
                  <div className="row">
                    <Tank item={item} />
                    <div className="grow">
                      <Link className="nm" href={detailHref(item)}>{item.name}</Link>
                      <div className="cap code">{item.code}</div>
                    </div>
                    <span className={`bd ${view.badge}`}>{view.label}</span>
                  </div>
                  <Meter item={item} availLabel={availLabel} />
                  <dl className="n3">
                    <div><dt>คงเหลือ</dt><dd>{fmt(item.remainQty)}</dd></div>
                    <div><dt>จองแล้ว</dt><dd>{fmt(item.reservedQty)}</dd></div>
                    <div><dt>{availLabel}</dt><dd>{fmt(item.availableQty)}</dd></div>
                  </dl>
                  <div className="cap">
                    <span className="num">
                      หน่วย {item.unitName} · จุดเตือน {fmt(item.threshold)} ({item.thresholdSource === 'custom' ? 'ตั้งเอง' : 'ค่ากลาง'})
                      {hold > 0 && ` · รอเปิดขาย ${fmt(hold)}`}
                    </span>
                    {hint && <><br />{hint}</>}
                  </div>
                  {canReorder && item.status !== 'normal' && (
                    <Link className="ka-btn" href={reorderHref(kind, item.id)}>{isProduct ? 'สร้างงานผลิต' : 'สร้างใบสั่งซื้อ'}</Link>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pager">
            {meta && meta.last_page > 1 ? (
              <>
                <button type="button" className="ka-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
                <span className="cap num">หน้า {fmt(page)} จาก {fmt(meta.last_page)}</span>
                <button type="button" className="ka-btn" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>ถัดไป</button>
              </>
            ) : (
              <span className="cap">แสดงครบ {fmt(meta?.total ?? rows.length)} รายการ</span>
            )}
          </div>
        </>
      )}
    </>
  );
}
