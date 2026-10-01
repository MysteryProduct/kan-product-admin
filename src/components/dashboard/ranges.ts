import type { TopProductRange } from '@/types/dashboard';

/** The periods the sales dashboard's share charts can show (the API's `range`). */
export const RANGES: { key: TopProductRange; label: string }[] = [
  { key: 'this_month', label: 'เดือนนี้' },
  { key: 'last_3_months', label: '3 เดือนล่าสุด' },
  { key: 'this_year', label: 'ปีนี้' },
  { key: 'all', label: 'ทั้งหมด (ไม่เกิน 5 ปี)' },
];

const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'UTC' });

/** "1 ต.ค. 2569 – 31 ต.ค. 2569" for a period whose `to` is the first day after it. */
export function periodText(from: string, to: string): string {
  const day = (value: string) => new Date(`${value}T00:00:00Z`);
  return `${dateFormat.format(day(from))} – ${dateFormat.format(new Date(day(to).getTime() - 24 * 60 * 60 * 1000))}`;
}
