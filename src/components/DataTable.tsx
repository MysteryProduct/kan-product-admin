'use client';

import React, { useState } from 'react';
import Pagination from '@/components/Pagination';
import BulkBar from '@/components/BulkBar';
import Button from '@/components/Button';
import FilterChip from '@/components/FilterChip';
import Popover from '@/components/Popover';
import RowMenu, { type RowMenuItem } from '@/components/RowMenu';
import { useIsPhone } from '@/hooks/useMediaQuery';
import { PaginationMeta } from '@/types/pagination';

export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'multi-select';
  filterOptions?: Array<{ label: string; value: string }>;
  filterValue?: (row: T) => string;
  sortable?: boolean;
  /** Stays in the table when the column picker is used (the code or name a row is known by). */
  alwaysVisible?: boolean;
  /** Starts hidden; the column picker can show it. */
  defaultHidden?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string;
  /** `hide` leaves the column off the phone card (the card title or `renderCard` already says it). */
  card?: 'hide';
}

/**
 * Opt-in multi-row selection. The table only reports which row keys are
 * checked: the caller owns the set, decides what a selection may do and clears
 * it when the rows it points at change. Without this prop no column is added.
 */
export interface DataTableSelection<T> {
  selectedKeys: ReadonlySet<string>;
  onChange: (keys: Set<string>) => void;
  /** Accessible name of a row's checkbox, e.g. the product name. */
  getRowLabel: (row: T) => string;
  /** Selection is suspended (for example while a command is saving). */
  disabled?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyField: keyof T;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  onFilterChange?: (filters: Record<string, string | string[]>) => void;
  onSortChange?: (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => void;
  paginationMeta?: PaginationMeta | null;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  showPaginationInfo?: boolean;
  className?: string;
  headerClassName?: string;
  rowClassName?: string;
  footerClassName?: string;
  disabled?: boolean;
  selection?: DataTableSelection<T>;
  /** Draws skeleton rows (or cards) in place of the data while it loads. */
  loading?: boolean;
  /** Below 640px rows become cards (default). `scroll` keeps the table and scrolls it sideways. */
  mobileLayout?: 'cards' | 'scroll';
  /** The column that names a row on its card (a code or a name). Defaults to the first column. */
  cardTitleKey?: keyof T;
  /** Adds a "คอลัมน์" button that shows or hides columns. */
  columnPicker?: boolean;
  /** A "⋯" menu at the end of each row. `getLabel` names the row for screen readers. */
  rowActions?: { getLabel: (row: T) => string; items: (row: T) => RowMenuItem[] };
  /** The commands for the selected rows, as `BulkAction` buttons; shown on a `BulkBar` once a row is checked. */
  bulkActions?: (selectedKeys: ReadonlySet<string>) => React.ReactNode;
  /** Replaces the hint under "ไม่พบข้อมูล" when no filter is the cause. */
  emptyHint?: string;
  /** Draws the body of a row's phone card instead of the title + field list. */
  renderCard?: (row: T) => React.ReactNode;
  /**
   * Filters the page applies outside the table (chips, tabs, search), named for the empty state:
   * "กำลังกรอง ประเภท: แก้ว · สี: ดำ". `onClearFilters` clears them with the table's own.
   */
  activeFilters?: string[];
  onClearFilters?: () => void;
}

// The filter menu is `w-56` (14rem = 224px); the margin keeps it off the screen edge.
const FILTER_MENU_WIDTH = 224;
const FILTER_MENU_MARGIN = 8;

// Sorting and filtering are tracked by column key text, whatever the row type is.
interface SortConfig {
  key: string;
  direction: 'ASC' | 'DESC';
}

interface FilterConfig {
  key: string;
  value: string | string[];
}

function DataTableInner<T>(
  {
    data,
    columns,
    keyField,
    pageSize = 10,
    onRowClick,
    onFilterChange,
    onSortChange,
    paginationMeta = null,
    currentPage,
    onPageChange,
    showPaginationInfo = true,
    className = '',
    headerClassName = '',
    rowClassName = '',
    footerClassName = '',
    disabled = false,
    selection,
    loading = false,
    mobileLayout = 'cards',
    cardTitleKey,
    columnPicker = false,
    rowActions,
    bulkActions,
    emptyHint,
    renderCard,
    activeFilters = [],
    onClearFilters,
  }: DataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [filterConfigs, setFilterConfigs] = useState<FilterConfig[]>([]);
    const [filterSearches, setFilterSearches] = useState<Record<string, string>>({});
    const [showFilterKey, setShowFilterKey] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const filterRefs = React.useRef<Record<string, HTMLElement | null>>({});

    const tableScrollRef = React.useRef<HTMLDivElement | null>(null);

    const isPhone = useIsPhone();
    const isCards = isPhone && mobileLayout === 'cards';
    const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(
      () => new Set(columns.filter((col) => col.defaultHidden).map((col) => String(col.key))),
    );
    const [columnsOpen, setColumnsOpen] = useState(false);
    const columnsButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const visibleColumns = columns.filter((col) => col.alwaysVisible || !hiddenKeys.has(String(col.key)));
    const hasPicker = columnPicker && columns.some((col) => !col.alwaysVisible);

    const rowKey = (row: T) => String(row[keyField]);
    const pageKeys = data.map(rowKey);
    const checkedOnPage = selection
      ? pageKeys.filter((key) => selection.selectedKeys.has(key)).length
      : 0;
    const allChecked = pageKeys.length > 0 && checkedOnPage === pageKeys.length;
    const selectAllRef = React.useRef<HTMLInputElement | null>(null);
    React.useEffect(() => {
      if (selectAllRef.current) {
        selectAllRef.current.indeterminate = checkedOnPage > 0 && !allChecked;
      }
    }, [checkedOnPage, allChecked]);
    const selectionLocked = Boolean(selection?.disabled) || disabled;
    // Only the rows shown are ever selected, so a toggle never keeps a key that is off the page.
    const toggleRow = (key: string, checked: boolean) => {
      if (!selection) return;
      const next = new Set(selection.selectedKeys);
      if (checked) next.add(key);
      else next.delete(key);
      selection.onChange(next);
    };
    const toggleAll = (checked: boolean) => {
      if (!selection) return;
      const next = new Set(selection.selectedKeys);
      for (const key of pageKeys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      selection.onChange(next);
    };

    // Handle filter dropdown positioning
    const updateDropdownPosition = (colKey: string | number) => {
      const element = filterRefs.current[String(colKey)];
      if (element) {
        const rect = element.getBoundingClientRect();
        // Align the menu's right edge with the button, then keep it on screen:
        // near the left edge of a narrow viewport it would be clipped.
        const left = Math.min(
          Math.max(FILTER_MENU_MARGIN, rect.right - FILTER_MENU_WIDTH),
          window.innerWidth - FILTER_MENU_WIDTH - FILTER_MENU_MARGIN,
        );
        setDropdownPos({
          top: rect.bottom + window.scrollY + 8,
          left: left + window.scrollX,
        });
      }
    };

    React.useEffect(() => {
      if (!showFilterKey) return;

      const handleReposition = () => updateDropdownPosition(showFilterKey);

      handleReposition();
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, true);

      const scrollContainer = tableScrollRef.current;
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleReposition);
      }

      return () => {
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
        if (scrollContainer) {
          scrollContainer.removeEventListener('scroll', handleReposition);
        }
      };
    }, [showFilterKey]);

    React.useEffect(() => {
      if (!disabled) return;
      setShowFilterKey(null);
    }, [disabled]);
    // Handle sort
    const handleSort = (key: string) => {
      const nextSort =
        sortConfig?.key === key
          ? sortConfig.direction === 'ASC'
            ? { key: key, direction: 'DESC' as const }
            : null
          : { key: key, direction: 'ASC' as const };

      setSortConfig(nextSort);

      if (onSortChange) {
        onSortChange(
          nextSort
            ? { key: String(nextSort.key), direction: nextSort.direction }
            : null
        );
      }
    };

    const getFilterValue = (key: string) =>
      filterConfigs.find((f) => String(f.key) === key)?.value;

    // Handle filter
    const handleFilter = async(key: string, value: string | string[]) => {
      let updatedFilters: FilterConfig[] = [];
      
      await setFilterConfigs((prev) => {
        const newFilters = prev.filter((f) => f.key !== key);
        const normalizedValue = Array.isArray(value)
          ? value.map((v) => v.toLowerCase())
          : value.toLowerCase();
        if (Array.isArray(normalizedValue) ? normalizedValue.length > 0 : normalizedValue.trim()) {
          newFilters.push({ key, value: normalizedValue });
        }
        updatedFilters = newFilters;    
        return newFilters;
      });
      
      // Call the filter change callback with all active filters
      if (onFilterChange) {
  
        const filtersObj: Record<string, string | string[]> = {};
        updatedFilters.forEach((filter) => {
          filtersObj[String(filter.key)] = filter.value;
        });
        onFilterChange(filtersObj);
      }
    };

    const clearFilters = () => {
      setFilterConfigs([]);
      setFilterSearches({});
      setShowFilterKey(null);
      onFilterChange?.({});
      onClearFilters?.();
    };
    // filterConfigs keeps only columns whose filter has a value.
    const filterNames = [
      ...activeFilters,
      ...filterConfigs
        .map((filter) => columns.find((col) => String(col.key) === filter.key)?.label)
        .filter((label): label is string => Boolean(label)),
    ];

    const columnSpan = visibleColumns.length + (selection ? 1 : 0) + (rowActions ? 1 : 0);
    const sortableColumns = columns.filter((col) => col.sortable);
    const filterableColumns = columns.filter((col) => col.filterable);

    const emptyBlock = (
      <div className="ka-empty p-0">
        <div className="ka-empty__art">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <p className="text-base font-semibold text-[var(--ink)]">
          {filterNames.length > 0 ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ไม่พบข้อมูล'}
        </p>
        {filterNames.length > 0 ? (
          <>
            <p className="text-sm text-[var(--ink-muted)]">กำลังกรอง {filterNames.join(' · ')}</p>
            <Button variant="secondary" size="sm" className="ka-empty__action" onClick={clearFilters}>
              ล้างตัวกรองทั้งหมด
            </Button>
          </>
        ) : (
          emptyHint && <p className="text-sm text-[var(--ink-muted)]">{emptyHint}</p>
        )}
      </div>
    );

    const skeletonRows = Array.from({ length: 5 }, (_, index) => (
      <tr key={`skeleton-${index}`} aria-hidden="true">
        {Array.from({ length: columnSpan }, (_cell, cellIndex) => (
          <td key={cellIndex} className="px-4 py-4">
            <span className="ka-skel" style={{ width: `${60 + ((index + cellIndex) % 3) * 15}%` }} />
          </td>
        ))}
      </tr>
    ));

    const cardList = (
      <div className="ka-cards" aria-busy={loading || undefined}>
        {loading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="ka-rowcard" aria-hidden="true">
              <span className="ka-skel ka-skel--title" />
              <span className="ka-skel" />
              <span className="ka-skel" style={{ width: '70%' }} />
            </div>
          ))
        ) : data.length === 0 ? (
          emptyBlock
        ) : (
          data.map((row, idx) => {
            const selected = Boolean(selection?.selectedKeys.has(rowKey(row)));
            const first = visibleColumns.find((col) => col.key === cardTitleKey) ?? visibleColumns[0];
            const rest = visibleColumns.filter((col) => col !== first && col.card !== 'hide');
            const cell = (col: DataTableColumn<T>) =>
              col.render ? col.render(row[col.key], row) : String(row[col.key] || '');
            return (
              <article
                key={String(row[keyField]) || idx}
                className="ka-rowcard"
                data-selected={selected || undefined}
                onClick={() => onRowClick?.(row)}
              >
                <div className="ka-rowcard__head">
                  <div className="min-w-0 flex-1">{renderCard ? renderCard(row) : first && cell(first)}</div>
                  {selection && (
                    <label className="ka-check-hit" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="ka-check"
                        checked={selected}
                        disabled={selectionLocked}
                        onChange={(e) => toggleRow(rowKey(row), e.target.checked)}
                        aria-label={`เลือก ${selection.getRowLabel(row)}`}
                      />
                    </label>
                  )}
                </div>
                {!renderCard && <dl className="ka-rowcard__fields">
                  {rest.map((col) => (
                    <div key={String(col.key)} className="ka-rowcard__field">
                      <dt>{col.label}</dt>
                      <dd>{cell(col)}</dd>
                    </div>
                  ))}
                </dl>}
                {rowActions && (
                  <div className="ka-rowcard__foot" onClick={(e) => e.stopPropagation()}>
                    <RowMenu label={`จัดการ ${rowActions.getLabel(row)}`} items={rowActions.items(row)} />
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    );

    const showTools = hasPicker || isCards;

    const canShowPagination =
      Boolean(paginationMeta) &&
      (paginationMeta?.last_page || 0) > 1 &&
      typeof currentPage === 'number' &&
      typeof onPageChange === 'function';

    const paginationStart = canShowPagination
      ? (currentPage as number) * pageSize - pageSize + 1
      : 0;
    const paginationEnd = canShowPagination
      ? Math.min((currentPage as number) * pageSize, paginationMeta?.total || 0)
      : 0;

    return (
      <div
        ref={ref}
        className={`w-full ${disabled ? 'select-none' : ''} ${className}`}
      >
        {selection && bulkActions && (
          <BulkBar count={selection.selectedKeys.size} onClear={() => selection.onChange(new Set())}>
            {bulkActions(selection.selectedKeys)}
          </BulkBar>
        )}
        {/* Table Container */}
        <div className="ka-card ka-table-card">
          {showTools && (
            <div className="ka-table-tools">
              {isCards && (
                <>
                  {selection && (
                    <label className="ka-check-hit ka-table-tools__all">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="ka-check"
                        checked={allChecked}
                        disabled={selectionLocked || pageKeys.length === 0}
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="เลือกทุกรายการในหน้านี้"
                      />
                      <span>ทั้งหน้า</span>
                    </label>
                  )}
                  {filterableColumns.map((col) => {
                    const current = getFilterValue(String(col.key));
                    const selectedValues = Array.isArray(current) ? current : current ? [current] : [];
                    if (col.filterType === 'select' || col.filterType === 'multi-select') {
                      return (
                        <FilterChip
                          key={String(col.key)}
                          label={col.label}
                          single={col.filterType === 'select'}
                          options={(col.filterOptions ?? []).map((opt) => ({ value: opt.value.toLowerCase(), label: opt.label }))}
                          selected={selectedValues}
                          // A `select` column keeps the string the table header sends, so the radio
                          // there still shows the choice after the viewport grows past 640px.
                          onChange={(values) =>
                            handleFilter(String(col.key), col.filterType === 'select' ? values[0] ?? '' : values)
                          }
                        />
                      );
                    }
                    return (
                      <input
                        key={String(col.key)}
                        type="search"
                        className="ka-input"
                        placeholder={`ค้นหา${col.label}`}
                        aria-label={`ค้นหา${col.label}`}
                        value={(current as string) || ''}
                        onChange={(e) => handleFilter(String(col.key), e.target.value)}
                      />
                    );
                  })}
                  {sortableColumns.length > 0 && (
                    <div role="group" aria-label="เรียงลำดับ" className="flex flex-wrap gap-2">
                      {sortableColumns.map((col) => {
                        const direction = sortConfig?.key === String(col.key) ? sortConfig.direction : null;
                        return (
                          <Button
                            key={String(col.key)}
                            size="sm"
                            variant="secondary"
                            aria-pressed={direction !== null}
                            disabled={disabled}
                            onClick={() => handleSort(String(col.key))}
                          >
                            เรียง{col.label}
                            {direction && <span aria-hidden="true">{direction === 'ASC' ? ' ↑' : ' ↓'}</span>}
                            {direction && <span className="sr-only">{direction === 'ASC' ? ' น้อยไปมาก' : ' มากไปน้อย'}</span>}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              <span className="ka-table-tools__spacer" />
              {hasPicker && (
                <>
                  <button
                    ref={columnsButtonRef}
                    type="button"
                    className="ka-chip"
                    aria-haspopup="dialog"
                    aria-expanded={columnsOpen}
                    onClick={() => setColumnsOpen((value) => !value)}
                  >
                    คอลัมน์
                  </button>
                  <Popover
                    open={columnsOpen}
                    onClose={() => setColumnsOpen(false)}
                    anchorRef={columnsButtonRef}
                    title="แสดงคอลัมน์"
                    align="end"
                    footer={
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHiddenKeys(new Set(columns.filter((col) => col.defaultHidden).map((col) => String(col.key))))}
                        >
                          ค่าเริ่มต้น
                        </Button>
                        <Button variant="action" size="sm" onClick={() => setColumnsOpen(false)}>เสร็จ</Button>
                      </>
                    }
                  >
                    <fieldset className="ka-chip-options">
                      <legend className="sr-only">แสดงคอลัมน์</legend>
                      {columns.filter((col) => !col.alwaysVisible).map((col) => (
                        <label key={String(col.key)} className="ka-option">
                          <span className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              className="ka-check"
                              checked={!hiddenKeys.has(String(col.key))}
                              onChange={(e) =>
                                setHiddenKeys((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.delete(String(col.key));
                                  else next.add(String(col.key));
                                  return next;
                                })
                              }
                            />
                            <span className="break-words">{col.label}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  </Popover>
                </>
              )}
            </div>
          )}
          {isCards ? cardList : (
          <div className="ka-table-scroll" ref={tableScrollRef} aria-busy={loading || undefined}>
            <table className="w-full text-[15px] leading-6 text-[var(--ink)]">
              <thead>
                <tr className={`border-b border-[var(--border)] bg-[var(--bg-subtle)] ${headerClassName}`}>
                  {selection && (
                    <th className="w-12 px-2 py-3 text-center align-middle">
                      <label className="ka-check-hit">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="ka-check"
                          checked={allChecked}
                          disabled={selectionLocked || pageKeys.length === 0}
                          onChange={(e) => toggleAll(e.target.checked)}
                          aria-label="เลือกทุกรายการในหน้านี้"
                        />
                      </label>
                    </th>
                  )}
                  {visibleColumns.map((col) => (
                    <th
                      key={String(col.key)}
                      data-filter-col={col.key}
                      className="px-4 py-3 text-left align-middle"
                      style={col.width ? { minWidth: col.width } : undefined}
                    >
                      <div className="space-y-2.5">
                        {/* Label and Sort */}
                        <div
                          className={`flex items-center justify-between gap-3 ${
                            col.sortable ? 'cursor-pointer group' : ''
                          }`}
                        >
                          <div
                            className="flex items-center gap-2"
                            onClick={() => !disabled && col.sortable && handleSort(String(col.key))}
                          >
                            <span className="text-sm font-semibold leading-[22px] text-[var(--ink-muted)] transition-colors group-hover:text-[var(--ink)]">
                              {col.label}
                            </span>
                            {col.sortable && (
                              <span className="inline-flex items-center text-[var(--ink-subtle)] transition-colors group-hover:text-[var(--brand-ink)]">
                                {sortConfig?.key === String(col.key) ? (
                                  sortConfig.direction === 'ASC' ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M7 15l5-6 5 6" />
                                    </svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M7 9l5 6 5-6" />
                                    </svg>
                                  )
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </span>
                            )}
                          </div>
                          {col.filterable && (
                            <button
                              type="button"
                              onClick={(e) => {
                                if (disabled) return;
                                e.stopPropagation();
                                setShowFilterKey((prev) => {
                                  const newVal = prev === String(col.key) ? null : String(col.key);
                                  if (newVal) {
                                    setTimeout(() => updateDropdownPosition(String(col.key)), 0);
                                  }
                                  return newVal;
                                });
                              }}
                              disabled={disabled}
                              className="ka-btn ka-btn--sm ka-btn--icon ka-btn--touch bg-[var(--bg-surface)] text-[var(--ink-muted)] hover:border-[var(--focus)] hover:text-[var(--brand-ink)]"
                              aria-label={`กรองคอลัมน์ ${col.label}`}
                              ref={(el) => {
                                if (el) filterRefs.current[String(col.key)] = el;
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Filter Input */}
                        {showFilterKey === String(col.key) && col.filterable && !disabled && (
                          <div className="relative">
                            {col.filterType === 'text' || !col.filterType ? (
                              <div className="relative">
                                <svg
                                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-subtle)]"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                  />
                                </svg>
                                <input
                                  type="text"
                                  placeholder="ค้นหา…"
                                  value={(getFilterValue(String(col.key)) as string) || ''}
                                  onChange={(e) =>
                                    handleFilter(String(col.key), e.target.value)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="ka-input min-h-9 py-1.5 pl-9 text-sm"
                                />
                              </div>
                            ) : (
                              <div className="relative">
                                <div
                                  className="fixed z-50 w-56 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--ink)] shadow-[var(--shadow-raise)]"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    top: `${dropdownPos.top}px`,
                                    left: `${dropdownPos.left}px`,
                                  }}
                                >
                                  <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[13px] text-[var(--ink-muted)]">
                                    <button
                                      onClick={() =>
                                        handleFilter(
                                          String(col.key),
                                          col.filterOptions?.map((opt) => opt.value) || []
                                        )
                                      }
                                      className="hover:text-[var(--brand-ink)]"
                                    >
                                      เลือกทั้งหมด ({col.filterOptions?.length || 0})
                                    </button>
                                    <button
                                      onClick={() => handleFilter(String(col.key), [])}
                                      className="hover:text-[var(--brand-ink)]"
                                    >
                                      ล้างที่เลือก
                                    </button>
                                  </div>
                                  <div className="p-3">
                                    <div className="relative mb-3">
                                      <svg
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-subtle)]"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                      </svg>
                                      <input
                                        type="text"
                                        placeholder="ค้นหา…"
                                        value={filterSearches[String(col.key)] || ''}
                                        onChange={(e) =>
                                          setFilterSearches((prev) => ({
                                            ...prev,
                                            [String(col.key)]: e.target.value,
                                          }))
                                        }
                                        className="ka-input min-h-9 py-1.5 pl-9 text-sm"
                                      />
                                    </div>
                                    <div className="max-h-56 overflow-y-auto space-y-1">
                                      {(col.filterOptions || [])
                                        .filter((opt) =>
                                          opt.label
                                            .toLowerCase()
                                            .includes(
                                              (filterSearches[String(col.key)] || '').toLowerCase()
                                            )
                                        )
                                        .map((opt) => {
                                          const currentValue = getFilterValue(String(col.key));
                                          const selected = Array.isArray(currentValue)
                                            ? currentValue.includes(opt.value.toLowerCase())
                                            : currentValue === opt.value.toLowerCase();

                                          return (
                                            <label
                                              key={opt.value}
                                              className="ka-option cursor-pointer justify-start text-sm"
                                            >
                                              <input
                                                type={
                                                  col.filterType === 'multi-select'
                                                    ? 'checkbox'
                                                    : 'radio'
                                                }
                                                checked={selected}
                                                onChange={(e) => {
                                                  if (col.filterType === 'multi-select') {
                                                    const current = Array.isArray(currentValue)
                                                      ? [...currentValue]
                                                      : [];
                                                    if (e.target.checked) {
                                                      current.push(opt.value.toLowerCase());
                                                    } else {
                                                      const index = current.indexOf(
                                                        opt.value.toLowerCase()
                                                      );
                                                      if (index >= 0) current.splice(index, 1);
                                                    }
                                                    handleFilter(String(col.key), current);
                                                  } else {
                                                    handleFilter(String(col.key), opt.value);
                                                    setShowFilterKey(null);
                                                  }
                                                }}
                                                className="ka-check h-4 w-4"
                                              />
                                              <span className="truncate">{opt.label}</span>
                                            </label>
                                          );
                                        })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  {rowActions && (
                    <th className="w-14 px-2 py-3 text-right align-middle">
                      <span className="sr-only">จัดการ</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-surface)]">
                {loading ? skeletonRows : data.length > 0 ? (
                  data.map((row, idx) => {
                    const selected = Boolean(selection?.selectedKeys.has(rowKey(row)));
                    return (
                    <tr
                      key={String(row[keyField]) || idx}
                      data-selected={selected || undefined}
                      className={`transition-[background-color,box-shadow] ${
                        selection ? 'duration-(--ka-motion-control)' : 'duration-150'
                      } hover:shadow-[inset_3px_0_0_var(--brand)] ${
                        selected
                          ? 'bg-[var(--brand-soft)] hover:bg-[var(--brand-soft)]'
                          : 'hover:bg-[var(--bg-subtle)]'
                      } ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName}`}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selection && (
                        <td className="w-12 px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <label className="ka-check-hit">
                            <input
                              type="checkbox"
                              className="ka-check"
                              checked={selected}
                              disabled={selectionLocked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => toggleRow(rowKey(row), e.target.checked)}
                              aria-label={`เลือก ${selection.getRowLabel(row)}`}
                            />
                          </label>
                        </td>
                      )}
                      {visibleColumns.map((col) => (
                        <td
                          key={String(col.key)}
                          className="px-4 py-3 text-[var(--ink)]"
                          style={col.width ? { width: col.width } : undefined}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : String(row[col.key] || '')}
                        </td>
                      ))}
                      {rowActions && (
                        <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <RowMenu label={`จัดการ ${rowActions.getLabel(row)}`} items={rowActions.items(row)} />
                        </td>
                      )}
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={columnSpan} className="px-4 py-16 text-center">
                      {emptyBlock}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {canShowPagination && (
          <div className={`mt-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 ${footerClassName}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {showPaginationInfo ? (
                <div className="text-sm text-[var(--ink-muted)] numeric">
                  แสดง {paginationStart}–{paginationEnd} จาก {paginationMeta?.total} รายการ
                </div>
              ) : (
                <div />
              )}
              <Pagination
                currentPage={currentPage as number}
                meta={paginationMeta}
                onPageChange={onPageChange as (page: number) => void}
              />
            </div>
          </div>
        )}


      </div>
    );
}

// forwardRef drops the row type; the cast keeps DataTable generic so each caller's columns stay typed.
const DataTableWithRef = React.forwardRef(DataTableInner);
DataTableWithRef.displayName = 'DataTable';

export const DataTable = DataTableWithRef as unknown as <T>(
  props: DataTableProps<T> & React.RefAttributes<HTMLDivElement>
) => React.ReactElement | null;
