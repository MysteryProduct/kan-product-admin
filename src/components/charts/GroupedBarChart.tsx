'use client';

import { useState } from 'react';
import { formatBaht, formatCompact, niceScale } from '@/components/charts/scale';
import type { ChartSeries } from '@/components/charts/types';
import { useElementWidth } from '@/components/charts/useElementWidth';

const HEIGHT = 260;
const PAD = { top: 20, right: 12, bottom: 28, left: 52 };
const GAP = 2; // between bars of a group, and what keeps neighbouring fills apart

interface GroupedBarChartProps {
  title: string;
  categories: string[];
  series: ChartSeries[];
}

/**
 * Vertical bars grouped by category (years). Each bar carries its value as a
 * label, so reading it does not depend on color, and the legend names the
 * series.
 */
export default function GroupedBarChart({ title, categories, series }: GroupedBarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const values = series.flatMap((bar) => bar.values).filter((value): value is number => value !== null);
  const scale = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const y = (value: number) => PAD.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight;
  const groupWidth = plotWidth / Math.max(categories.length, 1);
  const barWidth = Math.min(Math.max((groupWidth * 0.7) / Math.max(series.length, 1) - GAP, 4), 48);
  const clusterWidth = series.length * barWidth + (series.length - 1) * GAP;
  const labelBars = barWidth >= 30; // a value label only where it fits under the bar width

  return (
    <div ref={ref} className="relative">
      <svg role="img" aria-label={title} width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block" onPointerLeave={() => setHover(null)}>
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={tick === 0 ? 1.5 : 1} />
            <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--ink-muted)">
              {formatCompact(tick)}
            </text>
          </g>
        ))}
        {categories.map((category, groupIndex) => {
          const center = PAD.left + groupWidth * (groupIndex + 0.5);
          return (
            <g key={category} onPointerMove={() => setHover(groupIndex)}>
              <rect x={center - groupWidth / 2} y={PAD.top} width={groupWidth} height={plotHeight} fill={hover === groupIndex ? 'var(--bg-subtle)' : 'transparent'} />
              {series.map((bar, barIndex) => {
                const value = bar.values[groupIndex];
                if (value === null || value === undefined) return null;
                const left = center - clusterWidth / 2 + barIndex * (barWidth + GAP);
                const top = Math.min(y(value), y(0));
                const height = Math.max(Math.abs(y(value) - y(0)), 1);
                return (
                  <g key={bar.key}>
                    <rect x={left} y={top} width={barWidth} height={height} rx={3} fill={bar.color} />
                    {labelBars && (
                      <text x={left + barWidth / 2} y={value >= 0 ? top - 4 : top + height + 12} textAnchor="middle" fontSize={11} fill="var(--ink)">
                        {formatCompact(value)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">
                {category}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-[13px] shadow-[var(--shadow-raise)]"
          style={{ left: Math.min(Math.max(PAD.left + groupWidth * (hover + 0.5) + 16, 0), Math.max(width - 170, 0)) }}
        >
          <p className="font-semibold text-[var(--ink)]">{categories[hover]}</p>
          {series.map((bar) => (
            <p key={bar.key} className="flex items-center justify-between gap-3 text-[var(--ink)]">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: bar.color }} />
                {bar.label}
              </span>
              <span>{bar.values[hover] === null || bar.values[hover] === undefined ? '-' : formatBaht(bar.values[hover] as number)}</span>
            </p>
          ))}
        </div>
      )}

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--ink)]">
        {series.map((bar) => (
          <li key={bar.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: bar.color }} />
            {bar.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
