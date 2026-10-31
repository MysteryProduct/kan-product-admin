'use client';

import { useId } from 'react';
import { MAX_DAYS, PRESETS, datesProblem, type PeriodPreset } from '@/components/dashboard/salesPeriod';

interface SalesRangeProps {
  preset: PeriodPreset;
  custom: { from: string; to: string };
  /** The newest day that can be picked: today. */
  max: string;
  onPreset: (preset: PeriodPreset) => void;
  onCustom: (custom: { from: string; to: string }) => void;
}

/**
 * The one period control of the page: everything below it follows it. "กำหนดเอง" shows two date
 * fields and says in words why a pair of days cannot be used, instead of silently doing nothing.
 */
export default function SalesRange({ preset, custom, max, onPreset, onCustom }: SalesRangeProps) {
  const problemId = useId();
  const problem = preset === 'custom' ? datesProblem(custom.from, custom.to) : null;

  return (
    <div className="ka-range">
      <div className="ka-seg" role="group" aria-label="ช่วงเวลา">
        {PRESETS.map((item) => (
          <button key={item.key} type="button" aria-pressed={preset === item.key} onClick={() => onPreset(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="ka-range__custom">
          <label className="ka-field">
            <span className="ka-label">ตั้งแต่วันที่</span>
            <input
              type="date"
              className="ka-input"
              value={custom.from}
              max={max}
              aria-describedby={problem ? problemId : undefined}
              aria-invalid={problem ? true : undefined}
              onChange={(event) => onCustom({ ...custom, from: event.target.value })}
            />
          </label>
          <label className="ka-field">
            <span className="ka-label">ถึงวันที่</span>
            <input
              type="date"
              className="ka-input"
              value={custom.to}
              max={max}
              aria-describedby={problem ? problemId : undefined}
              aria-invalid={problem ? true : undefined}
              onChange={(event) => onCustom({ ...custom, to: event.target.value })}
            />
          </label>
          <p id={problemId} className={problem ? 'ka-error' : 'ka-help'} role={problem ? 'alert' : undefined}>
            {problem ?? `เลือกได้ไม่เกิน ${MAX_DAYS} วัน`}
          </p>
        </div>
      )}
    </div>
  );
}
