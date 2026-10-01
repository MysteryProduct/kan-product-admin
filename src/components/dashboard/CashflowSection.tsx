'use client';

import { useEffect, useState } from 'react';
import GroupedBarChart from '@/components/charts/GroupedBarChart';
import LineChart from '@/components/charts/LineChart';
import { formatBaht } from '@/components/charts/scale';
import type { ChartSeries } from '@/components/charts/types';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import { unavailableText } from '@/components/dashboard/blockLabels';
import DashboardModel from '@/models/dashboard';
import type { Cashflow, CashflowSeries } from '@/types/dashboard';

const dashboardModel = new DashboardModel();

/** The charts compare at most this many years; the API refuses more. */
const MAX_YEARS = 5;
const YEAR_CHOICES = 10;
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type Metric = 'income' | 'expense' | 'purchases';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'income', label: 'รายรับ (สุทธิหลังคืนเงิน)' },
  { key: 'expense', label: 'รายจ่าย (จ่ายให้ผู้จัดจำหน่าย)' },
  { key: 'purchases', label: 'มูลค่าซื้อเข้า (ใบรับสินค้าที่อนุมัติ)' },
];

const buddhist = (year: number) => year + 543;
const bangkokYear = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(new Date()));

type Loaded = { key: string; data: Cashflow } | { key: string; error: string };

/**
 * Income and expense by month and year, for at most five years. The years are
 * chosen as "last year" and "how many years" so that more than five cannot be
 * asked for. Each chart has a table with the same numbers.
 */
export default function CashflowSection() {
  const thisYear = bangkokYear();
  const [endYear, setEndYear] = useState(thisYear);
  const [span, setSpan] = useState(2);
  const [metric, setMetric] = useState<Metric>('income');
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const fromYear = endYear - span + 1;
  const key = `${fromYear}-${endYear}-${retry}`;

  useEffect(() => {
    let cancelled = false;
    dashboardModel
      .getCashflow(fromYear, endYear)
      .then((data) => {
        if (!cancelled) setLoaded({ key, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded({ key, error: loadErrorText('กราฟรายรับ-รายจ่าย', error) });
      });
    return () => {
      cancelled = true;
    };
  }, [fromYear, endYear, key]);

  const isLoading = loaded?.key !== key;
  const data = loaded && 'data' in loaded ? loaded.data : null;
  const error = loaded && 'error' in loaded && !isLoading ? loaded.error : null;

  const present = METRICS.filter((item) => data?.[item.key]);
  const activeMetric = present.some((item) => item.key === metric) ? metric : (present[0]?.key ?? metric);
  const years = data ? Array.from({ length: data.to_year - data.from_year + 1 }, (_, index) => data.to_year - index) : [];

  const monthlySeries = (source: CashflowSeries): ChartSeries[] =>
    years.map((year, index) => ({
      key: String(year),
      label: `พ.ศ. ${buddhist(year)}`,
      color: `var(--chart-${index + 1})`,
      values: source.monthly[String(year)] ?? [],
    }));

  const yearlyCategories = years
    .slice()
    .reverse()
    .map((year) => (data && year === data.current.year ? `${buddhist(year)}*` : String(buddhist(year))));
  const yearlySeries: ChartSeries[] = data
    ? ([
        data.income && { key: 'income', label: 'รายรับ', color: 'var(--chart-1)', values: years.slice().reverse().map((year) => data.income?.yearly[String(year)] ?? 0) },
        data.expense && { key: 'expense', label: 'รายจ่าย', color: 'var(--chart-2)', values: years.slice().reverse().map((year) => data.expense?.yearly[String(year)] ?? 0) },
      ].filter(Boolean) as ChartSeries[])
    : [];

  const monthlySource = data?.[activeMetric];
  const hasAnyMonthly = monthlySource ? monthlySeries(monthlySource).some((line) => line.values.some((value) => value)) : false;
  const hasAnyYearly = yearlySeries.some((bar) => bar.values.some((value) => value));
  const metricLabel = METRICS.find((item) => item.key === activeMetric)?.label ?? '';

  return (
    <section aria-labelledby="dashboard-cashflow" className="mb-6">
      <h2 id="dashboard-cashflow" className="mb-3 text-[19px] font-semibold text-[var(--ink)]">
        รายรับและรายจ่าย
      </h2>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[13px] text-[var(--ink-muted)]">
          ปีสุดท้าย
          <select className="ka-input min-h-11" value={endYear} onChange={(event) => setEndYear(Number(event.target.value))}>
            {Array.from({ length: YEAR_CHOICES }, (_, index) => thisYear - index).map((year) => (
              <option key={year} value={year}>
                พ.ศ. {buddhist(year)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] text-[var(--ink-muted)]">
          เทียบย้อนหลัง
          <select className="ka-input min-h-11" value={span} onChange={(event) => setSpan(Number(event.target.value))}>
            {Array.from({ length: MAX_YEARS }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count} ปี
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-[13px] text-[var(--ink-muted)]">
          ช่วง พ.ศ. {buddhist(fromYear)}–{buddhist(endYear)} (เทียบได้ไม่เกิน {MAX_YEARS} ปี)
        </p>
      </div>

      <LoadErrorBanner message={error ?? unavailableText(data?.unavailable)} onRetry={() => setRetry((count) => count + 1)} className="mb-4" />
      {isLoading && <p className="text-[14px] text-[var(--ink-muted)]">กำลังโหลด...</p>}
      {!isLoading && data && present.length === 0 && !data.unavailable && (
        <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>
      )}

      {!isLoading && data && monthlySource && (
        <div className="ka-card mb-4 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-[var(--ink)]">รายเดือน เทียบแต่ละปี</h3>
            <select
              aria-label="ตัวเลขที่แสดงในกราฟรายเดือน"
              className="ka-input min-h-11 max-w-full"
              value={activeMetric}
              onChange={(event) => setMetric(event.target.value as Metric)}
            >
              {present.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {hasAnyMonthly ? (
            <LineChart title={`${metricLabel} รายเดือน`} categories={MONTHS} series={monthlySeries(monthlySource)} />
          ) : (
            <p className="text-[14px] text-[var(--ink-muted)]">ไม่มีข้อมูล{metricLabel}ในช่วงปีที่เลือก</p>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-[14px] text-[var(--ink)]">ดูเป็นตาราง</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="ka-table w-full text-[13px]">
                <caption className="sr-only">{metricLabel} รายเดือน</caption>
                <thead>
                  <tr>
                    <th scope="col">เดือน</th>
                    {years.map((year) => (
                      <th key={year} scope="col" className="text-right">
                        {buddhist(year)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((month, index) => (
                    <tr key={month}>
                      <th scope="row" className="font-normal">
                        {month}
                      </th>
                      {years.map((year) => {
                        const value = monthlySource.monthly[String(year)]?.[index];
                        return (
                          <td key={year} className="whitespace-nowrap text-right">
                            {value === null || value === undefined ? '-' : formatBaht(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">รวม</th>
                    {years.map((year) => (
                      <td key={year} className="whitespace-nowrap text-right font-semibold">
                        {formatBaht(monthlySource.yearly[String(year)] ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {!isLoading && data && yearlySeries.length > 0 && (
        <div className="ka-card p-4">
          <h3 className="mb-3 text-[16px] font-semibold text-[var(--ink)]">รายปี รายรับเทียบรายจ่าย</h3>
          {hasAnyYearly ? (
            <GroupedBarChart title="รายรับเทียบรายจ่ายรายปี" categories={yearlyCategories} series={yearlySeries} />
          ) : (
            <p className="text-[14px] text-[var(--ink-muted)]">ไม่มีข้อมูลในช่วงปีที่เลือก</p>
          )}
          <p className="mt-2 text-[13px] text-[var(--ink-muted)]">* ปีปัจจุบันนับถึงวันนี้</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-[14px] text-[var(--ink)]">ดูเป็นตาราง</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="ka-table w-full text-[13px]">
                <caption className="sr-only">รายรับและรายจ่ายรายปี</caption>
                <thead>
                  <tr>
                    <th scope="col">ปี (พ.ศ.)</th>
                    {data.income && <th scope="col" className="text-right">รายรับ</th>}
                    {data.expense && <th scope="col" className="text-right">รายจ่าย</th>}
                    {data.income && data.expense && <th scope="col" className="text-right">ส่วนต่าง</th>}
                    {data.purchases && <th scope="col" className="text-right">มูลค่าซื้อเข้า</th>}
                  </tr>
                </thead>
                <tbody>
                  {years
                    .slice()
                    .reverse()
                    .map((year) => {
                      const income = data.income?.yearly[String(year)] ?? 0;
                      const expense = data.expense?.yearly[String(year)] ?? 0;
                      return (
                        <tr key={year}>
                          <th scope="row" className="font-normal">
                            {buddhist(year)}
                            {year === data.current.year ? ' (ถึงวันนี้)' : ''}
                          </th>
                          {data.income && <td className="whitespace-nowrap text-right">{formatBaht(income)}</td>}
                          {data.expense && <td className="whitespace-nowrap text-right">{formatBaht(expense)}</td>}
                          {data.income && data.expense && (
                            <td className="whitespace-nowrap text-right font-semibold">{formatBaht(Math.round((income - expense) * 100) / 100)}</td>
                          )}
                          {data.purchases && <td className="whitespace-nowrap text-right">{formatBaht(data.purchases.yearly[String(year)] ?? 0)}</td>}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
