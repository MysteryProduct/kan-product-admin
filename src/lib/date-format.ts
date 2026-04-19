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

export const formatThaiDate = (value: DateInput, options: ThaiDateOptions = {}) => {
	const date = parseDateInput(value);
	if (!date) {
		return options.fallback ?? DEFAULT_FALLBACK;
	}

	return new Intl.DateTimeFormat('th-TH', {
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

export const toDateValue = (value: DateInput) => parseDateInput(value);