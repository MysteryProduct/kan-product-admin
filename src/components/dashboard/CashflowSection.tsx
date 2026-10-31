'use client';

import { useEffect, useState, type ReactNode } from 'react';
import HBar from '@/components/dashboard/HBar';
import LineChart from '@/components/charts/LineChart';
import { formatBaht } from '@/components/charts/scale';
import type { ChartSeries } from '@/components/charts/types';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import { unavailableText } from '@/components/dashboard/blockLabels';
import DashboardModel from '@/models/dashboard';
import type { Cashflow, CashflowSeries } from '@/types/dashboard';
import CustomSelect from '@/components/CustomSelect';

const dashboardModel = new DashboardModel();

/** The charts compare at most this many years; the API refuses more. */
const MAX_YEARS = 5;
const YEAR_CHOICES = 10;
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type Metric = 'income' | 'expense' | 'diff' | 'purchases' | 'refunds';
const METRICS: { key: Metric; short: string; label: string }[] = [
  { key: 'income', short: 'รายรับ', label: 'รายรับ (สุทธิหลังคืนเงิน)' },
  { key: 'expense', short: 'รายจ่าย', label: 'รายจ่าย (จ่ายให้ผู้จัดจำหน่าย)' },
  { key: 'diff', short: 'ส่วนต่าง', label: 'ส่วนต่าง (รายรับ − รายจ่าย)' },
  { key: 'purchases', short: 'ซื้อเข้า', label: 'มูลค่าซื้อเข้า (ใบรับสินค้าที่อนุมัติ)' },
  { key: 'refunds', short: 'คืนเงิน', label: 'ยอดคืนเงิน (อัตราคืนอยู่ในตาราง)' },
];

/** The latest year is the brand orange and the one before it a grey, as in the design; older years keep the chart tokens. */
const yearColor = (index: number) => (index === 0 ? 'var(--brand)' : index === 1 ? 'var(--border-control)' : `var(--chart-${index + 1})`);

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Income minus expense, month by month and per year; a month that has not begun stays empty. */
function differenceSeries(income: CashflowSeries, expense: CashflowSeries): CashflowSeries {
  const monthly: CashflowSeries['monthly'] = {};
  for (const [year, months] of Object.entries(income.monthly)) {
    monthly[year] = months.map((value, index) => {
      const spent = expense.monthly[year]?.[index];
      return value === null || value === undefined || spent === null || spent === undefined ? null : round2(value - spent);
    });
  }
  const yearly: CashflowSeries['yearly'] = {};
  for (const [year, value] of Object.entries(income.yearly)) yearly[year] = round2(value - (expense.yearly[year] ?? 0));
  return { monthly, yearly };
}

const buddhist = (year: number) => year + 543;
const bangkokYear = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(new Date()));

type Loaded = { key: string; data: Cashflow } | { key: string; error: string };

/**
 * Income and expense by month and year, for at most five years. The years are
 * chosen as "last year" and "how many years" so that more than five cannot be
 * asked for. Each chart has a table with the same numbers.
 */
export default function CashflowSection({ beside }: { beside?: ReactNode }) {
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

  const seriesOf: Partial<Record<Metric, CashflowSeries>> = data
    ? {
        income: data.income,
        expense: data.expense,
        purchases: data.purchases,
        refunds: data.refunds,
        ...(data.income && data.expense ? { diff: differenceSeries(data.income, data.expense) } : {}),
      }
    : {};
  const present = METRICS.filter((item) => seriesOf[item.key]);
  const activeMetric = present.some((item) => item.key === metric) ? metric : (present[0]?.key ?? metric);
  const years = data ? Array.from({ length: data.to_year - data.from_year + 1 }, (_, index) => data.to_year - index) : [];

  const monthlySeries = (source: CashflowSeries): ChartSeries[] =>
    years.map((year, index) => ({
      key: String(year),
      label: `พ.ศ. ${buddhist(year)}`,
      color: yearColor(index),
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

  const monthlySource = seriesOf[activeMetric];
  const hasAnyMonthly = monthlySource ? monthlySeries(monthlySource).some((line) => line.values.some((value) => value)) : false;
  const hasAnyYearly = yearlySeries.some((bar) => bar.values.some((value) => value));
  /** Refunds as a share of what was received before them, for a month or a year; null when nothing was received. */
  const refundRate = (refunded: number | null | undefined, received: number | null | undefined) =>
    refunded === null || refunded === undefined || !received ? null : (refunded / received) * 100;
  const percent = (value: number | null) => (value === null ? '' : ` (${value.toFixed(1)}%)`);
  const metricLabel = METRICS.find((item) => item.key === activeMetric)?.label ?? '';

  return (
    <section aria-labelledby="dashboard-cashflow" className="ka-cashflow">
      <h2 id="dashboard-cashflow" className="sr-only">
        รายรับและรายจ่าย
      </h2>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[13px] text-[var(--ink-muted)]">
          ปีสุดท้าย
          <CustomSelect
            value={endYear}
            onChange={(value) => setEndYear(Number(value))}
            options={Array.from({ length: YEAR_CHOICES }, (_, index) => thisYear - index).map((year) => ({ value: year, label: `พ.ศ. ${buddhist(year)}` }))}
          />
        </label>
        <label className="grid gap-1 text-[13px] text-[var(--ink-muted)]">
          เทียบย้อนหลัง
          <CustomSelect
            value={span}
            onChange={(value) => setSpan(Number(value))}
            options={Array.from({ length: MAX_YEARS }, (_, index) => index + 1).map((count) => ({ value: count, label: `${count}ปี` }))}
          />
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
        <div className="ka-card ka-panel">
          <div className="ka-panel__head">
            <div>
              <h3 className="ka-card__title">{`${METRICS.find((item) => item.key === activeMetric)?.short ?? ''}รายเดือน`}</h3>
              <p className="ka-todo__cap">
                เทียบ พ.ศ. {years.map((year) => buddhist(year)).join(' กับ ')}
              </p>
            </div>
            <div className="ka-seg" role="group" aria-label="ตัวชี้วัดของกราฟ">
              {present.map((item) => (
                <button key={item.key} type="button" aria-pressed={activeMetric === item.key} onClick={() => setMetric(item.key)}>
                  {item.short}
                </button>
              ))}
            </div>
          </div>
          <p className="ka-panel__note">{metricLabel}</p>
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
                        const rate = activeMetric === 'refunds' ? refundRate(value, data.receipts?.monthly[String(year)]?.[index]) : null;
                        return (
                          <td key={year} className="whitespace-nowrap text-right">
                            {value === null || value === undefined ? '-' : `${formatBaht(value)}${percent(rate)}`}
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
                        {activeMetric === 'refunds' && percent(refundRate(monthlySource.yearly[String(year)], data.receipts?.yearly[String(year)]))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      <div className="ka-sales-grid">
        {beside}
        {!isLoading && data && yearlySeries.length > 0 && (
        <div className="ka-card ka-panel">
          <h3 className="ka-card__title">รายปี</h3>
          <p className="ka-todo__cap">รายรับเทียบรายจ่าย · ปีปัจจุบันนับถึงวันนี้</p>
          {hasAnyYearly ? (
            <ul aria-label="รายรับเทียบรายจ่ายรายปี" className="ka-rank">
              {yearlyCategories.map((category, index) => {
                const income = yearlySeries.find((line) => line.key === 'income')?.values[index] ?? 0;
                const expense = yearlySeries.find((line) => line.key === 'expense')?.values[index] ?? 0;
                const top = Math.max(1, ...yearlySeries.flatMap((line) => line.values.map((value) => value ?? 0)));
                return (
                  <li key={category}>
                    <div className="ka-rank__row">
                      <span>พ.ศ. {category}</span>
                      <span className="numeric ka-rank__qty">
                        {yearlySeries.some((line) => line.key === 'income') && <>รับ {formatBaht(income)}</>}
                        {yearlySeries.some((line) => line.key === 'expense') && <> · จ่าย {formatBaht(expense)}</>}
                      </span>
                    </div>
                    {yearlySeries.some((line) => line.key === 'income') && <HBar ratio={income / top} tone="brand" />}
                    {yearlySeries.some((line) => line.key === 'expense') && <HBar ratio={expense / top} tone="neutral" />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-[var(--ink-muted)]">ไม่มีข้อมูลในช่วงปีที่เลือก</p>
          )}
          <p className="ka-panel__note">แถบสีส้มคือรายรับ แถบสีเทาคือรายจ่าย ตัวเลขเขียนกำกับทุกแถว</p>
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
                    {data.refunds && <th scope="col" className="text-right">ยอดคืนเงิน</th>}
                    {data.refunds && data.receipts && <th scope="col" className="text-right">อัตราคืน</th>}
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
                          {data.refunds && <td className="whitespace-nowrap text-right">{formatBaht(data.refunds.yearly[String(year)] ?? 0)}</td>}
                          {data.refunds && data.receipts && (
                            <td className="whitespace-nowrap text-right">
                              {refundRate(data.refunds.yearly[String(year)], data.receipts.yearly[String(year)])?.toFixed(1) ?? '-'}
                              {refundRate(data.refunds.yearly[String(year)], data.receipts.yearly[String(year)]) === null ? '' : '%'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
      </div>
    </section>
  );
}
