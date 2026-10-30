'use client';

import { useId, useRef, useState } from 'react';
import Button from '@/components/Button';
import Popover from '@/components/Popover';

export interface FilterChipOption {
  value: string;
  label: string;
  /** How many rows each choice would show; leave out when the caller does not know. */
  count?: number;
}

interface FilterChipProps {
  /** The filter's name, such as "ประเภทสินค้า"; it is also the popover's title. */
  label: string;
  options: FilterChipOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** One choice at a time (radio) instead of several (checkbox). */
  single?: boolean;
}

const number = (value: number) => new Intl.NumberFormat('th-TH').format(value);

/**
 * A filter button: dashed while nothing is chosen, tinted with the count while it filters.
 * The results change as boxes are ticked, so there is no search button; "เสร็จ" only closes.
 */
export default function FilterChip({ label, options, selected, onChange, single = false }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const groupName = useId();
  const active = selected.length > 0;

  const toggle = (value: string, checked: boolean) => {
    if (single) onChange(checked ? [value] : []);
    else onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="ka-chip"
        data-active={active || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        {active && (
          <span className="ka-count">
            {number(selected.length)}
            <span className="sr-only"> ตัวเลือกที่เลือก</span>
          </span>
        )}
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title={label}
        footer={
          <>
            <Button variant="ghost" size="sm" disabled={!active} onClick={() => onChange([])}>ล้าง</Button>
            <Button variant="action" size="sm" onClick={() => setOpen(false)}>เสร็จ</Button>
          </>
        }
      >
        <fieldset className="ka-chip-options">
          <legend className="sr-only">{label}</legend>
          {options.map((option) => (
            <label key={option.value} className="ka-option">
              <span className="flex min-w-0 items-center gap-2">
                <input
                  type={single ? 'radio' : 'checkbox'}
                  name={single ? groupName : undefined}
                  className="ka-check"
                  checked={selected.includes(option.value)}
                  onChange={(event) => toggle(option.value, event.target.checked)}
                />
                <span className="break-words">{option.label}</span>
              </span>
              {option.count !== undefined && <span className="ka-option__meta numeric">{number(option.count)}</span>}
            </label>
          ))}
        </fieldset>
      </Popover>
    </>
  );
}
