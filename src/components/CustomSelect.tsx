'use client';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string | number;
  label: string;
  color?: string; // สำหรับแสดงสีใน option
  disabled?: boolean;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  label?: string;
  showColor?: boolean;
  /** Asks the caller for more options once 4 or more letters are typed; the search box is then always shown. */
  fetchData?: (query: string) => void;
  id?: string;
  disabled?: boolean;
  /** Names the control when it has no visible `label`. */
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  className?: string;
}

// Fewer options than this fit on screen, so a search box would only slow the choice down.
const SEARCH_FROM = 8;
// Distance kept from the window edge.
const EDGE = 8;

/**
 * The one select of the Admin: no chevron, a grey "เปลี่ยน" once a value is chosen,
 * and a popover list. Enter, Space or ↓ opens it; ↑↓ move, Enter picks, Esc closes.
 */
export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'เลือก...',
  required = false,
  label,
  showColor = false,
  fetchData,
  id,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  className = '',
}: CustomSelectProps) {
  const autoId = useId();
  const triggerId = id ?? `${autoId}-trigger`;
  const labelId = `${autoId}-label`;
  const listId = `${autoId}-list`;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = value === null || value === undefined ? '' : value.toString();
  const selectedOption = options.find((opt) => opt.value.toString() === current);
  const searchable = Boolean(fetchData) || options.length >= SEARCH_FROM;

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options;
  }, [options, searchQuery]);

  const close = (refocus: boolean) => {
    setIsOpen(false);
    setSearchQuery('');
    setActive(-1);
    if (refocus) triggerRef.current?.focus();
  };

  const open = () => {
    if (disabled) return;
    const selectedIndex = options.findIndex((opt) => opt.value.toString() === current);
    setActive(selectedIndex >= 0 ? selectedIndex : options.findIndex((opt) => !opt.disabled));
    setIsOpen(true);
  };

  // Close on a click outside.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // The menu sits on the page, not inside the trigger's box, so a Modal's scrolling body cannot clip it.
  // It opens below the trigger, or above when there is no room below.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 200);
      let top = rect.bottom + 6;
      if (top + menu.offsetHeight > window.innerHeight - EDGE && rect.top - menu.offsetHeight - 6 > EDGE) {
        top = rect.top - menu.offsetHeight - 6;
      }
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE))}px`;
      menu.style.top = `${top}px`;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen, filteredOptions.length]);

  // Keep the active option in view while the arrow keys move it.
  useEffect(() => {
    if (!isOpen || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, active]);

  const handleSelect = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return;
    onChange(option.value.toString());
    // A Modal guarding unsaved edits listens for input events; a chosen option is one.
    rootRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
    close(true);
  };

  const move = (step: 1 | -1) => {
    const count = filteredOptions.length;
    if (count === 0) return;
    let next = active;
    for (let tries = 0; tries < count; tries += 1) {
      next = (next + step + count) % count;
      if (!filteredOptions[next].disabled) break;
    }
    setActive(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isOpen) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        open();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : filteredOptions.length - 1);
    } else if (event.key === 'Enter' || (event.key === ' ' && !searchable)) {
      event.preventDefault();
      handleSelect(filteredOptions[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // A select inside a Modal closes itself, not the Modal.
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setActive(0);
    if (e.target.value.length >= 4 && typeof fetchData === 'function') fetchData(e.target.value);
  };

  const activeId = isOpen && active >= 0 && filteredOptions[active] ? `${listId}-${active}` : undefined;

  return (
    <div ref={rootRef} className={`ka-select ${className}`}>
      {label && (
        <label id={labelId} htmlFor={triggerId} className="ka-label mb-1.5 block">
          {label} {required && <span className="ka-req">*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={searchable ? undefined : activeId}
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? `${labelId} ${triggerId}` : undefined}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedby}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (isOpen ? close(false) : open())}
        onKeyDown={searchable && isOpen ? undefined : onKeyDown}
        className="ka-select__trigger"
      >
        <span className="ka-select__value">
          {showColor && selectedOption?.color && (
            <span className="ka-select__swatch" style={{ backgroundColor: selectedOption.color }} aria-hidden="true" />
          )}
          <span className={selectedOption ? 'ka-select__text' : 'ka-select__text ka-select__placeholder'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        {selectedOption && !disabled && <span className="ka-select__change" aria-hidden="true">เปลี่ยน</span>}
      </button>

      {isOpen && createPortal(
        <div ref={menuRef} className="ka-select__menu">
          {searchable && (
            <div className="ka-select__search">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                role="searchbox"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={onKeyDown}
                placeholder="พิมพ์เพื่อค้นหา"
                aria-label={`ค้นหา${label ?? ariaLabel ?? ''}`}
                aria-controls={listId}
                aria-activedescendant={activeId}
                autoFocus
              />
            </div>
          )}

          <div ref={listRef} id={listId} role="listbox" aria-label={label ?? ariaLabel} className="ka-select__list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const selected = option.value.toString() === current;
                return (
                  <div
                    key={option.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={option.disabled || undefined}
                    data-active={index === active || undefined}
                    className="ka-option"
                    // Keeps focus on the trigger or search box so the keys keep working.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => handleSelect(option)}
                  >
                    {showColor && option.color && (
                      <span className="ka-select__swatch" style={{ backgroundColor: option.color }} aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">{option.label}</span>
                    {selected && (
                      <svg fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="ka-select__empty">ไม่พบข้อมูล</div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Hidden input for form validation */}
      <input type="hidden" value={current} required={required} onChange={() => {}} />
    </div>
  );
}
