'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { adminMenu } from '@/lib/admin-menu';

const SearchIcon = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

interface PageEntry {
  title: string;
  group?: string;
  href: string;
}

/**
 * Jump to a page by name. It searches the menu the employee may open, so it needs no API.
 * Ctrl K (or Cmd K) focuses it; below 1024px it is an icon that opens the field over the header.
 */
export default function HeaderSearch() {
  const router = useRouter();
  const { can } = usePermissions();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const pages = useMemo<PageEntry[]>(
    () =>
      adminMenu.flatMap((section) =>
        section.items.flatMap((item): PageEntry[] => {
          if (item.href) return [{ title: item.title, href: item.href }];
          return (item.subItems ?? [])
            .filter((sub) => can(sub.menu_name, 'view'))
            .map((sub) => ({ title: sub.title, group: item.title, href: sub.href }));
        }),
      ),
    [can],
  );

  const term = query.trim().toLowerCase();
  const results = term
    ? pages.filter((page) => `${page.group ?? ''} ${page.title}`.toLowerCase().includes(term)).slice(0, 8)
    : [];

  const focusField = () => {
    setOpen(true);
    // The field is hidden below 1024px until `open`, so focus after the class applies.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setQuery('');
    setActive(0);
    if (returnFocus) iconRef.current?.focus();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusField();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const go = (page: PageEntry) => {
    close(false);
    inputRef.current?.blur();
    router.push(page.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      go(results[active]);
    }
  };

  return (
    <>
      <button
        ref={iconRef}
        type="button"
        aria-label="ค้นหาหน้า"
        onClick={focusField}
        className="ka-btn ka-btn--ghost ka-btn--icon lg:hidden"
      >
        <SearchIcon />
      </button>
      <div
        ref={rootRef}
        className={`ka-header__search ${open ? 'is-open' : ''}`}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null)) close(false);
        }}
      >
        <div className="ka-input-wrap">
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label="ค้นหาหน้า"
            aria-expanded={Boolean(term)}
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="ค้นหาหน้า (Ctrl K)"
            className="ka-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        {term && (
          <ul id={listId} role="listbox" aria-label="หน้าที่ตรงกับคำค้น" className="ka-search-results">
            {results.length === 0 ? (
              <li role="presentation" className="ka-search-empty">ไม่พบหน้าที่ตรงกับ “{query.trim()}”</li>
            ) : (
              results.map((page, index) => (
                <li
                  key={page.href}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className="ka-search-result"
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(page)}
                >
                  <span>{page.title}</span>
                  {page.group && <span className="ka-search-result__group">{page.group}</span>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </>
  );
}
