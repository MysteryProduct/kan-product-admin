'use client';

import { useEffect, useState } from 'react';
import DonutChart, { type DonutSlice } from '@/components/charts/DonutChart';
import { formatBaht } from '@/components/charts/scale';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import { unavailableText } from '@/components/dashboard/blockLabels';
import { RANGES, periodText } from '@/components/dashboard/ranges';
import DashboardModel from '@/models/dashboard';
import type { SalesMix, TopProductRange } from '@/types/dashboard';

const dashboardModel = new DashboardModel();

// Each known payment method keeps its own color; anything else (and a receipt
// with no method recorded) is one "other" slice, so a color means one thing.
const METHODS: Record<string, { label: string; color: string }> = {
  promptpay: { label: 'พร้อมเพย์', color: 'var(--chart-1)' },
  card: { label: 'บัตรเครดิต/เดบิต', color: 'var(--chart-2)' },
  cash: { label: 'เงินสด', color: 'var(--chart-3)' },
  transfer: { label: 'โอนเงิน', color: 'var(--chart-4)' },
  bank: { label: 'โอนเงิน', color: 'var(--chart-4)' },
};
const OTHER_METHOD = { key: 'other', label: 'อื่น ๆ / ไม่ระบุ', color: 'var(--chart-5)' };

const CHANNELS: Record<string, string> = {
  store: 'หน้าร้านออนไลน์ (Store)',
  online: 'ขายบนเว็บไซต์',
  website: 'ขายบนเว็บไซต์',
  order: 'หลังร้าน (ขายจากการสั่งซื้อ)',
};

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

type Loaded = { range: TopProductRange; retry: number; data: SalesMix } | { range: TopProductRange; retry: number; error: string };

/**
 * How the period's receipts split by payment method (a ring; refunds are
 * stated apart) and how its sales split by channel (bars).
 */
export default function SalesMixSection() {
  const [range, setRange] = useState<TopProductRange>('this_month');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    dashboardModel
      .getSalesMix(range)
      .then((data) => {
        if (!cancelled) setLoaded({ range, retry, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded({ range, retry, error: loadErrorText('สัดส่วนยอดขาย', error) });
      });
    return () => {
      cancelled = true;
    };
  }, [range, retry]);

  const isLoading = loaded?.range !== range || loaded.retry !== retry;
  const data = loaded && 'data' in loaded && !isLoading ? loaded.data : null;
  const error = loaded && 'error' in loaded && !isLoading ? loaded.error : null;

  const methodSlices: DonutSlice[] = [];
  for (const item of data?.payment_methods?.items ?? []) {
    const known = item.method ? METHODS[item.method] : undefined;
    const key = known ? (item.method as string) : OTHER_METHOD.key;
    const existing = methodSlices.find((slice) => slice.key === (known ? known.label : key));
    if (existing) existing.value += item.amount;
    else methodSlices.push({ key: known ? known.label : key, label: known ? known.label : OTHER_METHOD.label, value: item.amount, color: known ? known.color : OTHER_METHOD.color });
  }

  // Types with the same name (online and website) are one channel.
  const channels: { label: string; count: number; amount: number }[] = [];
  for (const item of data?.channels ?? []) {
    const label = CHANNELS[item.type] ?? item.type;
    const existing = channels.find((channel) => channel.label === label);
    if (existing) {
      existing.count += item.count;
      existing.amount += item.amount;
    } else channels.push({ label, count: item.count, amount: item.amount });
  }
  channels.sort((a, b) => b.amount - a.amount);
  const channelTotal = channels.reduce((sum, channel) => sum + channel.amount, 0);
  const maxAmount = Math.max(1, ...channels.map((channel) => channel.amount));
  const hasShown = Boolean(data?.payment_methods || data?.channels);

  return (
    <section aria-labelledby="dashboard-sales-mix" className="mb-6">
      <h2 id="dashboard-sales-mix" className="mb-3 text-[19px] font-semibold text-[var(--ink)]">
        สัดส่วนวิธีชำระเงินและช่องทางขาย
      </h2>

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
        {data && <p className="pb-2 text-[13px] text-[var(--ink-muted)]">{periodText(data.from, data.to)}</p>}
      </div>

      <LoadErrorBanner message={error ?? unavailableText(data?.unavailable)} onRetry={() => setRetry((value) => value + 1)} className="mb-3" />
      {isLoading && <p className="text-[14px] text-[var(--ink-muted)]">กำลังโหลด...</p>}
      {data && !hasShown && !data.unavailable && (
        <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>
      )}

      {data && hasShown && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.payment_methods && (
            <div className="ka-card p-4">
              <h3 className="mb-3 text-[16px] font-semibold text-[var(--ink)]">รายรับแยกตามวิธีชำระเงิน</h3>
              {methodSlices.length > 0 ? (
                <DonutChart title="สัดส่วนรายรับแยกตามวิธีชำระเงิน" slices={methodSlices} centerLabel="รายรับก่อนคืนเงิน" />
              ) : (
                <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มีรายรับในช่วงเวลานี้</p>
              )}
              <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
                ยอดคืนเงินในช่วงนี้ (แยกจากสัดส่วน): <span className="font-semibold text-[var(--ink)]">{formatBaht(data.payment_methods.refunded)}</span>
              </p>
            </div>
          )}

          {data.channels && (
            <div className="ka-card p-4">
              <h3 className="mb-3 text-[16px] font-semibold text-[var(--ink)]">ยอดขายแยกตามช่องทาง</h3>
              {channels.length > 0 ? (
                <ul aria-label="ยอดขายแยกตามช่องทาง" className="grid gap-3">
                  {channels.map((channel) => (
                    <li key={channel.label}>
                      <div className="flex items-baseline justify-between gap-3 text-[14px] text-[var(--ink)]">
                        <span className="min-w-0 break-words">{channel.label}</span>
                        <span className="shrink-0 text-right">
                          <span className="font-semibold">{formatBaht(channel.amount)}</span>
                          <span className="block text-[13px] text-[var(--ink-muted)]">
                            {count(channel.count)} ใบ · {((channel.amount / channelTotal) * 100).toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div aria-hidden="true" className="mt-1 h-2.5 rounded-sm bg-[var(--bg-subtle)]">
                        <div className="h-full rounded-sm" style={{ width: `${Math.max((channel.amount / maxAmount) * 100, 1)}%`, background: 'var(--chart-1)' }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มียอดขายในช่วงเวลานี้</p>
              )}
              <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
                นับใบขายที่อนุมัติแล้ว ตามยอดรวมของใบ (รวม VAT และค่าส่ง) ยังไม่หักใบที่คืนภายหลัง
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
