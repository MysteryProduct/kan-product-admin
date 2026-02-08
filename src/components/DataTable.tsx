'use client';

import React, { useMemo, useState } from 'react';

export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'multi-select';
  filterOptions?: Array<{ label: string; value: string }>;
  filterValue?: (row: T) => string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyField: keyof T;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  onFilterChange?: (filters: Record<string, string | string[]>) => void;
  onSortChange?: (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => void;
  className?: string;
  headerClassName?: string;
  rowClassName?: string;
}

interface SortConfig<T> {
  key: keyof T;
  direction: 'ASC' | 'DESC';
}

interface FilterConfig<T> {
  key: keyof T;
  value: string | string[];
}

export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps<any>>(
  (
    {
      data,
      columns,
      keyField,
      pageSize = 10,
      onRowClick,
      onFilterChange,
      onSortChange,
      className = '',
      headerClassName = '',
      rowClassName = '',
    },
    ref
  ) => {
    const [sortConfig, setSortConfig] = useState<SortConfig<any> | null>(null);
    const [filterConfigs, setFilterConfigs] = useState<FilterConfig<any>[]>([]);
    const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
    const [filterSearches, setFilterSearches] = useState<Record<string, string>>({});
    const [showFilterKey, setShowFilterKey] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const filterRefs = React.useRef<Record<string, HTMLElement | null>>({});

    const tableScrollRef = React.useRef<HTMLDivElement | null>(null);

    // Handle filter dropdown positioning
    const updateDropdownPosition = (colKey: string | number) => {
      const element = filterRefs.current[String(colKey)];
      if (element) {
        const rect = element.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + window.scrollY + 8,
          left: rect.right - 200 + window.scrollX, // 224px = w-56 (14rem * 16px)
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
    // Handle sort
    const handleSort = (key: string) => {
      const columnKey = key as keyof any;
      const nextSort =
        sortConfig?.key === columnKey
          ? sortConfig.direction === 'ASC'
            ? { key: columnKey, direction: 'DESC' as const }
            : null
          : { key: columnKey, direction: 'ASC' as const };

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
      const columnKey = key as keyof any;
      let updatedFilters: FilterConfig<any>[] = [];
      
      await setFilterConfigs((prev) => {
        const newFilters = prev.filter((f) => f.key !== columnKey);
        const normalizedValue = Array.isArray(value)
          ? value.map((v) => v.toLowerCase())
          : value.toLowerCase();
        if (Array.isArray(normalizedValue) ? normalizedValue.length > 0 : normalizedValue.trim()) {
          newFilters.push({ key: columnKey, value: normalizedValue });
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

    // Apply filters and sorting
    const processedData = useMemo(() => {
      let result = [...data];
      return result;
    }, [data]);

    return (
      <div
        ref={ref}
        className={`w-full ${className}`}
        onClick={() => setOpenFilterKey(null)}
      >
        {/* Table Container */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-lg bg-white">
          <div className="overflow-x-auto" ref={tableScrollRef}>
            <table className="w-full">
              <thead>
                <tr className={`bg-slate-900 border-b border-slate-700 ${headerClassName}`}>
                  {columns.map((col) => (
                    <th
                      key={String(col.key)}
                      data-filter-col={col.key}
                      className="px-5 py-4 text-left"
                      style={col.width ? { width: col.width } : undefined}
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
                            onClick={() => col.sortable && handleSort(String(col.key))}
                          >
                            <span className="text-xs font-semibold text-white uppercase tracking-wider">
                              {col.label}
                            </span>
                            {col.sortable && (
                              <span className="inline-flex items-center text-slate-300 group-hover:text-white transition-colors">
                                {sortConfig?.key === col.key ? (
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
                                e.stopPropagation();
                                setShowFilterKey((prev) => {
                                  const newVal = prev === String(col.key) ? null : String(col.key);
                                  if (newVal) {
                                    setTimeout(() => updateDropdownPosition(String(col.key)), 0);
                                  }
                                  return newVal;
                                });
                                setOpenFilterKey(null);
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                              aria-label="Toggle column filter"
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
                        {showFilterKey === String(col.key) && col.filterable && (
                          <div className="relative">
                            {col.filterType === 'text' || !col.filterType ? (
                              <div className="relative">
                                <svg
                                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                                  placeholder="Search..."
                                  value={(getFilterValue(String(col.key)) as string) || ''}
                                  onChange={(e) =>
                                    handleFilter(String(col.key), e.target.value)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full pl-10 pr-3.5 py-2 text-xs border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-800/70 text-white placeholder:text-slate-400 hover:border-slate-600 transition-all duration-200"
                                />
                              </div>
                            ) : (
                              <div className="relative">
                                <div
                                  className="fixed z-50 rounded-xl border border-slate-700 bg-slate-900 text-white shadow-2xl w-50"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    top: `${dropdownPos.top}px`,
                                    left: `${dropdownPos.left}px`,
                                  }}
                                >
                                  <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-300 border-b border-slate-700">
                                    <button
                                      onClick={() =>
                                        handleFilter(
                                          String(col.key),
                                          col.filterOptions?.map((opt) => opt.value) || []
                                        )
                                      }
                                      className="hover:text-white"
                                    >
                                      Select all ({col.filterOptions?.length || 0})
                                    </button>
                                    <button
                                      onClick={() => handleFilter(String(col.key), [])}
                                      className="hover:text-white"
                                    >
                                      Deselect
                                    </button>
                                  </div>
                                  <div className="p-3">
                                    <div className="relative mb-3">
                                      <svg
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                                        placeholder="Search..."
                                        value={filterSearches[String(col.key)] || ''}
                                        onChange={(e) =>
                                          setFilterSearches((prev) => ({
                                            ...prev,
                                            [String(col.key)]: e.target.value,
                                          }))
                                        }
                                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 text-white text-sm placeholder:text-slate-400 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-sm"
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
                                                className="h-4 w-4 rounded border-slate-500 text-blue-500 focus:ring-blue-500"
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedData.length > 0 ? (
                  processedData.map((row, idx) => (
                    <tr
                      key={String(row[keyField]) || idx}
                      className={`transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 hover:shadow-md border-l-4 border-transparent hover:border-blue-400 ${
                        onRowClick ? 'cursor-pointer' : ''
                      } ${rowClassName}`}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((col) => (
                        <td
                          key={String(col.key)}
                          className="px-6 py-4 text-sm font-medium text-gray-800"
                          style={col.width ? { width: col.width } : undefined}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : String(row[col.key] || '')}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mb-4">
                          <svg
                            className="w-8 h-8 text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                            />
                          </svg>
                        </div>
                        <p className="text-gray-600 font-semibold text-lg">No data found</p>
                        <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>


      </div>
    );
  }
);

DataTable.displayName = 'DataTable';
