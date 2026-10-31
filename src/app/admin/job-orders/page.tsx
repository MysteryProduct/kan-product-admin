'use client';

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import CancellationDialog from '@/components/CancellationDialog';
import FilterChip from '@/components/FilterChip';
import Popover from '@/components/Popover';
import RowMenu from '@/components/RowMenu';
import StatusBadge, { type BadgeTone } from '@/components/StatusBadge';
import { usePermissions } from '@/hooks/usePermissions';
import JobOrderModel from '@/models/job-order';
import CreateJobOrderDrawer from './components/create-drawer';
import UpdateJobOrderForm from './components/update';
import JobOrderDetailModal from './components/detail';
import { CreateJobOrderDto, JobOrder } from '@/types/job-order';
import { formatThaiDate, toDateValue, toLocalIsoDate } from '@/lib/date-format';

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

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
	short: string;
	tone: BadgeTone;
	/** The column's top border and the calendar dot. */
	color: string;
	empty: string;
}

const BOARD_COLUMNS: BoardColumn[] = [
	{ key: 'pending', label: 'รอดำเนินการ', short: 'รอ', tone: 'warning', color: 'var(--warning)', empty: 'ยังไม่มีงานรอ สร้างงานใหม่ หรือลากการ์ดมาวาง' },
	{ key: 'in_progress', label: 'กำลังผลิต', short: 'กำลังผลิต', tone: 'info', color: 'var(--info)', empty: 'ลากการ์ดมาที่นี่เมื่อเริ่มผลิต' },
	{ key: 'completed', label: 'ผลิตเสร็จแล้ว', short: 'เสร็จ', tone: 'success', color: 'var(--success)', empty: 'ยังไม่มีงานที่เสร็จในช่วงนี้' },
	{ key: 'cancelled', label: 'ยกเลิก', short: 'ยกเลิก', tone: 'neutral', color: 'var(--danger)', empty: 'ไม่มีงานที่ยกเลิก' },
];

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

interface JobCardActions {
	onView: (job: JobOrder) => void;
	onCopy: (job: JobOrder) => void;
	onEdit: (job: JobOrder) => void;
	onDelete: (job: JobOrder) => void;
	onMove: (job: JobOrder, status: BoardStatus) => void;
	onDragStart: (jobId: string) => void;
	onDragEnd: () => void;
}

const initial = (name: string) => (name.trim()[0] || '?').toUpperCase();
const TYPE_LABEL: Record<string, string> = { website: 'Website', purchase: 'สั่งซื้อ' };

// Memoised so a keystroke in the search box, or a drag entering a column, does not rebuild every card.
// The card opens the job; the row menu holds the commands, including "เปลี่ยนสถานะ" for touch screens.
const JobCard = memo(function JobCard({
	job,
	canAdd,
	canEdit,
	canDelete,
	isDragging,
	actions,
}: {
	job: JobOrder;
	/** A copy is a new job, so it needs the add permission, not edit. */
	canAdd: boolean;
	canEdit: boolean;
	canDelete: boolean;
	isDragging: boolean;
	actions: JobCardActions;
}) {
	const assignee = getAssigneeName(job);
	const jobStatus = normalizeStatus(job.job_order_status);
	const moves = ALLOWED_TRANSITIONS[jobStatus];
	const canMove = canEdit && moves.length > 0;
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
			className={`ka-kc ${canMove ? 'ka-kc--grab' : ''} ${isDragging ? 'ka-kc--dragging' : ''}`}
			aria-label={`${job.job_order_code} ${job.job_order_name}`}
		>
			<div className="ka-kc__top">
				<button type="button" className="ka-kc__title" onClick={() => actions.onView(job)}>
					{job.job_order_name}
				</button>
				<StatusBadge tone="neutral">{TYPE_LABEL[String(job.job_order_type)] ?? String(job.job_order_type)}</StatusBadge>
			</div>
			<p className="ka-todo__cap numeric m-0">{job.job_order_code}</p>
			<div className="ka-kc__meta">
				<span>
					<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 6h14v14H5zM5 10h14M9 4v4M15 4v4" /></svg>
					<span className="numeric">{formatThaiDate(job.target_date)}</span>
				</span>
				<span>
					<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /></svg>
					<span className="numeric">{count(job.job_order_qty ?? 0)} ชิ้น</span>
				</span>
			</div>
			<div className="ka-kc__foot">
				<span className="ka-kc__who">
					<span className="ka-kc__av" aria-hidden="true">{initial(assignee)}</span>
					{assignee}
				</span>
				{delayBadge && <StatusBadge tone={delayBadge.tone}>{delayBadge.label}</StatusBadge>}
				<RowMenu
					label={`จัดการ ${job.job_order_code}`}
					items={[
						{ label: 'ดูรายละเอียด', icon: 'view', onSelect: () => actions.onView(job) },
						...(canMove ? moves.filter((status) => status !== 'cancelled').map((status) => ({ label: `เปลี่ยนสถานะ → ${mapStatusToLabel(status)}`, icon: 'status' as const, onSelect: () => actions.onMove(job, status) })) : []),
						...(canAdd ? [{ label: 'ทำสำเนาเป็นงานใหม่', icon: 'copy' as const, onSelect: () => actions.onCopy(job) }] : []),
						...(canEdit && !isClosed ? [{ label: 'แก้ไขงาน', icon: 'edit' as const, onSelect: () => actions.onEdit(job) }] : []),
						// Destructive commands last, under the menu's divider.
						...(canMove && moves.includes('cancelled') ? [{ label: 'ยกเลิกงาน', icon: 'cancel' as const, tone: 'danger' as const, onSelect: () => actions.onMove(job, 'cancelled') }] : []),
						...(canDelete && jobStatus !== 'completed' ? [{ label: 'ลบงาน', icon: 'delete' as const, tone: 'danger' as const, onSelect: () => actions.onDelete(job) }] : []),
					]}
				/>
			</div>
		</article>
	);
});

export default function JobOrdersPage() {
	const { can } = usePermissions();
	const canView = can('job_orders', 'view');
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
	const [rangeOpen, setRangeOpen] = useState(false);
	const rangeChipRef = useRef<HTMLButtonElement | null>(null);
	const [selectedDay, setSelectedDay] = useState<string>(() => toLocalIsoDate(new Date()));

	// A sale-order link opens its exact job, including jobs outside the board's date filter.
	useEffect(() => {
		const jobId = new URLSearchParams(window.location.search).get('jobId');
		if (!canView || !jobId) return;
		let active = true;
		void jobOrderModel.getJobOrderById(jobId).then((job) => {
			if (!active) return;
			setSelectedJobOrder(job);
			setIsDetailOpen(true);
		}).catch((error: unknown) => {
			if (active) setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถเปิดงานผลิตได้',
			});
		});
		return () => { active = false; };
	}, [canView]);

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
			onMove: (job, status) => {
				if (status === 'completed') {
					setSelectedJobOrder(job);
					setPendingCompleteJob(job);
					setCompletionQty(job.job_order_qty && job.job_order_qty > 0 ? String(job.job_order_qty) : '');
					setCompletionDefectQty(typeof job.job_order_defect_qty === 'number' && job.job_order_defect_qty > 0 ? String(job.job_order_defect_qty) : '0');
					setIsDetailOpen(true);
				} else if (status === 'cancelled') {
					setPendingCancelJob(job);
				} else {
					void updateJobStatus(job.job_order_id, status);
				}
			},
			onDragStart: (jobId) => setDraggingJobId(jobId),
			onDragEnd: () => {
				setDraggingJobId(null);
				setDragOverColumn(null);
			},
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- updateJobStatus reads the latest jobs through state setters
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

	// The day panel only knows the month on screen, so moving the month also moves the selected day
	// to that month's first day; a day of another month would otherwise show "0 งาน" wrongly.
	const moveCalendarMonth = (direction: -1 | 1) => {
		const [yearText, monthText] = calendarMonth.split('-');
		const year = Number(yearText);
		const month = Number(monthText);
		const baseDate = !Number.isNaN(year) && !Number.isNaN(month) ? new Date(year, month - 1, 1) : new Date();
		baseDate.setMonth(baseDate.getMonth() + direction);
		const next = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;
		setCalendarMonth(next);
		setSelectedDay(next === todayDateKey.slice(0, 7) ? todayDateKey : `${next}-01`);
	};

	const overdueCards = filteredJobOrders.filter((job) => {
		const status = normalizeStatus(job.job_order_status);
		const target = toDateValue(job.target_date);
		return (status === 'pending' || status === 'in_progress') && target !== null && getDelayDays(target, new Date()) > 0;
	}).length;
	const lead = `${count(totalCards)} งานในช่วงนี้ · ${overdueCards > 0 ? `เลยกำหนด ${count(overdueCards)} งาน` : 'ไม่มีงานเลยกำหนด'}`;
	const rangeLabel = dateStart && dateEnd ? `${formatThaiDate(dateStart)} – ${formatThaiDate(dateEnd)}` : dateStart ? `ตั้งแต่ ${formatThaiDate(dateStart)}` : dateEnd ? `ถึง ${formatThaiDate(dateEnd)}` : 'ทุกวันเป้าหมาย';
	const selectedDayJobs = calendarCells.find((cell) => cell.dateKey === selectedDay)?.jobs ?? [];
	const selectedDayDate = selectedDay ? new Date(`${selectedDay}T00:00:00`) : null;
	const activeChipCount = (selectedAssignee !== 'all' ? 1 : 0) + (selectedType !== 'all' ? 1 : 0) + (searchText.trim() ? 1 : 0);

	const openCreate = (seed: Partial<CreateJobOrderDto> | null) => {
		setCopySeed(seed);
		setIsInsertOpen(true);
	};

	return (
		<div className="ka-page-body">
			<div className="ka-ph">
				<div>
					<h1 className="ka-ph__title">งานผลิต</h1>
					<p className="ka-ph__lead">{hasLoaded ? lead : 'กำลังโหลด…'}</p>
				</div>
				<div className="ka-jo__acts">
					<div className="ka-seg" role="group" aria-label="มุมมอง">
						<button type="button" aria-pressed={viewMode === 'board'} onClick={() => setViewMode('board')}>
							<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v12h-4z" /></svg>
							บอร์ด
						</button>
						<button type="button" aria-pressed={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}>
							<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v14H5zM5 10h14M9 4v4M15 4v4" /></svg>
							ปฏิทิน
						</button>
					</div>
					{canAdd && (
						<button type="button" onClick={() => openCreate(null)} className="ka-btn ka-btn--primary">
							<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
							สร้างงานผลิต
						</button>
					)}
				</div>
			</div>

			<div className="ka-fbar ka-fbar--page" aria-busy={isLoading}>
				<p role="status" className="sr-only">{isLoading && hasLoaded ? 'กำลังโหลดงานผลิต' : ''}</p>
				<div className="ka-input-wrap ka-fbar__search">
					<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
					<input type="search" className="ka-input" aria-label="ค้นหางานผลิต" placeholder="ชื่องานหรือเลข JO" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
				</div>
				{viewMode === 'board' && (
					<>
						<button ref={rangeChipRef} type="button" className="ka-chip" data-active={dateStart || dateEnd ? true : undefined} aria-haspopup="dialog" aria-expanded={rangeOpen} onClick={() => setRangeOpen((value) => !value)}>
							<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v14H5zM5 10h14M9 4v4M15 4v4" /></svg>
							{rangeLabel}
						</button>
						<Popover open={rangeOpen} onClose={() => setRangeOpen(false)} anchorRef={rangeChipRef} title="เลือกช่วงวันเป้าหมาย" width={320}
							footer={
								<>
									<button type="button" className="ka-btn ka-btn--ghost ka-btn--sm" onClick={() => { setDateStart(''); setDateEnd(''); }}>ล้าง</button>
									<button type="button" className="ka-btn ka-btn--primary ka-btn--sm" onClick={() => setRangeOpen(false)}>ใช้ช่วงนี้</button>
								</>
							}
						>
							<div className="grid gap-3 p-1">
								<div className="flex flex-wrap gap-2">
									{[
										{ label: 'วันนี้', days: 0 },
										{ label: '7 วัน', days: 6 },
										{ label: 'เดือนนี้', days: -1 },
									].map((preset) => (
										<button
											key={preset.label}
											type="button"
											className="ka-chip"
											onClick={() => {
												const now = new Date();
												if (preset.days === -1) {
													setDateStart(toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
													setDateEnd(toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
												} else {
													setDateStart(toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - preset.days)));
													setDateEnd(toIsoDate(now));
												}
											}}
										>
											{preset.label}
										</button>
									))}
								</div>
								<label className="ka-field"><span className="ka-label">ตั้งแต่</span><input type="date" className="ka-input" value={dateStart} onChange={(e) => setDateStart(e.target.value)} /></label>
								<label className="ka-field"><span className="ka-label">ถึง</span><input type="date" className="ka-input" value={dateEnd} min={dateStart || undefined} onChange={(e) => setDateEnd(e.target.value)} /></label>
							</div>
						</Popover>
					</>
				)}
				<FilterChip label="ผู้รับผิดชอบ" single options={assigneeOptions} selected={selectedAssignee === 'all' ? [] : [selectedAssignee]} onChange={(values) => setSelectedAssignee(values[0] ?? 'all')} />
				<FilterChip label="ประเภท" single options={[{ value: 'website', label: 'ขายบน Website' }, { value: 'purchase', label: 'ตามคำสั่งซื้อ' }]} selected={selectedType === 'all' ? [] : [selectedType]} onChange={(values) => setSelectedType((values[0] as typeof selectedType) ?? 'all')} />
				{activeChipCount > 0 && (
					<button type="button" className="ka-btn ka-btn--ghost" onClick={() => { setSearchText(''); setSelectedAssignee('all'); setSelectedType('all'); }}>ล้างตัวกรอง</button>
				)}
				<span className="ka-table-tools__spacer" />
				{viewMode === 'board' && (
					<button type="button" className="ka-chip" style={{ borderStyle: 'solid', borderRadius: 'var(--radius-control)' }} aria-label={`เรียงตามวันเป้าหมาย ${sortDirection === 'ASC' ? 'เก่าไปใหม่' : 'ใหม่ไปเก่า'}`} onClick={() => setSortDirection((value) => (value === 'ASC' ? 'DESC' : 'ASC'))}>
						<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M4 7h16M7 12h10M10 17h4" /></svg>
						วันเป้าหมาย {sortDirection === 'ASC' ? '↑' : '↓'}
					</button>
				)}
			</div>

			{isLoading && !hasLoaded ? (
				<div className="ka-board" aria-busy="true">
					{BOARD_COLUMNS.map((column) => (
						<section key={column.key} className="ka-col" style={{ ['--c' as string]: column.color }}>
							<div className="ka-col__head"><b>{column.label}</b></div>
							<span className="ka-skel" style={{ height: 96 }} />
							<span className="ka-skel" style={{ height: 96 }} />
						</section>
					))}
				</div>
			) : viewMode === 'board' ? (
				<>
					<div className={`ka-board ka-motion-state ${isLoading ? 'opacity-60' : ''}`} aria-label="บอร์ดงานผลิต">
						{BOARD_COLUMNS.map((column) => {
							const cards = grouped[column.key] || [];
							const visibleCount = columnVisible[column.key];
							const visibleCards = cards.slice(0, visibleCount);
							const remaining = cards.length - visibleCount;
							const isDragOver = dragOverColumn === column.key;
							return (
								<section
									key={column.key}
									aria-label={`${column.label} ${count(cards.length)} งาน`}
									onDragOver={(event) => {
										event.preventDefault();
										setDragOverColumn(column.key);
									}}
									onDragLeave={(event) => {
										// dragleave also fires when the pointer moves onto a card inside the column; only clear on leaving the column.
										if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
										setDragOverColumn(null);
									}}
									onDrop={(event) => {
										event.preventDefault();
										void handleDrop(column.key);
									}}
									className={`ka-col ${isDragOver ? 'ka-col--over' : ''}`}
									style={{ ['--c' as string]: column.color }}
								>
									<div className="ka-col__head">
										<b>{column.label}</b>
										<span className="ka-col__n numeric">{count(cards.length)}</span>
									</div>
									{cards.length === 0 && <div className="ka-col__empty">{column.empty}</div>}
									{visibleCards.map((job) => (
										<JobCard key={job.job_order_id} job={job} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} isDragging={draggingJobId === job.job_order_id} actions={cardActions} />
									))}
									{remaining > 0 && (
										<button type="button" className="ka-btn ka-btn--sm" onClick={() => setVisibleByFilter({ key: filterKey, counts: { ...columnVisible, [column.key]: columnVisible[column.key] + PAGE_SIZE } })}>
											โหลดเพิ่ม ({count(remaining)} งาน)
										</button>
									)}
									{column.key === 'pending' && canAdd && (
										<button type="button" className="ka-col__add" onClick={() => openCreate(null)}>
											<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
											เพิ่มงาน
										</button>
									)}
								</section>
							);
						})}
					</div>
					<p className="ka-panel__note">ลากการ์ดเพื่อเปลี่ยนสถานะ · บนมือถือ ปัดซ้ายขวาเพื่อดูคอลัมน์ หรือแตะ ⋯ บนการ์ดแล้วเลือก “เปลี่ยนสถานะ”</p>
				</>
			) : (
				<div className={`ka-cal ka-motion-state ${isLoading ? 'opacity-60' : ''}`}>
					<section className="ka-card ka-cal__grid" aria-label={`ปฏิทิน${calendarTitle}`}>
						<div className="ka-cal__head">
							<button type="button" className="ka-btn ka-btn--icon ka-btn--sm" aria-label="เดือนก่อน" onClick={() => moveCalendarMonth(-1)}>
								<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" /></svg>
							</button>
							<button type="button" className="ka-btn ka-btn--icon ka-btn--sm" aria-label="เดือนถัดไป" onClick={() => moveCalendarMonth(1)}>
								<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" /></svg>
							</button>
							<h2 className="ka-card__title">{calendarTitle}</h2>
							<button type="button" className="ka-btn ka-btn--sm" onClick={() => { const now = new Date(); setCalendarMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`); setSelectedDay(todayDateKey); }}>วันนี้</button>
							<ul className="ka-legend ka-cal__legend">
								{BOARD_COLUMNS.map((column) => (
									<li key={column.key} data-tone={column.tone}><span className="inline-flex items-center gap-1.5"><i aria-hidden="true" />{column.short}</span></li>
								))}
							</ul>
						</div>
						<div className="ka-cal__wk" aria-hidden="true">
							{WEEKDAY_LABELS.map((dayLabel) => <div key={dayLabel}>{dayLabel}</div>)}
						</div>
						<div className="ka-cal__cells">
							{calendarCells.map((cell) => {
								const isToday = cell.dateKey === todayDateKey;
								const isSelected = cell.dateKey === selectedDay;
								const label = `${cell.date.getDate()} ${cell.date.toLocaleDateString('th-TH', { month: 'long' })}${cell.jobs.length ? ` ${count(cell.jobs.length)} งาน` : ''}`;
								return (
									<button
										key={cell.dateKey}
										type="button"
										className="ka-cell"
										data-out={cell.inCurrentMonth ? undefined : true}
										data-today={isToday || undefined}
										aria-pressed={isSelected}
										aria-label={label}
										onClick={() => setSelectedDay(cell.dateKey)}
									>
										<span className="ka-cell__d numeric">{cell.date.getDate()}</span>
										{cell.jobs.slice(0, 3).map((job) => (
											<span key={job.job_order_id} className="ka-ev" data-tone={BOARD_COLUMNS.find((column) => column.key === normalizeStatus(job.job_order_status))?.tone}>{job.job_order_name}</span>
										))}
										{cell.jobs.length > 3 && <span className="ka-todo__cap">+{count(cell.jobs.length - 3)}</span>}
									</button>
								);
							})}
						</div>
					</section>
					<aside className="ka-card ka-cal__day" aria-labelledby="cal-day">
						<div className="flex items-start justify-between gap-2">
							<div>
								<p className="ka-todo__cap">{selectedDayDate ? selectedDayDate.toLocaleDateString('th-TH', { weekday: 'long' }) : 'เลือกวันในปฏิทิน'}</p>
								<h2 id="cal-day" className="ka-card__title">{selectedDayDate ? formatThaiDate(selectedDayDate) : '—'}</h2>
							</div>
							<StatusBadge tone="neutral">{count(selectedDayJobs.length)} งาน</StatusBadge>
						</div>
						{selectedDayJobs.length === 0 && <p className="ka-panel__note">ไม่มีงานเป้าหมายในวันนี้</p>}
						{selectedDayJobs.map((job) => {
							const column = BOARD_COLUMNS.find((item) => item.key === normalizeStatus(job.job_order_status));
							return (
								<button key={job.job_order_id} type="button" className="ka-daycard" onClick={() => { setSelectedJobOrder(job); setIsDetailOpen(true); }}>
									<span className="flex items-start justify-between gap-2">
										<b>{job.job_order_name}</b>
										{column && <StatusBadge tone={column.tone}>{column.short}</StatusBadge>}
									</span>
									<span className="ka-todo__cap numeric">{job.job_order_code} · {TYPE_LABEL[String(job.job_order_type)] ?? job.job_order_type} · {count(job.job_order_qty ?? 0)} ชิ้น</span>
									<span className="ka-kc__who"><span className="ka-kc__av" aria-hidden="true">{initial(getAssigneeName(job))}</span>{getAssigneeName(job)}</span>
								</button>
							);
						})}
						{canAdd && selectedDay && (
							<button type="button" className="ka-btn" onClick={() => openCreate({ target_date: selectedDay })}>
								<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
								เพิ่มงานในวันนี้
							</button>
						)}
					</aside>
				</div>
			)}

			{isInsertOpen && (
				<CreateJobOrderDrawer
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
			)}

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
				onCancelJob={selectedJobOrder && canEdit && ALLOWED_TRANSITIONS[normalizeStatus(selectedJobOrder.job_order_status)].includes('cancelled') ? () => setPendingCancelJob(selectedJobOrder) : undefined}
				onCopy={selectedJobOrder && canAdd ? () => { const job = selectedJobOrder; closeDetailModal(); handleCardCopy(job); } : undefined}
				onEdit={selectedJobOrder && canEdit && !['completed', 'cancelled'].includes(normalizeStatus(selectedJobOrder.job_order_status)) ? () => { const job = selectedJobOrder; closeDetailModal(); setSelectedJobOrder(job); setIsUpdateOpen(true); } : undefined}
			/>

			{pendingCancelJob && (
				<CancellationDialog
					title={`ยกเลิกงาน ${pendingCancelJob.job_order_code}?`}
					onClose={() => setPendingCancelJob(null)}
					onConfirm={async (reason) => {
						await jobOrderModel.updateJobOrderStatus(pendingCancelJob.job_order_id, 'cancelled', user?.employee_id, undefined, undefined, reason);
						closeDetailModal();
						await fetchJobOrders();
					}}
				/>
			)}

			<ConfirmDialog
				isOpen={isDeleteDialogOpen}
				title={`ลบงาน ${jobOrderToDelete?.job_order_code || ''}?`}
				message={`“${jobOrderToDelete?.job_order_name || ''}” จะถูกลบและย้อนกลับไม่ได้`}
				confirmLabel="ลบงานผลิต"
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
