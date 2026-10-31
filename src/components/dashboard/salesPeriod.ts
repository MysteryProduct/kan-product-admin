import type { DashboardDates } from '@/models/dashboard';

/** The periods the sales page offers. `custom` is two days the employee picks. */
export type PeriodPreset = 'today' | 'week' | 'month' | 'year' | 'custom';

export const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: 'วันนี้' },
  { key: 'week', label: '7 วัน' },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'year', label: 'ปีนี้' },
  { key: 'custom', label: 'กำหนดเอง' },
];

/** The widest period the API reads at once (TASK-0317). */
export const MAX_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const parse = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** Today's date in Bangkok, whatever the browser's own time zone is. */
export const bangkokToday = (now: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** The days a preset stands for: the 7 days end today, the month and the year run to their last day. */
export function presetDates(preset: Exclude<PeriodPreset, 'custom'>, today: string): DashboardDates {
  const day = parse(today);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: iso(new Date(day.getTime() - 6 * DAY_MS)), to: today };
    case 'month':
      return {
        from: iso(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))),
        to: iso(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0))),
      };
    case 'year':
      return { from: `${day.getUTCFullYear()}-01-01`, to: `${day.getUTCFullYear()}-12-31` };
  }
}

/** Why two days cannot be asked for, in words for the employee; null when they can. */
export function datesProblem(from: string, to: string): string | null {
  if (!from || !to) return 'เลือกวันที่เริ่มต้นและวันที่สิ้นสุด';
  if (to < from) return 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
  const days = Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS) + 1;
  if (days > MAX_DAYS) return `เลือกดูได้ไม่เกิน ${MAX_DAYS} วัน`;
  return null;
}

const part = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('th-TH', { ...options, timeZone: 'UTC' }).format(date);

/** "1–31 ต.ค. 2569", or "25 ก.ย. – 31 ต.ค. 2569" across months; Buddhist years. */
export function periodLabel({ from, to }: DashboardDates): string {
  const start = parse(from);
  const end = parse(to);
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (from === to) return part(end, { day: 'numeric', month: 'short', year: 'numeric' });
  if (sameMonth) return `${part(start, { day: 'numeric' })}–${part(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${part(start, { day: 'numeric', month: 'short' })} – ${part(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return `${part(start, { day: 'numeric', month: 'short', year: 'numeric' })} – ${part(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
