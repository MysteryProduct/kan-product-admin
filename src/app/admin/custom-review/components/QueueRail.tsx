'use client';

import Link from 'next/link';
import Button from '@/components/Button';
import { FILTERS, OUTCOME_LABEL, STATUS_DOT, STATUS_LABEL, formatAtShort, isQueueStatus } from '@/lib/custom-review';
import type { ReviewQueueRow } from '@/types/custom-review';
import type { useReviewQueue } from '../use-review-queue';

type Queue = ReturnType<typeof useReviewQueue>;

const rowMeta = (row: ReviewQueueRow) =>
  row.lastReview
    ? `${OUTCOME_LABEL[row.lastReview.outcome]} ${formatAtShort(row.lastReview.at)}`
    : `รอตั้งแต่ ${formatAtShort(row.updatedAt)}`;

/** The queue: status filters with counts, search by CU / SO (or a pasted file name), oldest first. */
export default function QueueRail({ queue, selectedId, hrefFor }: { queue: Queue; selectedId: string | null; hrefFor: (id: string) => string }) {
  const { filter, setFilter, query, setQuery, term, fromFile, data, loading, error, reload } = queue;
  const counts = data?.meta.counts;
  const countOf = (key: (typeof FILTERS)[number]['key']) => {
    if (!counts) return '–';
    return key === 'all' ? Object.values(counts).reduce((sum, n) => sum + n, 0) : counts[key];
  };
  const rows = data?.data ?? [];
  const showSkeleton = loading && !data;
  const shown = !showSkeleton && !error;

  return (
    <section className="ka-cr-rail" aria-label="คิวคำขอ Custom" aria-busy={loading || undefined}>
      <div className="ka-cr-rail__head">
        <div className="ka-cr-filters" role="group" aria-label="กรองตามสถานะ">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="ka-cr-fb" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} <span className="n">{countOf(f.key)}</span>
            </button>
          ))}
        </div>
        <div className="ka-cr-srch">
          <svg className="i i--s" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" /></svg>
          <input
            className="ka-cr-in"
            type="search"
            aria-label="ค้นหาคำขอ"
            aria-describedby={fromFile ? 'ka-cr-qh' : undefined}
            placeholder="รหัส CU / SO หรือวางชื่อไฟล์"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {fromFile && (
          <p className="ka-cr-hint" id="ka-cr-qh">
            <svg className="i i--s" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v4h4" /></svg>
            ค้นด้วย {fromFile} จากชื่อไฟล์ที่วาง
          </p>
        )}
      </div>

      {showSkeleton && (
        <div aria-label="กำลังโหลดคิว">
          {[55, 80, 65, 70].map((w, i) => (
            <div key={i} className="ka-cr-skrow">
              <span className="ka-skel" style={{ width: `${w}%` }} />
              <span className="ka-skel" style={{ width: '80%' }} />
              <span className="ka-skel" style={{ width: '65%' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: 16 }}>
          <div className="ka-cr-ban" role="alert">
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9l-6 6M9 9l6 6" /></svg>
            <span style={{ flex: 1 }}>
              <b>โหลดคิวไม่สำเร็จ</b> {error} คำค้นยังอยู่
              <br />
              <Button size="sm" style={{ marginTop: 8 }} onClick={reload}>ลองอีกครั้ง</Button>
            </span>
          </div>
        </div>
      )}

      {shown && rows.length > 0 && (
        <ul className="ka-cr-qlist">
          {rows.map((row) => {
            const current = row.id === selectedId;
            return (
              <li key={row.id}>
                <Link href={hrefFor(row.id)} className="ka-cr-qi" aria-current={current ? 'true' : undefined} scroll={false}>
                  <span className="ka-cr-qi__l1">
                    <span className="ka-cr-code">{row.code}</span>
                    {isQueueStatus(row.status) && (
                      <span className="ka-cr-st" data-dot={STATUS_DOT[row.status]}>{STATUS_LABEL[row.status]}</span>
                    )}
                  </span>
                  <span className="ka-cr-qi__l2">{row.buyerName}</span>
                  <span className="ka-cr-cap">
                    {row.saleOrderCode} · ฉบับ {row.revision} · {rowMeta(row)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {shown && rows.length === 0 && (
        <div className="ka-cr-empty">
          <b>{term ? `ไม่พบคำขอ “${term}”` : 'ไม่มีคำขอในสถานะนี้'}</b>
          <span className="ka-cr-cap">{term ? 'ตรวจรหัส CU หรือ SO อีกครั้ง' : 'คำขอเข้าคิวหลังรับมัดจำแล้ว'}</span>
          {query && <Button size="sm" onClick={() => setQuery('')}>ล้างคำค้น</Button>}
        </div>
      )}

      <div className="ka-cr-rail__foot">
        <span className="ka-cr-cap" role="status">
          {showSkeleton
            ? 'กำลังโหลด…'
            : error
              ? '–'
              : data && data.meta.total > rows.length
                ? `แสดง ${rows.length} จาก ${data.meta.total} คำขอ · เรียงจากรอนานที่สุด`
                : `${rows.length} คำขอ · เรียงจากรอนานที่สุด`}
        </span>
      </div>
    </section>
  );
}
