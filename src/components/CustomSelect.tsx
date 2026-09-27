'use client';
import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string | number;
  label: string;
  color?: string; // สำหรับแสดงสีใน option
  disabled?: boolean;
}

interface CustomSelectProps {
  options: Option[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  label?: string;
  showColor?: boolean;
  fetchData?: (query: string) => void;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'เลือก...',
  required = false,
  label,
  showColor = false,
  fetchData,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((opt) => opt.value.toString() === value.toString());


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search query
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (optionValue: string | number, disabled?: boolean) => {
    if (disabled) {
      return;
    }

    onChange(optionValue.toString());
    setIsOpen(false);
    setSearchQuery('');
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length >= 4) {
      // Call fetchData function to get new options
      if (typeof fetchData === 'function') {
        fetchData(e.target.value);
      }
    }
  }
  return (
    <div ref={dropdownRef} className="relative">
      {label && (
        <label className="ka-label mb-1.5 block">
          {label} {required && <span className="ka-req">*</span>}
        </label>
      )}

      {/* Selected value display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="ka-select__trigger"
      >
        <span className="flex items-center gap-2">
          {showColor && selectedOption?.color && (
            <span
              className="h-5 w-5 flex-shrink-0 rounded border border-[var(--border-control)]"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          <span className={selectedOption ? '' : 'ka-select__placeholder'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <svg
          className="flex-none" aria-hidden="true"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="ka-select__menu z-50">
          {/* Search input */}
          <div className="ka-select__search">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="ค้นหา..."
              className="ka-input min-h-9 py-1.5 text-sm"
              autoFocus
            />
          </div>

          {/* Options list - max 5 items visible */}
          <div className="max-h-[200px] overflow-y-auto overscroll-contain" role="listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value, option.disabled)}
                  disabled={option.disabled}
                  role="option"
                  aria-selected={option.value.toString() === value.toString()}
                  className={`ka-option w-full justify-start text-left ${option.disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''}`}
                >
                  {showColor && option.color && (
                    <span
                      className="h-5 w-5 flex-shrink-0 rounded border border-[var(--border-control)]"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span>{option.label}</span>
                  {option.value.toString() === value.toString() && (
                    <svg
                      className="ml-auto h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-[var(--ink-muted)]">ไม่พบข้อมูล</div>
            )}
          </div>
        </div>
      )}

      {/* Hidden input for form validation */}
      <input
        type="hidden"
        value={value}
        required={required}
        onChange={() => { }}
      />
    </div>
  );
}
