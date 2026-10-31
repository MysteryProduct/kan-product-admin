import Cookies from 'js-cookie';
import type { BadgeTone } from '@/components/StatusBadge';
import type { JobOrder } from '@/types/job-order';
import { toLocalIsoDate } from '@/lib/date-format';

// Board columns, transitions and date helpers shared by the job order page and its views.

export const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

export type BoardStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ViewMode = 'board' | 'list' | 'calendar';

export interface CalendarCell {
	date: Date;
	dateKey: string;
	inCurrentMonth: boolean;
	jobs: JobOrder[];
}

export interface BoardColumn {
	key: BoardStatus;
	label: string;
	short: string;
	tone: BadgeTone;
	/** The column's top border and the calendar dot. */
	color: string;
	empty: string;
}

export const BOARD_COLUMNS: BoardColumn[] = [
	{ key: 'pending', label: 'รอดำเนินการ', short: 'รอ', tone: 'warning', color: 'var(--warning)', empty: 'ยังไม่มีงานรอ สร้างงานใหม่ หรือลากการ์ดมาวาง' },
	{ key: 'in_progress', label: 'กำลังผลิต', short: 'กำลังผลิต', tone: 'info', color: 'var(--info)', empty: 'ลากการ์ดมาที่นี่เมื่อเริ่มผลิต' },
	{ key: 'completed', label: 'ผลิตเสร็จแล้ว', short: 'เสร็จ', tone: 'success', color: 'var(--success)', empty: 'ยังไม่มีงานที่เสร็จในช่วงนี้' },
	{ key: 'cancelled', label: 'ยกเลิก', short: 'ยกเลิก', tone: 'neutral', color: 'var(--neutral)', empty: 'ไม่มีงานที่ยกเลิก' },
];

export const WEEKDAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// Same transitions the API enforces; completed and cancelled are final.
export const ALLOWED_TRANSITIONS: Record<BoardStatus, BoardStatus[]> = {
	pending: ['in_progress', 'cancelled'],
	in_progress: ['completed', 'cancelled'],
	completed: [],
	cancelled: [],
};

export const PAGE_SIZE = 8;
export const DEFAULT_VISIBLE: Record<BoardStatus, number> = {
	pending: PAGE_SIZE,
	in_progress: PAGE_SIZE,
	completed: PAGE_SIZE,
	cancelled: PAGE_SIZE,
};

export const toIsoDate = toLocalIsoDate;

export const parseCalendarMonth = (calendarMonth: string) => {
	const [yearText, monthText] = calendarMonth.split('-');
	const year = Number(yearText);
	const month = Number(monthText);

	if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1);
	}

	return new Date(year, month - 1, 1);
};

export const normalizeStatus = (status?: string): BoardStatus => {
	if (!status) {
		return 'pending';
	}

	const lower = String(status).toLowerCase();

	if (['pending', 'todo', 'ready', 'รอดำเนินการ'].includes(lower)) {
		return 'pending';
	}
	if (['in_progress', 'in progress', 'doing', 'กำลังผลิต'].includes(lower)) {
		return 'in_progress';
	}
	if (['completed', 'done', 'ผลิตเสร็จแล้ว'].includes(lower)) {
		return 'completed';
	}
	if (['cancelled', 'canceled', 'ยกเลิกการผลิต'].includes(lower)) {
		return 'cancelled';
	}

	return 'pending';
};

export const getAssigneeName = (job: JobOrder): string => {
	return (
		job.employee?.employee_fullname ||
		`${job.employee?.employee_firstname || ''} ${job.employee?.employee_lastname || ''}`.trim() ||
		job.employee_id ||
		'-'
	);
};

export const mapStatusToLabel = (status: BoardStatus) => {
	if (status === 'pending') {
		return 'รอดำเนินการ';
	}
	if (status === 'in_progress') {
		return 'กำลังผลิต';
	}
	if (status === 'completed') {
		return 'ผลิตเสร็จแล้ว';
	}
	return 'ยกเลิกการผลิต';
};

export const getUserFromCookie = () => {
	try {
		const raw = Cookies.get('user');
		if (!raw) {
			return null;
		}
		return JSON.parse(raw) as { employee_id?: string };
	} catch (error) {
		console.error('Cannot parse user cookie:', error);
		return null;
	}
};

export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const toDateKey = toLocalIsoDate;

export type StatusTab = 'all' | 'late' | BoardStatus;

/** Colours and labels of the status tabs, list groups and calendar bars; every colour is a design token. */
export const STATUS_META: Record<StatusTab, { label: string; color: string; soft: string }> = {
	all: { label: 'ทั้งหมด', color: 'var(--ink)', soft: 'var(--bg-subtle)' },
	late: { label: 'เลยกำหนด', color: 'var(--danger)', soft: 'var(--danger-soft)' },
	pending: { label: 'รอดำเนินการ', color: 'var(--warning)', soft: 'var(--warning-soft)' },
	in_progress: { label: 'กำลังผลิต', color: 'var(--info)', soft: 'var(--info-soft)' },
	completed: { label: 'เสร็จแล้ว', color: 'var(--success)', soft: 'var(--success-soft)' },
	cancelled: { label: 'ยกเลิก', color: 'var(--neutral)', soft: 'var(--neutral-soft)' },
};

const BANGKOK_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
const THAI_DAY_MONTH = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' });
const THAI_DAY_MONTH_YEAR = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' });

/**
 * `YYYY-MM-DD` of a stored date as read in Thailand. A bare date string is already a calendar day;
 * a timestamp is converted, so 23:30 and 00:30 Bangkok time fall on their own days on any device.
 */
export const bangkokDayKey = (value: string | Date | null | undefined): string | null => {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : BANGKOK_DAY.format(date);
};

const dayNumber = (key: string) => {
	const [year, month, day] = key.split('-').map(Number);
	return Date.UTC(year, month - 1, day) / DAY_IN_MS;
};

export type DueTone = 'success' | 'warning' | 'danger' | 'neutral';
export interface DueInfo {
	text: string;
	tone: DueTone;
	/** Pending or in progress with its target day already past. */
	late: boolean;
	/** Days from today to the target day, negative once it has passed; null without a target date. */
	days: number | null;
}

/** The target-date label of a job: overdue, due today, due soon or just the day, counted in Bangkok days. */
export const getDueInfo = (job: Pick<JobOrder, 'job_order_status' | 'target_date'>, now: Date = new Date()): DueInfo => {
	const status = normalizeStatus(job.job_order_status);
	const targetKey = bangkokDayKey(job.target_date ?? null);
	if (!targetKey) return { text: 'ไม่ระบุวัน', tone: 'neutral', late: false, days: null };

	const todayKey = BANGKOK_DAY.format(now);
	const days = dayNumber(targetKey) - dayNumber(todayKey);
	const noon = new Date(`${targetKey}T12:00:00+07:00`);
	const label = (targetKey.slice(0, 4) === todayKey.slice(0, 4) ? THAI_DAY_MONTH : THAI_DAY_MONTH_YEAR).format(noon);

	if (status === 'completed') return { text: `เสร็จ · ${label}`, tone: 'success', late: false, days };
	if (status === 'cancelled') return { text: label, tone: 'neutral', late: false, days };
	if (days < 0) return { text: `เลย ${count(-days)} วัน · ${label}`, tone: 'danger', late: true, days };
	if (days === 0) return { text: 'ครบวันนี้', tone: 'warning', late: false, days };
	return { text: `อีก ${count(days)} วัน · ${label}`, tone: days <= 3 ? 'warning' : 'neutral', late: false, days };
};

const VARIANT_PART = /(?:^|\s)(size|color)\s*:\s*(.*?)(?=\s+(?:size|color)\s*:|$)/gi;

/**
 * Splits "ชื่อสินค้า Size:20 ออนซ์ Color:กรมท่า", the name the create drawer writes for a product
 * variant, into the product name and its size and colour.
 */
export const splitVariantLabel = (name: string): { name: string; size?: string; color?: string } => {
	const text = String(name ?? '').replace(/\s+/g, ' ').trim();
	const result: { name: string; size?: string; color?: string } = { name: text };
	let firstIndex = -1;
	for (const match of text.matchAll(VARIANT_PART)) {
		if (firstIndex < 0) firstIndex = match.index ?? 0;
		const value = match[2].trim();
		if (!value) continue;
		if (match[1].toLowerCase() === 'size') result.size ??= value;
		else result.color ??= value;
	}
	if (firstIndex >= 0) result.name = text.slice(0, firstIndex).trim() || text;
	return result;
};

/** The card title and its size and colour pills: the job's own size and colour first, then those written in its name. */
export const getVariantLabel = (job: Pick<JobOrder, 'job_order_name' | 'size' | 'color' | 'productVariant'>) => {
	const parsed = splitVariantLabel(job.job_order_name);
	const size = job.size?.size_name || job.productVariant?.size?.size_name || parsed.size;
	const color = job.color?.color_name || job.productVariant?.color?.color_name || parsed.color;
	return { title: parsed.name, pills: [size, color].filter((value): value is string => Boolean(value)) };
};

export const initial = (name: string) => (name.trim()[0] || '?').toUpperCase();
export const TYPE_LABEL: Record<string, string> = { website: 'Website', purchase: 'สั่งซื้อ', custom: 'Custom' };

/** The weeks of a month as day cells, each with the jobs whose target date falls on it. */
export function buildCalendarCells(calendarDate: Date, filteredJobOrders: JobOrder[]): CalendarCell[] {
	const currentYear = calendarDate.getFullYear();
	const currentMonth = calendarDate.getMonth();
	const monthStart = new Date(currentYear, currentMonth, 1);
	const monthEnd = new Date(currentYear, currentMonth + 1, 0);
	const daysInMonth = monthEnd.getDate();
	const leadingDays = monthStart.getDay();
	const totalSlots = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

	const jobsByDate = new Map<string, JobOrder[]>();
	const monthKey = toDateKey(monthStart).slice(0, 7);
	filteredJobOrders.forEach((job) => {
		// Grouped by the Bangkok day, the same day the card's due label counts from.
		const key = bangkokDayKey(job.target_date ?? null);
		if (!key || key.slice(0, 7) !== monthKey) {
			return;
		}

		const previous = jobsByDate.get(key) || [];
		jobsByDate.set(key, [...previous, job]);
	});

	return Array.from({ length: totalSlots }, (_, index) => {
		const date = new Date(currentYear, currentMonth, index - leadingDays + 1);
		const dateKey = toDateKey(date);
		const jobs = jobsByDate.get(dateKey) || [];

		return {
			date,
			dateKey,
			inCurrentMonth: date.getMonth() === currentMonth,
			jobs,
		};
	});
}
