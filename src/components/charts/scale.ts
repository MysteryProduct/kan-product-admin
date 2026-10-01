/** A y scale from 0 (or below, for negative values) to a rounded maximum, with its tick values. */
export function niceScale(min: number, max: number, count = 4): { min: number; max: number; ticks: number[] } {
  const low = Math.min(0, min);
  const high = Math.max(0, max);
  if (high === low) return { min: 0, max: 1, ticks: [0, 1] };
  const rawStep = (high - low) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normal = rawStep / magnitude;
  const step = (normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10) * magnitude;
  const niceMin = Math.floor(low / step) * step;
  const niceMax = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = niceMin; tick <= niceMax + step / 2; tick += step) ticks.push(Math.round(tick * 1e6) / 1e6);
  return { min: niceMin, max: niceMax, ticks };
}

const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1.2 ล้าน", for axis ticks. */
export const formatCompact = (value: number) => compact.format(value);

/** "฿1,234.50", for tooltips and tables. */
export const formatBaht = (value: number) => `฿${full.format(value)}`;
