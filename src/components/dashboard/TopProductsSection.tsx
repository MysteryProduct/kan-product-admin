'use client';

import { useEffect, useState } from 'react';
import { formatBaht } from '@/components/charts/scale';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import { unavailableText } from '@/components/dashboard/blockLabels';
import DashboardModel from '@/models/dashboard';
import type { TopProductRange, TopProducts } from '@/types/dashboard';

const dashboardModel = new DashboardModel();

const RANGES: { key: TopProductRange; label: string }[] = [
  { key: 'this_month', label: 'เดือนนี้' },
  { key: 'last_3_months', label: '3 เดือนล่าสุด' },
  { key: 'this_year', label: 'ปีนี้' },
  { key: 'all', label: 'ทั้งหมด (ไม่เกิน 5 ปี)' },
];

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);
const thaiDate = (value: string) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
// "to" is the first day after the period; the last day shown is the day before it.
const lastDay = (to: string) => new Date(new Date(`${to}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

type Loaded = { range: TopProductRange; retry: number; data: TopProducts } | { range: TopProductRange; retry: number; error: string };

/**
 * The ten best sellers of a period as horizontal bars. The bar is only the
 * proportion; each row says its rank, name and units in text, and the table
 * beside it adds the amount, so nothing is read from color or length alone.
 */
export default function TopProductsSection() {
  const [range, setRange] = useState<TopProductRange>('this_month');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    dashboardModel
      .getTopProducts(range)
      .then((data) => {
        if (!cancelled) setLoaded({ range, retry, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded({ range, retry, error: loadErrorText('สินค้าขายดี', error) });
      });
    return () => {
      cancelled = true;
    };
  }, [range, retry]);

  const isLoading = loaded?.range !== range || loaded.retry !== retry;
  const data = loaded && 'data' in loaded && !isLoading ? loaded.data : null;
  const error = loaded && 'error' in loaded && !isLoading ? loaded.error : null;
  const items = data?.items;
  const max = Math.max(1, ...(items ?? []).map((item) => item.quantity));

  return (
    <section aria-labelledby="dashboard-top-products" className="mb-6">
      <h2 id="dashboard-top-products" className="mb-3 text-[19px] font-semibold text-[var(--ink)]">
        สินค้าขายดี 10 อันดับ
      </h2>

      <div className="ka-card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <label className="grid gap-1 text-[13px] text-[var(--ink-muted)]">
            ช่วงเวลา
            <select className="ka-input min-h-11" value={range} onChange={(event) => setRange(event.target.value as TopProductRange)}>
              {RANGES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {data && (
            <p className="pb-2 text-[13px] text-[var(--ink-muted)]">
              {thaiDate(data.from)} – {thaiDate(lastDay(data.to))}
            </p>
          )}
        </div>

        <LoadErrorBanner message={error ?? unavailableText(data?.unavailable)} onRetry={() => setRetry((value) => value + 1)} className="mb-3" />
        {isLoading && <p className="text-[14px] text-[var(--ink-muted)]">กำลังโหลด...</p>}
        {data && !items && !data.unavailable && (
          <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>
        )}
        {data && items && items.length === 0 && (
          <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มีสินค้าที่ขายได้ในช่วงเวลานี้</p>
        )}

        {data && items && items.length > 0 && (
          <>
            <ol aria-label="สินค้าขายดีเรียงตามจำนวนที่ขายได้" className="grid gap-3">
              {items.map((item) => (
                <li key={`${item.rank}-${item.name}`} className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-2">
                  <span className="pt-0.5 text-right text-[14px] font-semibold text-[var(--ink-muted)]">{item.rank}</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3 text-[14px] text-[var(--ink)]">
                      <span className="min-w-0 break-words">{item.name}</span>
                      <span className="shrink-0 font-semibold">{count(item.quantity)} ชิ้น</span>
                    </div>
                    <div aria-hidden="true" className="mt-1 h-2.5 rounded-sm bg-[var(--bg-subtle)]">
                      <div className="h-full rounded-sm" style={{ width: `${Math.max((item.quantity / max) * 100, 1)}%`, background: 'var(--chart-1)' }} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
              นับใบขายที่อนุมัติแล้ว (ไม่รวมใบที่ยังไม่อนุมัติ ยกเลิก หรือคืนทั้งใบ) หักจำนวนที่คืนแล้ว รวมทุกสีและขนาดของสินค้านั้น
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-[14px] text-[var(--ink)]">ดูเป็นตาราง</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="ka-table w-full text-[13px]">
                  <caption className="sr-only">สินค้าขายดี 10 อันดับ</caption>
                  <thead>
                    <tr>
                      <th scope="col">อันดับ</th>
                      <th scope="col">สินค้า</th>
                      <th scope="col" className="text-right">
                        จำนวน (ชิ้น)
                      </th>
                      <th scope="col" className="text-right">
                        มูลค่า
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={`${item.rank}-${item.name}`}>
                        <td>{item.rank}</td>
                        <td className="break-words">{item.name}</td>
                        <td className="text-right">{count(item.quantity)}</td>
                        <td className="whitespace-nowrap text-right">{formatBaht(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
