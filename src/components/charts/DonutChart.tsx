import { formatBaht } from '@/components/charts/scale';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** A CSS color, normally a `var(--chart-N)` token. */
  color: string;
}

const SIZE = 168;
const RADIUS = 62;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2; // the surface shows between neighbouring slices

/**
 * A share of a whole. The legend beside it writes every slice's name, share
 * and amount, so the ring is never the only way to read it.
 */
export default function DonutChart({ title, slices, centerLabel }: { title: string; slices: DonutSlice[]; centerLabel: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  // Where each slice starts along the ring.
  const starts = slices.map((_, index) => (slices.slice(0, index).reduce((sum, slice) => sum + slice.value, 0) / total) * CIRCUMFERENCE);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg role="img" aria-label={title} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--bg-subtle)" strokeWidth={STROKE} />
        {slices.map((slice, index) => {
          const length = (slice.value / total) * CIRCUMFERENCE;
          const dash = Math.max(length - (slices.length > 1 ? GAP : 0), 0.5);
          return (
            <circle
              key={slice.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-starts[index]}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          );
        })}
        <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">
          {centerLabel}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 14} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)">
          {formatBaht(total)}
        </text>
      </svg>

      <ul className="grid min-w-[200px] flex-1 gap-2 text-[14px] text-[var(--ink)]">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 break-words">{slice.label}</span>
            <span className="shrink-0 text-right">
              <span className="font-semibold">{((slice.value / total) * 100).toFixed(1)}%</span>
              <span className="block text-[13px] text-[var(--ink-muted)]">{formatBaht(slice.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
