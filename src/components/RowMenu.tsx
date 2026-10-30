'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import Popover from '@/components/Popover';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** Deleting or cancelling: shown in the danger colour. */
  tone?: 'danger';
  disabled?: boolean;
}

interface RowMenuProps {
  /** Names the menu for screen readers, e.g. "จัดการ PD00005 กระบอกน้ำสแตนเลส". */
  label: string;
  items: RowMenuItem[];
}

const ITEM = 'button[role="menuitem"]:not(:disabled)';

/** The "⋯" menu at the end of a table row. Arrow keys move, Enter picks, Esc closes. */
export default function RowMenu({ label, items }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(ITEM));
    const index = entries.indexOf(document.activeElement as HTMLButtonElement);
    const move = (next: number) => {
      event.preventDefault();
      entries[(next + entries.length) % entries.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(entries.length - 1);
    else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="ka-btn ka-btn--ghost ka-btn--sm ka-btn--icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} title={label} align="end" width={220} role="menu">
        <div
          ref={(node) => {
            // Focus the first item as the menu appears, for keyboard users.
            if (node && !node.contains(document.activeElement)) node.querySelector<HTMLButtonElement>(ITEM)?.focus();
          }}
          className="ka-menu"
          onKeyDown={onKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="ka-menu__item"
              data-tone={item.tone}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
