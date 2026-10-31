'use client';

import { Fragment, useRef, useState, type KeyboardEvent } from 'react';
import Popover from '@/components/Popover';

// Outline icons (24px viewBox, stroke 2) for the commands a row menu repeats across pages.
const ICONS = {
  view: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  edit: 'M5 19l1-4L16 5l3 3L9 18z',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  hide: 'M3 3l18 18M10.6 6.1A9 9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.4 3.1M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1',
  show: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  status: 'M4 12h16M14 6l6 6-6 6',
  delete: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  cancel: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM6 6l12 12',
} as const;

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** Deleting or cancelling: shown in the danger colour, below a divider. */
  tone?: 'danger';
  disabled?: boolean;
  icon?: keyof typeof ICONS;
}

interface RowMenuProps {
  /** Names the menu for screen readers, e.g. "จัดการ PD00005 กระบอกน้ำสแตนเลส". */
  label: string;
  items: RowMenuItem[];
}

const ITEM = 'button[role="menuitem"]:not(:disabled)';

/**
 * The "⋯" menu at the end of a table row. Arrow keys move, Enter picks, Esc closes.
 * On phones it opens as an action sheet (Popover's bottom sheet).
 */
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
          {items.map((item, index) => (
            <Fragment key={item.label}>
            {/* A divider sets the first destructive command apart from the rest. */}
            {item.tone === 'danger' && index > 0 && items[index - 1].tone !== 'danger' && <div className="ka-menu__sep" role="separator" />}
            <button
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
              {item.icon && (
                <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={ICONS[item.icon]} />
                </svg>
              )}
              {item.label}
            </button>
            </Fragment>
          ))}
        </div>
      </Popover>
    </>
  );
}
