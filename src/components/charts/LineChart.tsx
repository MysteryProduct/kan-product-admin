'use client';

import { useState } from 'react';
import { formatBaht, formatCompact, niceScale } from '@/components/charts/scale';
import type { ChartSeries } from '@/components/charts/types';
import { useElementWidth } from '@/components/charts/useElementWidth';

const HEIGHT = 260;
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

interface LineChartProps {
  title: string;
  categories: string[];
  series: ChartSeries[];
}

/**
 * Lines over categories (months) with a crosshair and tooltip. The last value
 * of each line is labelled, and the legend names every series, so no series is
 * told apart by color alone.
 */
export default function LineChart({ title, categories, series }: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const values = series.flatMap((line) => line.values).filter((value): value is number => value !== null);
  const scale = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (categories.length > 1 ? (index / (categories.length - 1)) * plotWidth : plotWidth / 2);
  const y = (value: number) => PAD.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight;
  const step = categories.length > 1 ? plotWidth / (categories.length - 1) : plotWidth;
  // Show every month when there is room for it, otherwise every other one.
  const labelEvery = step >= 36 ? 1 : 2;

  const onMove = (clientX: number, left: number) => {
    const index = Math.round((clientX - left - PAD.left) / step);
    setHover(Math.min(categories.length - 1, Math.max(0, index)));
  };

  return (
    <div ref={ref} className="relative">
      <svg
        role="img"
        aria-label={title}
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block touch-pan-y"
        onPointerMove={(event) => onMove(event.clientX, event.currentTarget.getBoundingClientRect().left)}
        onPointerLeave={() => setHover(null)}
      >
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={tick === 0 ? 1.5 : 1} />
            <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--ink-muted)">
              {formatCompact(tick)}
            </text>
          </g>
        ))}
        {categories.map((category, index) =>
          index % labelEvery === 0 ? (
            <text key={category} x={x(index)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">
              {category}
            </text>
          ) : null,
        )}

        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--ink-subtle)" strokeWidth={1} strokeDasharray="3 3" />}

        {series.map((line) => {
          const points = line.values.flatMap((value, index) => (value === null ? [] : [{ index, value }]));
          const last = points[points.length - 1];
          return (
            <g key={line.key}>
              <polyline fill="none" stroke={line.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={points.map((p) => `${x(p.index)},${y(p.value)}`).join(' ')} />
              {points.length === 1 && last && <circle cx={x(last.index)} cy={y(last.value)} r={4} fill={line.color} stroke="var(--bg-surface)" strokeWidth={2} />}
              {hover !== null && line.values[hover] !== null && line.values[hover] !== undefined && (
                <circle cx={x(hover)} cy={y(line.values[hover] as number)} r={4} fill={line.color} stroke="var(--bg-surface)" strokeWidth={2} />
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-[13px] shadow-[var(--shadow-raise)]"
          style={{ left: Math.min(Math.max(x(hover) + 12, 0), Math.max(width - 170, 0)) }}
        >
          <p className="font-semibold text-[var(--ink)]">{categories[hover]}</p>
          {series.map((line) => (
            <p key={line.key} className="flex items-center justify-between gap-3 text-[var(--ink)]">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: line.color }} />
                {line.label}
              </span>
              <span>{line.values[hover] === null || line.values[hover] === undefined ? '-' : formatBaht(line.values[hover] as number)}</span>
            </p>
          ))}
        </div>
      )}

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--ink)]">
        {series.map((line) => (
          <li key={line.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded" style={{ background: line.color }} />
            {line.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
