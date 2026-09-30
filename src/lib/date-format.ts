type DateInput = string | Date | number | null | undefined;

type ThaiDateOptions = {
	month?: 'numeric' | '2-digit' | 'short' | 'long';
	year?: 'numeric' | '2-digit';
	day?: 'numeric' | '2-digit';
	fallback?: string;
};

const DEFAULT_FALLBACK = '-';

const parseDateInput = (value: DateInput): Date | null => {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	if (typeof value === 'number') {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	const text = String(value).trim();
	if (!text) {
		return null;
	}

	const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (dateOnly) {
		const year = Number(dateOnly[1]);
		const month = Number(dateOnly[2]) - 1;
		const day = Number(dateOnly[3]);
		const localDate = new Date(year, month, day);
		return Number.isNaN(localDate.getTime()) ? null : localDate;
	}

	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? null : date;
};

// Building an Intl.DateTimeFormat costs far more than formatting with one, and lists format a date per row.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getThaiFormatter = (options: Intl.DateTimeFormatOptions) => {
	const key = JSON.stringify(options);
	let formatter = formatterCache.get(key);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('th-TH', options);
		formatterCache.set(key, formatter);
	}
	return formatter;
};

export const formatThaiDate = (value: DateInput, options: ThaiDateOptions = {}) => {
	const date = parseDateInput(value);
	if (!date) {
		return options.fallback ?? DEFAULT_FALLBACK;
	}

	return getThaiFormatter({
		year: options.year ?? 'numeric',
		month: options.month ?? 'short',
		day: options.day ?? 'numeric',
	}).format(date);
};

export const formatThaiDateLong = (value: DateInput, fallback = DEFAULT_FALLBACK) => {
	return formatThaiDate(value, {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		fallback,
	});
};

export const formatThaiDateTime = (value: DateInput, fallback = DEFAULT_FALLBACK) => {
	const date = parseDateInput(value);
	if (!date) return fallback;

	return getThaiFormatter({
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
};

export const toDateValue = (value: DateInput) => parseDateInput(value);

const twoDigits = (value: number) => String(value).padStart(2, '0');

/**
 * `YYYY-MM-DD` of a moment as the person at this device reads the calendar. `toISOString()` gives the
 * UTC date instead, which is still yesterday from 00:00 to 07:00 in Thailand.
 */
export const toLocalIsoDate = (date: Date = new Date()) =>
	`${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

/** Today's date as `YYYY-MM-DD` on this device, for a date input's starting value. */
export const todayLocalIso = () => toLocalIsoDate();

/**
 * The `YYYY-MM-DD` to show in a date input for a date that is already stored. A stored value is a
 * calendar date the API wrote as UTC, so its own date part is used as it stands: converting it to
 * local time would move it by a day for some time zones and, saved again, shift the document.
 * A missing or unreadable value falls back to today.
 */
export const toDateInputValue = (value: DateInput) => {
	if (typeof value === 'string') {
		const stored = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/);
		if (stored) return stored[1];
	}
	const date = parseDateInput(value);
	return date ? toLocalIsoDate(date) : todayLocalIso();
};
