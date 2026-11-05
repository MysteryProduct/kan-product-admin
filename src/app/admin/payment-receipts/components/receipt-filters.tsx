"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import Popover from "@/components/Popover";
import RowMenu from "@/components/RowMenu";
import { useIsPhone } from "@/hooks/useMediaQuery";
import { formatThaiDate, toLocalIsoDate } from "@/lib/date-format";
import PaymentReceiptModel from "@/models/payment-receipt";
import type {
  PaymentReceiptFilters,
  PaymentReceiptMethodFilter,
  PaymentReceiptSummary,
  PaymentReceiptTab,
  PaymentReceiptType,
} from "@/types/payment-receipt";
import {
  METHODS,
  SORTS,
  TABS,
  TYPES,
  type ReceiptSort,
} from "../lib/receipt-display";
import { Icon } from "./receipt-ui";

const receiptModel = new PaymentReceiptModel();

export interface FilterValues {
  tab: PaymentReceiptTab;
  method: PaymentReceiptMethodFilter[];
  type: PaymentReceiptType[];
  from: string;
  to: string;
}

const MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const WEEK = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

type Preset = "today" | "7d" | "month" | "last";

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = toLocalIsoDate(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d")
    return {
      from: toLocalIsoDate(new Date(year, month, now.getDate() - 6)),
      to: today,
    };
  if (preset === "month")
    return { from: toLocalIsoDate(new Date(year, month, 1)), to: today };
  return {
    from: toLocalIsoDate(new Date(year, month - 1, 1)),
    to: toLocalIsoDate(new Date(year, month, 0)),
  };
}

function activePreset(from: string, to: string): Preset | null {
  return (
    (["today", "7d", "month", "last"] as Preset[]).find((key) => {
      const range = presetRange(key);
      return range.from === from && range.to === to;
    }) ?? null
  );
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "7d", label: "7 วันล่าสุด" },
  { key: "month", label: "เดือนนี้" },
  { key: "last", label: "เดือนก่อน" },
];

/** "1–4 พ.ย. 2569", or both dates in full when the range crosses a month. */
export function rangeText(from: string, to: string): string {
  if (!from && !to) return "";
  if (!from || !to) return formatThaiDate(from || to);
  if (from === to) return formatThaiDate(from);
  if (from.slice(0, 7) === to.slice(0, 7))
    return `${Number(from.slice(8))}–${formatThaiDate(to)}`;
  return `${formatThaiDate(from)} – ${formatThaiDate(to)}`;
}

function toggled<T>(list: T[], value: T, on: boolean): T[] {
  return on ? [...list, value] : list.filter((item) => item !== value);
}

/** A month grid in Buddhist years. The first click starts a range, the second ends it, in either direction. */
function Calendar({
  from,
  to,
  onPick,
}: {
  from: string;
  to: string;
  onPick: (from: string, to: string) => void;
}) {
  const start = from ? new Date(`${from}T00:00:00`) : new Date();
  const [shown, setShown] = useState({
    year: start.getFullYear(),
    month: start.getMonth(),
  });
  const [anchor, setAnchor] = useState<string | null>(null);

  const days = useMemo(() => {
    const first = new Date(shown.year, shown.month, 1);
    return Array.from(
      { length: 42 },
      (_, index) =>
        new Date(shown.year, shown.month, index + 1 - first.getDay()),
    );
  }, [shown]);
  const lastRow = days.slice(35).every((day) => day.getMonth() !== shown.month)
    ? 35
    : 42;

  const step = (by: number) =>
    setShown(({ year, month }) => {
      const next = new Date(year, month + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const pick = (iso: string) => {
    if (!anchor) {
      setAnchor(iso);
      onPick(iso, iso);
      return;
    }
    onPick(anchor < iso ? anchor : iso, anchor < iso ? iso : anchor);
    setAnchor(null);
  };

  return (
    <>
      <div className="ka-pr-cal__head">
        <button
          type="button"
          className="ka-pr-ib ka-pr-ib--sm"
          aria-label="เดือนก่อน"
          onClick={() => step(-1)}
        >
          <Icon name="prev" small />
        </button>
        <span aria-live="polite">
          {MONTHS[shown.month]} {shown.year + 543}
        </span>
        <button
          type="button"
          className="ka-pr-ib ka-pr-ib--sm"
          aria-label="เดือนถัดไป"
          onClick={() => step(1)}
        >
          <Icon name="next" small />
        </button>
      </div>
      <div className="ka-pr-cal">
        {WEEK.map((day) => (
          <span key={day} className="ka-pr-cal__h">
            {day}
          </span>
        ))}
        {days.slice(0, lastRow).map((day) => {
          const iso = toLocalIsoDate(day);
          const edge = iso === from || iso === to;
          return (
            <button
              key={iso}
              type="button"
              className="ka-pr-cal__day"
              aria-label={formatThaiDate(iso)}
              aria-pressed={edge}
              data-out={day.getMonth() !== shown.month || undefined}
              data-in={(from && to && iso > from && iso < to) || undefined}
              data-edge={edge || undefined}
              onClick={() => pick(iso)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}

interface ChipProps {
  label: string;
  /** What the filter holds now; the chip turns solid and offers × when it holds anything. */
  value: string;
  onOpen: () => void;
  onClear: () => void;
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function Chip({ label, value, onOpen, onClear, open, anchorRef }: ChipProps) {
  if (!value) {
    return (
      <button
        ref={anchorRef as React.RefObject<HTMLButtonElement>}
        type="button"
        className="ka-pr-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onOpen}
      >
        <Icon name="plus" small />
        {label}
      </button>
    );
  }
  return (
    <span
      ref={anchorRef as React.RefObject<HTMLSpanElement>}
      className="ka-pr-chipon"
    >
      <button
        type="button"
        className="ka-pr-chipon__open"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onOpen}
      >
        {label}: <b>{value}</b>
      </button>
      <button
        type="button"
        className="ka-pr-x"
        aria-label={`เอาตัวกรอง${label}ออก`}
        onClick={onClear}
      >
        <Icon name="close" small />
      </button>
    </span>
  );
}

interface CheckFilterProps<T extends string> {
  label: string;
  heading: string;
  options: { value: T; label: string }[];
  selected: T[];
  counts?: Partial<Record<T, number>>;
  onApply: (values: T[]) => void;
  /** Below 640px every chip opens the one filter sheet instead (D12). */
  onOpenSheet?: () => void;
}

function CheckFilter<T extends string>({
  label,
  heading,
  options,
  selected,
  counts,
  onApply,
  onOpenSheet,
}: CheckFilterProps<T>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T[]>(selected);
  const anchorRef = useRef<HTMLElement>(null);
  const value = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label)
    .join(", ");

  return (
    <>
      <Chip
        label={label}
        value={value}
        open={open}
        anchorRef={anchorRef}
        onOpen={() => {
          if (onOpenSheet) {
            onOpenSheet();
            return;
          }
          setDraft(selected);
          setOpen((shown) => !shown);
        }}
        onClear={() => onApply([])}
      />
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title={heading}
        width={320}
        footer={
          <>
            <button
              type="button"
              className="ka-pr-btn ka-pr-btn--gh ka-pr-btn--sm"
              onClick={() => setDraft([])}
            >
              ล้าง
            </button>
            <button
              type="button"
              className="ka-pr-btn ka-pr-btn--a ka-pr-btn--sm"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              ใช้ตัวกรอง
            </button>
          </>
        }
      >
        <div className="ka-pr-pop">
          <div className="ka-pr-pop__head">
            {heading}
            <span className="ka-pr-cap">
              {draft.length ? `เลือก ${draft.length}` : "ยังไม่เลือก"}
            </span>
          </div>
          <div className="ka-pr-pop__body">
            {options.map((option) => (
              <label key={option.value} className="ka-pr-ck">
                <input
                  type="checkbox"
                  checked={draft.includes(option.value)}
                  onChange={(event) =>
                    setDraft((list) =>
                      toggled(list, option.value, event.target.checked),
                    )
                  }
                />
                {option.label}
                {counts?.[option.value] !== undefined && (
                  <span className="ka-pr-ck__n">{counts[option.value]}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      </Popover>
    </>
  );
}

interface DateFilterProps {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onOpenSheet?: () => void;
}

function DateFilter({ from, to, onApply, onOpenSheet }: DateFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const anchorRef = useRef<HTMLElement>(null);
  const preset = activePreset(draft.from, draft.to);

  return (
    <>
      <Chip
        label="ช่วงวันที่"
        value={rangeText(from, to)}
        open={open}
        anchorRef={anchorRef}
        onOpen={() => {
          if (onOpenSheet) {
            onOpenSheet();
            return;
          }
          setDraft({ from, to });
          setOpen((shown) => !shown);
        }}
        onClear={() => onApply("", "")}
      />
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title="ช่วงวันที่รับชำระ"
        width={320}
        footer={
          <>
            <button
              type="button"
              className="ka-pr-btn ka-pr-btn--gh ka-pr-btn--sm"
              onClick={() => setDraft({ from: "", to: "" })}
            >
              ล้าง
            </button>
            <button
              type="button"
              className="ka-pr-btn ka-pr-btn--a ka-pr-btn--sm"
              onClick={() => {
                onApply(draft.from, draft.to);
                setOpen(false);
              }}
            >
              ใช้ตัวกรอง
            </button>
          </>
        }
      >
        <div className="ka-pr-pop">
          <div className="ka-pr-pop__head">
            ช่วงวันที่รับชำระ
            <span className="ka-pr-cap">
              {rangeText(draft.from, draft.to) || "ยังไม่เลือก"}
            </span>
          </div>
          <div className="ka-pr-presets">
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="ka-pr-pre"
                aria-pressed={preset === item.key}
                onClick={() => setDraft(presetRange(item.key))}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Calendar
            from={draft.from}
            to={draft.to}
            onPick={(start, end) => setDraft({ from: start, to: end })}
          />
        </div>
      </Popover>
    </>
  );
}

export function SortMenu({
  sort,
  onChange,
}: {
  sort: ReceiptSort;
  onChange: (sort: ReceiptSort) => void;
}) {
  return (
    <RowMenu
      label={`เรียงลำดับ: ${SORTS[sort].label}`}
      width={260}
      menuClassName="ka-pr-menu"
      triggerClassName="ka-pr-chip ka-pr-chip--sq"
      trigger={
        <>
          {SORTS[sort].label}
          <Icon name="chevron" small />
        </>
      }
      items={(Object.keys(SORTS) as ReceiptSort[]).map((key) => ({
        label: SORTS[key].label,
        current: key === sort,
        onSelect: () => onChange(key),
      }))}
    />
  );
}

interface FilterSheetProps {
  open: boolean;
  values: FilterValues;
  /** The filters that do not change inside the sheet: the search words. */
  search: string;
  summary: PaymentReceiptSummary | null;
  onClose: () => void;
  onApply: (values: FilterValues) => void;
}

/** R12: every filter on one sheet; the button counts the rows of what is ticked, before it is applied. */
function FilterSheet({
  open,
  values,
  search,
  summary,
  onClose,
  onApply,
}: FilterSheetProps) {
  const [draft, setDraft] = useState(values);
  const [shownFor, setShownFor] = useState(open);
  const [custom, setCustom] = useState(false);
  const [counts, setCounts] = useState<PaymentReceiptSummary["tabs"] | null>(
    summary?.tabs ?? null,
  );
  if (shownFor !== open) {
    setShownFor(open);
    if (open) {
      setDraft(values);
      setCustom(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    const filters: PaymentReceiptFilters = {
      search,
      payment_method: draft.method,
      payment_receipt_type: draft.type,
      date_start: draft.from,
      date_end: draft.to,
    };
    receiptModel
      .getPaymentReceiptSummary(filters)
      .then((next) => {
        if (active) setCounts(next.tabs);
      })
      .catch(() => {
        if (active) setCounts(null);
      });
    return () => {
      active = false;
    };
  }, [open, search, draft.method, draft.type, draft.from, draft.to]);

  const preset = activePreset(draft.from, draft.to);
  const shown = counts?.[draft.tab];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="ตัวกรอง"
      closeLabel="ปิดตัวกรอง"
      placement="sheet"
      size="compact"
      className="ka-pr-sheet ka-pr-filter"
      footer={
        <>
          <button
            type="button"
            className="ka-pr-btn"
            onClick={() =>
              setDraft({ tab: "all", method: [], type: [], from: "", to: "" })
            }
          >
            ล้าง
          </button>
          <button
            type="button"
            className="ka-pr-btn ka-pr-btn--a"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {shown === undefined ? "แสดงรายการ" : `แสดง ${shown} รายการ`}
          </button>
        </>
      }
    >
      <div className="ka-pr-fsec">
        <h3>สถานะ</h3>
        <div className="ka-pr-tabs" role="tablist" aria-label="สถานะใบเสร็จ">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              className="ka-pr-tab"
              aria-selected={draft.tab === item.key}
              onClick={() => setDraft((value) => ({ ...value, tab: item.key }))}
            >
              {item.label}
              {counts && (
                <span className="ka-pr-tab__n">{counts[item.key]}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="ka-pr-fsec" id="ka-pr-fsec-method">
        <h3>วิธีชำระ</h3>
        {METHODS.map((item) => (
          <label key={item.value} className="ka-pr-sck">
            <input
              type="checkbox"
              checked={draft.method.includes(item.value)}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  method: toggled(
                    value.method,
                    item.value,
                    event.target.checked,
                  ),
                }))
              }
            />
            {item.label}
          </label>
        ))}
      </div>
      <div className="ka-pr-fsec" id="ka-pr-fsec-type">
        <h3>ประเภท</h3>
        {TYPES.map((item) => (
          <label key={item.value} className="ka-pr-sck">
            <input
              type="checkbox"
              checked={draft.type.includes(item.value)}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  type: toggled(value.type, item.value, event.target.checked),
                }))
              }
            />
            {item.label}
          </label>
        ))}
      </div>
      <div className="ka-pr-fsec" id="ka-pr-fsec-date">
        <h3>ช่วงวันที่</h3>
        <div className="ka-pr-row ka-pr-row--8 ka-pr-row--wrap">
          {PRESETS.filter((item) => item.key !== "last").map((item) => (
            <button
              key={item.key}
              type="button"
              className="ka-pr-pre"
              aria-pressed={preset === item.key && !custom}
              onClick={() => {
                setCustom(false);
                const range = presetRange(item.key);
                setDraft((value) => ({ ...value, ...range }));
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className="ka-pr-pre"
            aria-pressed={custom}
            onClick={() => setCustom(true)}
          >
            เลือกเอง
          </button>
        </div>
        {custom && (
          <Calendar
            from={draft.from}
            to={draft.to}
            onPick={(from, to) => setDraft((value) => ({ ...value, from, to }))}
          />
        )}
      </div>
    </Modal>
  );
}

interface FilterBarProps {
  values: FilterValues;
  search: string;
  summary: PaymentReceiptSummary | null;
  onChange: (next: Partial<FilterValues>) => void;
}

/** The three filter chips. Below 640px they stay as drawn on `Receipts-sm` and all open the sheet (D12). */
export function FilterChips({
  values,
  search,
  summary,
  onChange,
}: FilterBarProps) {
  const isPhone = useIsPhone();
  const [sheet, setSheet] = useState<string | null>(null);
  const openSheet = (section: string) =>
    isPhone ? () => setSheet(section) : undefined;

  useEffect(() => {
    if (sheet)
      document
        .getElementById(`ka-pr-fsec-${sheet}`)
        ?.scrollIntoView({ block: "start" });
  }, [sheet]);

  return (
    <>
      <CheckFilter
        label="วิธีชำระ"
        heading="วิธีชำระ"
        options={METHODS}
        selected={values.method}
        counts={summary?.facets.method}
        onApply={(method) => onChange({ method })}
        onOpenSheet={openSheet("method")}
      />
      <CheckFilter
        label="ประเภท"
        heading="ประเภทการชำระ"
        options={TYPES}
        selected={values.type}
        onApply={(type) => onChange({ type })}
        onOpenSheet={openSheet("type")}
      />
      <DateFilter
        from={values.from}
        to={values.to}
        onApply={(from, to) => onChange({ from, to })}
        onOpenSheet={openSheet("date")}
      />
      <FilterSheet
        open={Boolean(sheet)}
        values={values}
        search={search}
        summary={summary}
        onClose={() => setSheet(null)}
        onApply={onChange}
      />
    </>
  );
}
