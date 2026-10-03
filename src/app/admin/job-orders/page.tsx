'use client';

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import CancellationDialog from '@/components/CancellationDialog';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import JobOrderModel from '@/models/job-order';
import InsertJobOrderForm from './components/insert';
import UpdateJobOrderForm from './components/update';
import JobOrderDetailModal from './components/detail';
import { CreateJobOrderDto, JobOrder } from '@/types/job-order';
import { formatThaiDate, formatThaiDateLong, toDateValue, toLocalIsoDate } from '@/lib/date-format';

const jobOrderModel = new JobOrderModel();

type BoardStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type ViewMode = 'board' | 'calendar';

interface CalendarCell {
	date: Date;
	dateKey: string;
	inCurrentMonth: boolean;
	jobs: JobOrder[];
}

interface BoardColumn {
	key: BoardStatus;
	label: string;
	headerClass: string;
	titleClass: string;
	countClass: string;
	accentClass: string;
}

interface StatusStyle {
	label: string;
	chipClass: string;
	dotClass: string;
}

const BOARD_COLUMNS: BoardColumn[] = [
	{
		key: 'pending',
		label: 'รอดำเนินการ',
		headerClass: 'bg-[var(--warning-soft)] border-b border-[var(--border)]',
		titleClass: 'text-[var(--warning)]',
		countClass: 'bg-[var(--bg-surface)] text-[var(--warning)]',
		accentClass: 'border-[var(--warning-soft)]',
	},
	{
		key: 'in_progress',
		label: 'กำลังผลิต',
		headerClass: 'bg-[var(--info-soft)] border-b border-[var(--border)]',
		titleClass: 'text-[var(--info)]',
		countClass: 'bg-[var(--bg-surface)] text-[var(--info)]',
		accentClass: 'border-[var(--info-soft)]',
	},
	{
		key: 'completed',
		label: 'ผลิตเสร็จแล้ว',
		headerClass: 'bg-[var(--success-soft)] border-b border-[var(--border)]',
		titleClass: 'text-[var(--success)]',
		countClass: 'bg-[var(--bg-surface)] text-[var(--success)]',
		accentClass: 'border-[var(--success-soft)]',
	},
	{
		key: 'cancelled',
		label: 'ยกเลิกการผลิต',
		headerClass: 'bg-[var(--danger-soft)] border-b border-[var(--border)]',
		titleClass: 'text-[var(--danger)]',
		countClass: 'bg-[var(--bg-surface)] text-[var(--danger)]',
		accentClass: 'border-[var(--danger-soft)]',
	},
];

const STATUS_STYLES: Record<BoardStatus, StatusStyle> = {
	pending: {
		label: 'รอดำเนินการ',
		chipClass: 'bg-[var(--warning-soft)] text-[var(--warning)]',
		dotClass: 'bg-[var(--warning)]',
	},
	in_progress: {
		label: 'กำลังผลิต',
		chipClass: 'bg-[var(--info-soft)] text-[var(--info)]',
		dotClass: 'bg-[var(--info)]',
	},
	completed: {
		label: 'ผลิตเสร็จแล้ว',
		chipClass: 'bg-[var(--success-soft)] text-[var(--success)]',
		dotClass: 'bg-[var(--success)]',
	},
	cancelled: {
		label: 'ยกเลิกการผลิต',
		chipClass: 'bg-[var(--danger-soft)] text-[var(--danger)]',
		dotClass: 'bg-[var(--danger)]',
	},
};

const WEEKDAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// Same transitions the API enforces; completed and cancelled are final.
const ALLOWED_TRANSITIONS: Record<BoardStatus, BoardStatus[]> = {
	pending: ['in_progress', 'cancelled'],
	in_progress: ['completed', 'cancelled'],
	completed: [],
	cancelled: [],
};

const PAGE_SIZE = 8;
const DEFAULT_VISIBLE: Record<BoardStatus, number> = {
	pending: PAGE_SIZE,
	in_progress: PAGE_SIZE,
	completed: PAGE_SIZE,
	cancelled: PAGE_SIZE,
};

const toIsoDate = toLocalIsoDate;

const parseCalendarMonth = (calendarMonth: string) => {
	const [yearText, monthText] = calendarMonth.split('-');
	const year = Number(yearText);
	const month = Number(monthText);

	if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1);
	}

	return new Date(year, month - 1, 1);
};

const normalizeStatus = (status?: string): BoardStatus => {
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

const getAssigneeName = (job: JobOrder): string => {
	return (
		job.employee?.employee_fullname ||
		`${job.employee?.employee_firstname || ''} ${job.employee?.employee_lastname || ''}`.trim() ||
		job.employee_id ||
		'-'
	);
};

const mapStatusToLabel = (status: BoardStatus) => {
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

const getUserFromCookie = () => {
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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const toDateKey = toLocalIsoDate;

const getDelayDays = (targetDate: Date, compareDate: Date) => {
	const target = startOfDay(targetDate);
	const compare = startOfDay(compareDate);
	return Math.floor((compare.getTime() - target.getTime()) / DAY_IN_MS);
};

const getFinishDate = (job: JobOrder): Date | null => {
	return (
		toDateValue(job.finish_date) ||
		toDateValue(job.completed_date) ||
		toDateValue(job.completed_at) ||
		toDateValue(job.finish_at)
	);
};

const getDelayBadge = (job: JobOrder) => {
	const status = normalizeStatus(job.job_order_status);
	if (status === 'cancelled') {
		return null;
	}

	const targetDate = toDateValue(job.target_date);
	if (!targetDate) {
		return {
			label: 'ไม่พบ Target Date',
			className: 'bg-[var(--neutral-soft)] text-[var(--neutral)]',
		};
	}

	if (status === 'completed') {
		const finishDate = getFinishDate(job);
		if (!finishDate) {
			return {
				label: 'ไม่พบ Finish Date',
				className: 'bg-[var(--neutral-soft)] text-[var(--neutral)]',
			};
		}

		const delayedDays = getDelayDays(targetDate, finishDate);
		if (delayedDays > 0) {
			return {
				label: `ล่าช้า ${delayedDays} วัน`,
				className: 'bg-[var(--danger-soft)] text-[var(--danger)]',
			};
		}

		return {
			label: 'ไม่ล่าช้า',
			className: 'bg-[var(--success-soft)] text-[var(--success)]',
		};
	}

	const delayedDays = getDelayDays(targetDate, new Date());
	if (delayedDays > 0) {
		return {
			label: `ล่าช้า ${delayedDays} วัน`,
			className: 'bg-[var(--danger-soft)] text-[var(--danger)]',
		};
	}

	return {
		label: 'ไม่ล่าช้า',
		className: 'bg-[var(--success-soft)] text-[var(--success)]',
	};
};

interface JobCardActions {
	onView: (job: JobOrder) => void;
	onCopy: (job: JobOrder) => void;
	onEdit: (job: JobOrder) => void;
	onDelete: (job: JobOrder) => void;
	onDragStart: (jobId: string) => void;
	onDragEnd: () => void;
}

// Memoised so a keystroke in the search box, or a drag entering a column, does not rebuild every card.
const JobCard = memo(function JobCard({
	job,
	canEdit,
	canDelete,
	isDragging,
	actions,
}: {
	job: JobOrder;
	canEdit: boolean;
	canDelete: boolean;
	isDragging: boolean;
	actions: JobCardActions;
}) {
	const assignee = getAssigneeName(job);
	const jobStatus = normalizeStatus(job.job_order_status);
	const canMove = ALLOWED_TRANSITIONS[jobStatus].length > 0;
	const isClosed = jobStatus === 'completed' || jobStatus === 'cancelled';
	const delayBadge = getDelayBadge(job);

	return (
		<article
			draggable={canMove}
			onDragStart={(event) => {
				if (!canMove) {
					event.preventDefault();
					return;
				}
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/plain', job.job_order_id);
				actions.onDragStart(job.job_order_id);
			}}
			onDragEnd={actions.onDragEnd}
			className={`rounded-lg border border-[var(--border)]/90 bg-[var(--bg-surface)] p-2 shadow-sm transition-all ${
				!canMove ? 'cursor-not-allowed opacity-95' : 'hover:shadow-md cursor-grab active:cursor-grabbing'
			} ${isDragging ? 'opacity-60' : ''}`}
		>
			<div className="flex items-start gap-1.5">
				<h3 className="flex-1 text-[13px] font-semibold text-[var(--ink)] line-clamp-1 leading-tight">{job.job_order_name}</h3>
				<span className="shrink-0 text-[13px] px-1.5 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--ink-muted)] leading-none">
					{job.job_order_type}
				</span>
			</div>
			<p className="mt-0.5 truncate text-[12px] tabular-nums text-[var(--ink-muted)]">{job.job_order_code}</p>

			<div className="mt-1 text-[13px] text-[var(--ink-muted)] space-y-0.5">
				<p className="truncate font-medium text-[var(--ink)]">{assignee}</p>
				<div className="flex items-center gap-2">
					<span>{formatThaiDate(job.target_date)}</span>
					<span className="text-[var(--ink-subtle)]">·</span>
					<span>ผลิต {job.job_order_qty ?? 0}</span>
				</div>
				{delayBadge && (
					<div className="pt-0.5">
						<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold ${delayBadge.className}`}>
							{delayBadge.label}
						</span>
					</div>
				)}
			</div>

			<div className="mt-1.5 pt-1 border-t border-[var(--border)] flex items-center justify-end gap-1">
				<button
					type="button"
					onClick={() => actions.onView(job)}
					className="ka-btn ka-btn--ghost ka-btn--sm ka-btn--icon hover:text-[var(--brand-ink)]"
					title="ดูรายละเอียด"
				>
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S3.732 16.057 2.458 12Z" />
					</svg>
				</button>
				<button
					type="button"
					onClick={() => actions.onCopy(job)}
					className="ka-btn ka-btn--ghost ka-btn--sm ka-btn--icon hover:text-[var(--info)]"
					title="Copy เป็นงานใหม่"
				>
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2m-4 4H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z" />
					</svg>
				</button>
				{canEdit && !isClosed && (
					<button
						type="button"
						onClick={() => actions.onEdit(job)}
						className="ka-btn ka-btn--ghost ka-btn--sm ka-btn--icon hover:text-[var(--warning)]"
						title="แก้ไขงานผลิต"
					>
						<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
					</button>
				)}
				{canDelete && jobStatus !== 'completed' && (
					<button
						type="button"
						onClick={() => actions.onDelete(job)}
						className="ka-btn ka-btn--ghost ka-btn--sm ka-btn--icon hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
						title="ลบงานผลิต"
					>
						<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12m-9 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0h8m-9 4v6m4-6v6m4-6v6M5 7h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z" />
						</svg>
					</button>
				)}
			</div>
		</article>
	);
});

export default function JobOrdersPage() {
	const { can } = usePermissions();
	// The job order API checks job_orders only, so other menus' rights would only show buttons that fail.
	const canAdd = can('job_orders', 'add');
	const canEdit = can('job_orders', 'edit');
	const canDelete = can('job_orders', 'delete');

	const user = useMemo(() => getUserFromCookie(), []);

	const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [hasLoaded, setHasLoaded] = useState(false);
	const requestIdRef = useRef(0);
	const [isInsertOpen, setIsInsertOpen] = useState(false);
	const [isUpdateOpen, setIsUpdateOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(null);
	const [copySeed, setCopySeed] = useState<Partial<CreateJobOrderDto> | null>(null);
	const [searchText, setSearchText] = useState('');
	const [selectedAssignee, setSelectedAssignee] = useState('all');
	const [selectedType, setSelectedType] = useState<'all' | 'website' | 'purchase'>('all');
	const [viewMode, setViewMode] = useState<ViewMode>('board');
	const [calendarMonth, setCalendarMonth] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	});
	const [dateStart, setDateStart] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
	});
	const [dateEnd, setDateEnd] = useState(() => {
		const now = new Date();
		const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
	});
	const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');
	const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
	const [dragOverColumn, setDragOverColumn] = useState<BoardStatus | null>(null);
	// Typing stays immediate; the board catches up at lower priority.
	const deferredSearchText = useDeferredValue(searchText);
	// "Load more" counts belong to one filter set and fall back to the default when the filters change.
	const filterKey = [deferredSearchText, selectedAssignee, selectedType, sortDirection, dateStart, dateEnd].join('|');
	const [visibleByFilter, setVisibleByFilter] = useState({ key: filterKey, counts: DEFAULT_VISIBLE });
	const columnVisible = visibleByFilter.key === filterKey ? visibleByFilter.counts : DEFAULT_VISIBLE;
	const [pendingCompleteJob, setPendingCompleteJob] = useState<JobOrder | null>(null);
	const [completionQty, setCompletionQty] = useState('');
	const [completionDefectQty, setCompletionDefectQty] = useState('');
	const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);
	const [pendingCancelJob, setPendingCancelJob] = useState<JobOrder | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [jobOrderToDelete, setJobOrderToDelete] = useState<JobOrder | null>(null);
	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		message: '',
	});
	const startDateInputRef = useRef<HTMLInputElement | null>(null);
	const endDateInputRef = useRef<HTMLInputElement | null>(null);

	const openNativeDatePicker = (input: HTMLInputElement | null) => {
		if (!input) {
			return;
		}

		input.focus();
		const maybeShowPicker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;
		if (typeof maybeShowPicker === 'function') {
			maybeShowPicker.call(input);
		}
	};

	const assigneeOptions = useMemo(() => {
		const map = new Map<string, string>();
		jobOrders.forEach((job) => {
			const key = job.employee_id || getAssigneeName(job);
			if (!key) {
				return;
			}
			map.set(key, getAssigneeName(job));
		});
		return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
	}, [jobOrders]);

	// Searchable text per job, built once per fetch instead of on every keystroke.
	// Fields are joined with a newline, which a search box cannot contain, so a match never spans two fields.
	const searchTextByJob = useMemo(() => {
		return new Map(
			jobOrders.map((job) => [
				job.job_order_id,
				[
					job.job_order_code || '',
					job.job_order_name || '',
					getAssigneeName(job),
					String(job.target_date || ''),
					formatThaiDate(job.target_date),
					mapStatusToLabel(normalizeStatus(job.job_order_status)),
					String(job.job_order_qty ?? ''),
				]
					.join('\n')
					.toLowerCase(),
			]),
		);
	}, [jobOrders]);

	const filteredJobOrders = useMemo(() => {
		const q = deferredSearchText.trim().toLowerCase();

		return jobOrders.filter((job) => {
			const matchesSearch = !q || (searchTextByJob.get(job.job_order_id) ?? '').includes(q);
			const matchesPerson = selectedAssignee === 'all' || selectedAssignee === (job.employee_id || getAssigneeName(job));
			const matchesType = selectedType === 'all' || selectedType === job.job_order_type;

			return matchesSearch && matchesPerson && matchesType;
		});
	}, [jobOrders, searchTextByJob, deferredSearchText, selectedAssignee, selectedType]);

	const grouped = useMemo(() => {
		return BOARD_COLUMNS.reduce((acc, column) => {
			acc[column.key] = filteredJobOrders.filter((job) => normalizeStatus(job.job_order_status) === column.key);
			return acc;
		}, {} as Record<BoardStatus, JobOrder[]>);
	}, [filteredJobOrders]);

	const calendarDate = useMemo(() => parseCalendarMonth(calendarMonth), [calendarMonth]);

	const calendarTitle = useMemo(() => {
		return calendarDate.toLocaleDateString('th-TH', {
			month: 'long',
			year: 'numeric',
		});
	}, [calendarDate]);

	const calendarCells = useMemo<CalendarCell[]>(() => {
		if (viewMode !== 'calendar') {
			return [];
		}

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
	}, [viewMode, calendarDate, filteredJobOrders]);

	// The board shows the chosen target-date range; the calendar shows its month. Whichever view is open
	// decides what is loaded, so switching back to the board reloads the board's range.
	const activeRange = useMemo(() => {
		if (viewMode === 'calendar') {
			const monthStart = parseCalendarMonth(calendarMonth);
			const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
			return { start: toIsoDate(monthStart), end: toIsoDate(monthEnd) };
		}
		return { start: dateStart, end: dateEnd };
	}, [viewMode, calendarMonth, dateStart, dateEnd]);

	const fetchJobOrders = useCallback(async () => {
		// Only the latest request may update the board, so a slow earlier response cannot overwrite a newer range.
		const requestId = ++requestIdRef.current;
		setIsLoading(true);
		try {
			const response = await jobOrderModel.getJobOrders(1, 300, sortDirection, undefined, undefined, activeRange.start || undefined, activeRange.end || undefined);
			if (requestId !== requestIdRef.current) {
				return;
			}
			setJobOrders(response.data || []);
			setHasLoaded(true);
		} catch (error) {
			if (requestId !== requestIdRef.current) {
				return;
			}
			console.error('Failed to fetch job orders:', error);
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถดึงข้อมูลงานผลิตได้',
			});
		} finally {
			if (requestId === requestIdRef.current) {
				setIsLoading(false);
			}
		}
	}, [activeRange, sortDirection]);

	useEffect(() => {
		void fetchJobOrders();
	}, [fetchJobOrders]);

	const updateJobStatus = async (jobId: string, targetStatus: BoardStatus, qty?: number, defectQty?: number, reason?: string): Promise<boolean> => {
		const targetLabel = mapStatusToLabel(targetStatus);
		const previous = [...jobOrders];
		setJobOrders((prev) =>
			prev.map((job) =>
				job.job_order_id === jobId
					? {
							...job,
							job_order_status: targetStatus,
							...(typeof qty === 'number' ? { job_order_qty: qty } : {}),
							...(typeof defectQty === 'number' ? { job_order_defect_qty: defectQty } : {}),
							...(targetStatus === 'completed' ? { finish_date: new Date().toISOString() } : {}),
						}
					: job,
			),
		);

		try {
			await jobOrderModel.updateJobOrderStatus(jobId, targetStatus, user?.employee_id, qty, defectQty, reason);
			setResultDialog({
				isOpen: true,
				status: 'success',
				message: `ย้ายสถานะงานเป็น ${targetLabel} สำเร็จ`,
			});
			return true;
		} catch (error) {
			setJobOrders(previous);
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถอัปเดตสถานะงานได้',
			});
			return false;
		}
	};

	const closeDetailModal = () => {
		setIsDetailOpen(false);
		setSelectedJobOrder(null);
		setPendingCompleteJob(null);
		setCompletionQty('');
		setCompletionDefectQty('');
	};

	const handleConfirmComplete = async () => {
		if (!pendingCompleteJob) {
			return;
		}

		// Quantities are stored as whole numbers.
		const qty = Number(completionQty);
		if (!Number.isInteger(qty) || qty <= 0) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: 'กรุณาระบุจำนวนที่ผลิตจริงเป็นจำนวนเต็มที่มากกว่า 0 ก่อนยืนยันปิดงาน',
			});
			return;
		}

		const defectQty = completionDefectQty.trim() === '' ? 0 : Number(completionDefectQty);
		if (!Number.isInteger(defectQty) || defectQty < 0) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: 'กรุณาระบุจำนวนสินค้าเสียหายเป็นจำนวนเต็ม 0 ขึ้นไป',
			});
			return;
		}

		if (defectQty > qty) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: 'จำนวนสินค้าเสียหายต้องไม่มากกว่าจำนวนที่ผลิตจริง',
			});
			return;
		}

		setIsConfirmingComplete(true);
		try {
			const succeeded = await updateJobStatus(pendingCompleteJob.job_order_id, 'completed', qty, defectQty);
			// Keep the dialog and the entered quantities when the server refuses, so they can be corrected.
			if (succeeded) {
				closeDetailModal();
			}
		} finally {
			setIsConfirmingComplete(false);
		}
	};

	const handleDrop = async (column: BoardStatus) => {
		if (!draggingJobId) {
			return;
		}

		const current = jobOrders.find((item) => item.job_order_id === draggingJobId);
		if (!current) {
			setDraggingJobId(null);
			setDragOverColumn(null);
			return;
		}

		const currentStatus = normalizeStatus(current.job_order_status);
		if (!ALLOWED_TRANSITIONS[currentStatus].includes(column)) {
			setDraggingJobId(null);
			setDragOverColumn(null);
			return;
		}

		if (currentStatus !== column) {
			if (column === 'completed') {
				setSelectedJobOrder(current);
				setPendingCompleteJob(current);
				setCompletionQty(current.job_order_qty && current.job_order_qty > 0 ? String(current.job_order_qty) : '');
					setCompletionDefectQty(
						typeof current.job_order_defect_qty === 'number' && current.job_order_defect_qty > 0 ? String(current.job_order_defect_qty) : '0',
					);
				setIsDetailOpen(true);
			} else if (column === 'cancelled') {
				setPendingCancelJob(current);
			} else {
				await updateJobStatus(draggingJobId, column);
			}
		}

		setDraggingJobId(null);
		setDragOverColumn(null);
	};

	// Only state setters are used here, so the functions stay the same between renders and memoised cards can skip.
	const handleCardCopy = useCallback((jobOrder: JobOrder) => {
		const materials = (jobOrder.jobOrderMaterials || jobOrder.job_order_materials || []).map((item) => ({
			material_id: item.material_id,
			material_qty: item.material_qty,
		}));

		setCopySeed({
			job_order_name: `${jobOrder.job_order_name} (copy)`,
			job_order_description: jobOrder.job_order_description || '',
			job_order_qty: jobOrder.job_order_qty,
			job_order_type: (jobOrder.job_order_type as CreateJobOrderDto['job_order_type']) || 'purchase',
			product_variant_id: jobOrder.product_variant_id || null,
			size_id: jobOrder.size_id || null,
			color_id: jobOrder.color_id || null,
			target_date: String(jobOrder.target_date || '').slice(0, 10),
			jobOrderMaterials: materials,
			job_order_status: 'pending',
		});
		setIsInsertOpen(true);
	}, []);

	const cardActions = useMemo<JobCardActions>(
		() => ({
			onView: (job) => {
				setSelectedJobOrder(job);
				setIsDetailOpen(true);
			},
			onCopy: handleCardCopy,
			onEdit: (job) => {
				setSelectedJobOrder(job);
				setIsUpdateOpen(true);
			},
			onDelete: (job) => {
				setJobOrderToDelete(job);
				setIsDeleteDialogOpen(true);
			},
			onDragStart: (jobId) => setDraggingJobId(jobId),
			onDragEnd: () => {
				setDraggingJobId(null);
				setDragOverColumn(null);
			},
		}),
		[handleCardCopy],
	);

	const handleDeleteJobOrder = async () => {
		if (!jobOrderToDelete) {
			return;
		}

		try {
			await jobOrderModel.deleteJobOrder(jobOrderToDelete.job_order_id);
			await fetchJobOrders();
			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'ลบงานผลิตสำเร็จ',
			});
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถลบงานผลิตได้',
			});
		} finally {
			setJobOrderToDelete(null);
		}
	};

	const totalCards = filteredJobOrders.length;
	const pendingCards = grouped.pending?.length || 0;
	const inProgressCards = grouped.in_progress?.length || 0;
	const doneCards = grouped.completed?.length || 0;
	const todayDateKey = toDateKey(new Date());

	const moveCalendarMonth = (direction: -1 | 1) => {
		setCalendarMonth((prev) => {
			const [yearText, monthText] = prev.split('-');
			const year = Number(yearText);
			const month = Number(monthText);
			const baseDate = !Number.isNaN(year) && !Number.isNaN(month) ? new Date(year, month - 1, 1) : new Date();
			baseDate.setMonth(baseDate.getMonth() + direction);
			return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;
		});
	};

	return (
		<div className="min-h-screen bg-[var(--bg-page)] p-3 sm:p-5 lg:p-7">
			<div className="max-w-[1700px] mx-auto space-y-4 sm:space-y-5">
				<section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
					<div className="ka-card px-4 py-3">
						<p className="text-[13px] text-[var(--brand-ink)] font-semibold uppercase tracking-wider">งานทั้งหมด</p>
						<p className="text-2xl font-black text-[var(--brand-ink)] mt-1">{totalCards}</p>
					</div>
					<div className="ka-card px-4 py-3">
						<p className="text-[13px] text-[var(--warning)] font-semibold uppercase tracking-wider">รอดำเนินการ</p>
						<p className="text-2xl font-black text-[var(--warning)] mt-1">{pendingCards}</p>
					</div>
					<div className="ka-card px-4 py-3">
						<p className="text-[13px] text-[var(--info)] font-semibold uppercase tracking-wider">กำลังผลิต</p>
						<p className="text-2xl font-black text-[var(--info)] mt-1">{inProgressCards}</p>
					</div>
					<div className="ka-card px-4 py-3">
						<p className="text-[13px] text-[var(--success)] font-semibold uppercase tracking-wider">ผลิตเสร็จแล้ว</p>
						<p className="text-2xl font-black text-[var(--success)] mt-1">{doneCards}</p>
					</div>
				</section>

				<section className="ka-card relative overflow-hidden" aria-busy={isLoading}>
					<p role="status" className="sr-only">{isLoading && hasLoaded ? 'กำลังโหลดงานผลิต' : ''}</p>
					<div className="border-b border-[var(--border)] p-3 sm:p-4 lg:p-5 flex flex-col gap-3">
						<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
							<div>
								<h1 className="text-xl sm:text-2xl font-black text-[var(--ink)]">Production Board</h1>
								<p className="text-sm text-[var(--ink-muted)] mt-1">
									{viewMode === 'board'
										? 'ลากการ์ดเพื่อเปลี่ยนสถานะงานผลิตให้ตรงกับกระบวนการจริง'
										: 'ดูงานผลิตเป็นรายเดือน พร้อมแยกสีตามสถานะงานในแต่ละวัน'}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<div className="inline-flex rounded-xl border border-[var(--border-control)] p-1 bg-[var(--bg-surface)]">
									<button
										type="button"
										onClick={() => setViewMode('board')}
										className={`min-h-11 md:min-h-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
											viewMode === 'board'
												? 'bg-[var(--action)] text-[var(--on-action)] shadow-sm'
												: 'text-[var(--ink-muted)] hover:text-[var(--brand-ink)]'
										}`}
									>
										โหมดงาน (Task)
									</button>
									<button
										type="button"
										onClick={() => setViewMode('calendar')}
										className={`min-h-11 md:min-h-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
											viewMode === 'calendar'
												? 'bg-[var(--action)] text-[var(--on-action)] shadow-sm'
												: 'text-[var(--ink-muted)] hover:text-[var(--brand-ink)]'
										}`}
									>
										โหมดปฏิทิน
									</button>
								</div>

								{canAdd && (
									<button
										type="button"
										onClick={() => {
											setCopySeed(null);
											setIsInsertOpen(true);
										}}
										className="ka-btn ka-btn--primary inline-flex items-center justify-center gap-2"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
										</svg>
										เพิ่มงานผลิต
									</button>
								)}
							</div>
						</div>

						<div className="space-y-3">
							<div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-subtle)]/70 p-2.5 sm:p-3">
								<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
									<div className="relative">
										<input
											type="text"
											value={searchText}
											onChange={(e) => setSearchText(e.target.value)}
											placeholder="Search"
											className="ka-input w-full pr-10"
										/>
										<svg className="w-4 h-4 text-[var(--ink-subtle)] absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
										</svg>
									</div>

									<select
										value={selectedAssignee}
										onChange={(e) => setSelectedAssignee(e.target.value)}
										className="ka-input w-full"
									>
										<option value="all">Person (ทั้งหมด)</option>
										{assigneeOptions.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>

									<select
										value={selectedType}
										onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
										className="ka-input w-full"
									>
										<option value="all">Filter (ทุกประเภท)</option>
										<option value="website">ผลิตเพื่อขายบน website</option>
										<option value="purchase">ผลิตจากการสั่งซื้อ</option>
									</select>

									<select
										value={sortDirection}
										onChange={(e) => setSortDirection(e.target.value as 'ASC' | 'DESC')}
										className="ka-input w-full"
									>
										<option value="ASC">Sort: Target Date (เก่าไปใหม่)</option>
										<option value="DESC">Sort: Target Date (ใหม่ไปเก่า)</option>
									</select>
								</div>
							</div>

							{viewMode !== 'calendar' && (
								<div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-subtle)]/70 p-2.5 sm:p-3">
									<div className="flex items-center justify-between mb-2 px-1">
										<p className="text-[13px] font-semibold tracking-wide text-[var(--ink-muted)] uppercase">ช่วงวันที่เป้าหมาย</p>
										<button
											type="button"
											onClick={() => {
												setDateStart('');
												setDateEnd('');
											}}
											className="inline-flex min-h-[44px] items-center px-2 text-[13px] font-medium text-[var(--brand-ink)] hover:underline md:min-h-0 md:px-0"
										>
											ล้างช่วงวันที่
										</button>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
										<button
											type="button"
											onClick={() => openNativeDatePicker(startDateInputRef.current)}
											className="group relative text-left rounded-xl border border-[var(--border-control)] bg-[var(--bg-surface)] px-3 py-2.5 hover:border-[var(--focus)] transition-colors cursor-pointer"
										>
											<input
												ref={startDateInputRef}
												type="date"
												lang="th-TH"
												value={dateStart}
												onChange={(e) => setDateStart(e.target.value)}
												className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
											/>
											<div className="flex items-center justify-between">
												<span className="text-[13px] font-semibold text-[var(--ink-muted)]">เริ่มวันที่</span>
												<svg className="w-4 h-4 text-[var(--ink-subtle)] group-hover:text-[var(--brand-ink)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
												</svg>
											</div>
											<p className="mt-1 text-sm font-semibold text-[var(--ink)]">{dateStart ? formatThaiDateLong(dateStart) : 'เลือกวันที่เริ่มต้น'}</p>
										</button>

										<button
											type="button"
											onClick={() => openNativeDatePicker(endDateInputRef.current)}
											className="group relative text-left rounded-xl border border-[var(--border-control)] bg-[var(--bg-surface)] px-3 py-2.5 hover:border-[var(--focus)] transition-colors cursor-pointer"
										>
											<input
												ref={endDateInputRef}
												type="date"
												lang="th-TH"
												value={dateEnd}
												onChange={(e) => setDateEnd(e.target.value)}
												min={dateStart || undefined}
												className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
											/>
											<div className="flex items-center justify-between">
												<span className="text-[13px] font-semibold text-[var(--ink-muted)]">สิ้นสุดวันที่</span>
												<svg className="w-4 h-4 text-[var(--ink-subtle)] group-hover:text-[var(--brand-ink)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
												</svg>
											</div>
											<p className="mt-1 text-sm font-semibold text-[var(--ink)]">{dateEnd ? formatThaiDateLong(dateEnd) : 'เลือกวันที่สิ้นสุด'}</p>
										</button>
									</div>
								</div>
							)}
						</div>
					</div>

					{isLoading && !hasLoaded ? (
						<div className="p-3 sm:p-4">
							<LoadingSkeletonProps />
						</div>
					) : (
						viewMode === 'board' ? (
							<div className={`p-3 sm:p-4 lg:p-5 overflow-x-auto transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
								<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 min-w-[940px] md:min-w-0 items-start">
									{BOARD_COLUMNS.map((column) => {
										const cards = grouped[column.key] || [];
										const visibleCount = columnVisible[column.key];
										const visibleCards = cards.slice(0, visibleCount);
										const hasMore = cards.length > visibleCount;
										const remaining = cards.length - visibleCount;
										const isDragOver = dragOverColumn === column.key;

										return (
											<section
												key={column.key}
												onDragOver={(event) => {
													event.preventDefault();
													setDragOverColumn(column.key);
												}}
												onDragLeave={(event) => {
													// dragleave also fires when the pointer moves onto a card inside the column; only clear on leaving the column.
													if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
														return;
													}
													setDragOverColumn(null);
												}}
												onDrop={(event) => {
													event.preventDefault();
													void handleDrop(column.key);
												}}
												className={`rounded-2xl border-2 transition-all ${column.accentClass} ${
													isDragOver ? 'ring-2 ring-[var(--focus)] shadow-lg scale-[1.01]' : ''
												} bg-[var(--bg-muted)]/70 flex flex-col h-[70vh] min-h-[430px]`}
											>
												<header className={`px-3 py-2 rounded-t-xl ${column.headerClass}`}>
													<div className="flex items-center justify-between">
														<h2 className={`font-bold text-sm ${column.titleClass}`}>{column.label}</h2>
														<span className={`text-[13px] font-bold px-2 py-0.5 rounded-full ${column.countClass}`}>{cards.length}</span>
													</div>
												</header>

												<div className="p-2 space-y-1.5 overflow-y-auto flex-1 min-h-0">
													{cards.length === 0 && (
														<div className="rounded-lg border border-dashed border-[var(--border-control)] p-3 text-[13px] text-[var(--ink-muted)] text-center bg-[var(--bg-surface)]">
															ไม่มีงานในสถานะนี้
														</div>
													)}

													{visibleCards.map((job) => (
														<JobCard
															key={job.job_order_id}
															job={job}
															canEdit={canEdit}
															canDelete={canDelete}
															isDragging={draggingJobId === job.job_order_id}
															actions={cardActions}
														/>
													))}
													{hasMore && (
														<button
															type="button"
															onClick={() =>
																setVisibleByFilter({
																	key: filterKey,
																	counts: { ...columnVisible, [column.key]: columnVisible[column.key] + PAGE_SIZE },
																})
															}
															className="ka-btn ka-btn--sm w-full border-dashed"
														>
															โหลดเพิ่ม ({remaining} งาน)
														</button>
													)}
												</div>
											</section>
										);
									})}
								</div>
							</div>
						) : (
							<div className={`p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-4 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
								<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]/80 p-3">
									<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => moveCalendarMonth(-1)}
												className="ka-btn ka-btn--icon"
												aria-label="เดือนก่อนหน้า"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 19-7-7 7-7" />
												</svg>
											</button>
											<div>
												<p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">เดือนที่แสดง</p>
												<h2 className="text-lg sm:text-xl font-black text-[var(--ink)]">{calendarTitle}</h2>
											</div>
											<button
												type="button"
												onClick={() => moveCalendarMonth(1)}
												className="ka-btn ka-btn--icon"
												aria-label="เดือนถัดไป"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
												</svg>
											</button>
										</div>

										<div className="flex items-center gap-2">
											<input
												type="month"
												value={calendarMonth}
												onChange={(event) => setCalendarMonth(event.target.value)}
												className="ka-input"
											/>
											<button
												type="button"
												onClick={() => {
													const now = new Date();
													setCalendarMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
												}}
												className="ka-btn"
											>
												เดือนปัจจุบัน
											</button>
										</div>
									</div>

									<div className="mt-3 flex flex-wrap items-center gap-2">
										{BOARD_COLUMNS.map((column) => {
											const style = STATUS_STYLES[column.key];
											return (
												<span key={column.key} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${style.chipClass}`}>
													<span className={`w-2 h-2 rounded-full ${style.dotClass}`} />
													{style.label}
												</span>
											);
										})}
									</div>
								</div>

								<div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
									<div className="min-w-[860px]">
										<div className="grid grid-cols-7 bg-[var(--bg-muted)] border-b border-[var(--border)]">
											{WEEKDAY_LABELS.map((dayLabel) => (
												<div key={dayLabel} className="px-2 py-2 text-center text-[13px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
													{dayLabel}
												</div>
											))}
										</div>

										<div className="grid grid-cols-7">
											{calendarCells.map((cell) => {
												const isToday = cell.dateKey === todayDateKey;
												return (
													<div
														key={cell.dateKey}
														className={`min-h-[150px] border-b border-r border-[var(--border)] p-2 ${
															cell.inCurrentMonth ? 'bg-[var(--bg-surface)] ' : 'bg-[var(--bg-subtle)] '
														}`}
													>
														<div className="flex items-center justify-between mb-1.5">
															<span
																className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold ${
																	isToday
																		? 'bg-[var(--action)] text-[var(--on-action)]'
																		: cell.inCurrentMonth
																		? 'text-[var(--ink)] '
																		: 'text-[var(--ink-subtle)] '
																}`}
															>
																{cell.date.getDate()}
															</span>
															<span className="text-[13px] text-[var(--ink-subtle)]">{cell.jobs.length} งาน</span>
														</div>

														<div className="space-y-1">
															{cell.jobs.slice(0, 3).map((job) => {
																const status = normalizeStatus(job.job_order_status);
																const style = STATUS_STYLES[status];
																return (
																	<button
																		key={job.job_order_id}
																		type="button"
																		onClick={() => {
																			setSelectedJobOrder(job);
																			setIsDetailOpen(true);
																		}}
																		className={`w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-left truncate transition-colors hover:brightness-95 ${style.chipClass}`}
																		title={`${job.job_order_code} ${job.job_order_name} (${style.label})`}
																	>
																		<span className={`w-2 h-2 rounded-full shrink-0 ${style.dotClass}`} />
																		<span className="truncate">{job.job_order_name}</span>
																	</button>
																);
															})}
															{cell.jobs.length > 3 && (
																<p className="px-1 text-[13px] font-medium text-[var(--ink-muted)]">+{cell.jobs.length - 3} งานเพิ่มเติม</p>
															)}
														</div>
													</div>
												);
											})}
										</div>
									</div>
								</div>
							</div>
						)
					)}
				</section>
			</div>

			<InsertJobOrderForm
				isOpen={isInsertOpen}
				onClose={() => {
					setIsInsertOpen(false);
					setCopySeed(null);
				}}
				onSuccess={() => {
					void fetchJobOrders();
					setCopySeed(null);
				}}
				initialData={copySeed}
			/>

			<UpdateJobOrderForm
				isOpen={isUpdateOpen}
				onClose={() => {
					setIsUpdateOpen(false);
					setSelectedJobOrder(null);
				}}
				onSuccess={() => {
					void fetchJobOrders();
					setSelectedJobOrder(null);
				}}
				jobOrder={selectedJobOrder}
			/>

			<JobOrderDetailModal
				isOpen={isDetailOpen}
				onClose={closeDetailModal}
				jobOrder={selectedJobOrder}
				mode={pendingCompleteJob ? 'complete_confirm' : 'view'}
				completionQty={completionQty}
				completionDefectQty={completionDefectQty}
				onCompletionQtyChange={setCompletionQty}
				onCompletionDefectQtyChange={setCompletionDefectQty}
				onConfirmComplete={handleConfirmComplete}
				isConfirming={isConfirmingComplete}
			/>

			{pendingCancelJob && <CancellationDialog title="ยืนยันการยกเลิกงานผลิต" onClose={() => setPendingCancelJob(null)} onConfirm={async reason => {
				await jobOrderModel.updateJobOrderStatus(pendingCancelJob.job_order_id, 'cancelled', undefined, undefined, undefined, reason);
				await fetchJobOrders();
			}} />}

			<ConfirmDialog
				isOpen={isDeleteDialogOpen}
				title="ยืนยันการลบงานผลิต"
				message={`คุณแน่ใจหรือไม่ว่าต้องการลบงานผลิต \"${jobOrderToDelete?.job_order_name || ''}\"? การกระทำนี้ไม่สามารถย้อนกลับได้.`}
				onCancel={() => {
					setIsDeleteDialogOpen(false);
					setJobOrderToDelete(null);
				}}
				onConfirm={() => {
					void handleDeleteJobOrder();
				}}
			/>

			<ActionResultDialog
				isOpen={resultDialog.isOpen}
				status={resultDialog.status}
				action="update"
				message={resultDialog.message}
				onClose={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
			/>
		</div>
	);
}
