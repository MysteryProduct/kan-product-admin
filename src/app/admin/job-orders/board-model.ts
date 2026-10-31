import Cookies from 'js-cookie';
import type { BadgeTone } from '@/components/StatusBadge';
import type { JobOrder } from '@/types/job-order';
import { toDateValue, toLocalIsoDate } from '@/lib/date-format';

// Board columns, transitions and date helpers shared by the job order page and its views.

export const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

export type BoardStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ViewMode = 'board' | 'calendar';

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
	{ key: 'cancelled', label: 'ยกเลิก', short: 'ยกเลิก', tone: 'neutral', color: 'var(--danger)', empty: 'ไม่มีงานที่ยกเลิก' },
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

export const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const toDateKey = toLocalIsoDate;

export const getDelayDays = (targetDate: Date, compareDate: Date) => {
	const target = startOfDay(targetDate);
	const compare = startOfDay(compareDate);
	return Math.floor((compare.getTime() - target.getTime()) / DAY_IN_MS);
};

export const getFinishDate = (job: JobOrder): Date | null => {
	return (
		toDateValue(job.finish_date) ||
		toDateValue(job.completed_date) ||
		toDateValue(job.completed_at) ||
		toDateValue(job.finish_at)
	);
};

export const getDelayBadge = (job: JobOrder) => {
	const status = normalizeStatus(job.job_order_status);
	if (status === 'cancelled') {
		return null;
	}

	const targetDate = toDateValue(job.target_date);
	if (!targetDate) {
		return {
			label: 'ไม่มีวันเป้าหมาย',
			tone: 'neutral' as BadgeTone,
		};
	}

	if (status === 'completed') {
		const finishDate = getFinishDate(job);
		if (!finishDate) {
			return {
				label: 'ไม่มีวันเสร็จ',
				tone: 'neutral' as BadgeTone,
			};
		}

		const delayedDays = getDelayDays(targetDate, finishDate);
		if (delayedDays > 0) {
			return {
				label: `ล่าช้า ${delayedDays} วัน`,
				tone: 'danger' as BadgeTone,
			};
		}

		return {
			label: 'ตรงเวลา',
			tone: 'success' as BadgeTone,
		};
	}

	const delayedDays = getDelayDays(targetDate, new Date());
	if (delayedDays > 0) {
		return {
			label: `ล่าช้า ${delayedDays} วัน`,
			tone: 'danger' as BadgeTone,
		};
	}

	return {
		label: 'ตรงเวลา',
		tone: 'success' as BadgeTone,
	};
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
	filteredJobOrders.forEach((job) => {
		const targetDate = toDateValue(job.target_date);
		if (!targetDate || targetDate.getFullYear() !== currentYear || targetDate.getMonth() !== currentMonth) {
			return;
		}

		const key = toDateKey(targetDate);
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
