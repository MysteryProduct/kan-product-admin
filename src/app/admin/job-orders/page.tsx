'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import JobOrderModel from '@/models/job-order';
import InsertJobOrderForm from './components/insert';
import UpdateJobOrderForm from './components/update';
import JobOrderDetailModal from './components/detail';
import { CreateJobOrderDto, JobOrder } from '@/types/job-order';
import { formatThaiDate, formatThaiDateLong, toDateValue } from '@/lib/date-format';

const jobOrderModel = new JobOrderModel();

type BoardStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface BoardColumn {
	key: BoardStatus;
	label: string;
	headerClass: string;
	titleClass: string;
	countClass: string;
	accentClass: string;
}

const BOARD_COLUMNS: BoardColumn[] = [
	{
		key: 'pending',
		label: 'รอดำเนินการ',
		headerClass: 'bg-blue-100 dark:bg-blue-900/40 border-b border-blue-300 dark:border-blue-700/60',
		titleClass: 'text-blue-900 dark:text-blue-100',
		countClass: 'bg-blue-200/80 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100',
		accentClass: 'border-blue-400/60 dark:border-blue-400/30',
	},
	{
		key: 'in_progress',
		label: 'กำลังผลิต',
		headerClass: 'bg-amber-100 dark:bg-amber-900/35 border-b border-amber-300 dark:border-amber-700/60',
		titleClass: 'text-amber-950 dark:text-amber-100',
		countClass: 'bg-amber-200/80 dark:bg-amber-800/60 text-amber-950 dark:text-amber-100',
		accentClass: 'border-amber-400/60 dark:border-amber-400/30',
	},
	{
		key: 'completed',
		label: 'ผลิตเสร็จแล้ว',
		headerClass: 'bg-emerald-100 dark:bg-emerald-900/35 border-b border-emerald-300 dark:border-emerald-700/60',
		titleClass: 'text-emerald-950 dark:text-emerald-100',
		countClass: 'bg-emerald-200/80 dark:bg-emerald-800/60 text-emerald-950 dark:text-emerald-100',
		accentClass: 'border-emerald-400/60 dark:border-emerald-400/30',
	},
	{
		key: 'cancelled',
		label: 'ยกเลิกการผลิต',
		headerClass: 'bg-rose-100 dark:bg-rose-900/35 border-b border-rose-300 dark:border-rose-700/60',
		titleClass: 'text-rose-950 dark:text-rose-100',
		countClass: 'bg-rose-200/80 dark:bg-rose-800/60 text-rose-950 dark:text-rose-100',
		accentClass: 'border-rose-400/60 dark:border-rose-400/30',
	},
];

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
			className: 'bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200',
		};
	}

	if (status === 'completed') {
		const finishDate = getFinishDate(job);
		if (!finishDate) {
			return {
				label: 'ไม่พบ Finish Date',
				className: 'bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200',
			};
		}

		const delayedDays = getDelayDays(targetDate, finishDate);
		if (delayedDays > 0) {
			return {
				label: `ล่าช้า ${delayedDays} วัน`,
				className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
			};
		}

		return {
			label: 'ไม่ล่าช้า',
			className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
		};
	}

	const delayedDays = getDelayDays(targetDate, new Date());
	if (delayedDays > 0) {
		return {
			label: `ล่าช้า ${delayedDays} วัน`,
			className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
		};
	}

	return {
		label: 'ไม่ล่าช้า',
		className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
	};
};

export default function JobOrdersPage() {
	const { can } = usePermissions();
	const canAdd = can('job_orders', 'add') || can('stock', 'add');
	const canEdit = can('job_orders', 'edit') || can('stock', 'edit');
	const canDelete = can('job_orders', 'delete') || can('stock', 'delete');

	const user = useMemo(() => getUserFromCookie(), []);

	const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isInsertOpen, setIsInsertOpen] = useState(false);
	const [isUpdateOpen, setIsUpdateOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(null);
	const [copySeed, setCopySeed] = useState<Partial<CreateJobOrderDto> | null>(null);
	const [searchText, setSearchText] = useState('');
	const [selectedAssignee, setSelectedAssignee] = useState('all');
	const [selectedType, setSelectedType] = useState<'all' | 'website' | 'purchase'>('all');
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
	const PAGE_SIZE = 8;
	const [columnVisible, setColumnVisible] = useState<Record<BoardStatus, number>>({
		pending: PAGE_SIZE,
		in_progress: PAGE_SIZE,
		completed: PAGE_SIZE,
		cancelled: PAGE_SIZE,
	});
	const [pendingCompleteJob, setPendingCompleteJob] = useState<JobOrder | null>(null);
	const [completionQty, setCompletionQty] = useState('');
	const [completionDefectQty, setCompletionDefectQty] = useState('');
	const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);
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

	const filteredJobOrders = useMemo(() => {
		const q = searchText.trim().toLowerCase();

		return jobOrders.filter((job) => {
			const name = (job.job_order_name || '').toLowerCase();
			const assignee = getAssigneeName(job).toLowerCase();
			const targetDate = String(job.target_date || '').toLowerCase();
			const targetDateThai = formatThaiDate(job.target_date).toLowerCase();
			const qty = String(job.job_order_qty ?? '').toLowerCase();
			const statusLabel = mapStatusToLabel(normalizeStatus(job.job_order_status)).toLowerCase();

			const matchesSearch =
				!q ||
				name.includes(q) ||
				assignee.includes(q) ||
				targetDate.includes(q) ||
				targetDateThai.includes(q) ||
				statusLabel.includes(q) ||
				qty.includes(q);
			const matchesPerson = selectedAssignee === 'all' || selectedAssignee === (job.employee_id || getAssigneeName(job));
			const matchesType = selectedType === 'all' || selectedType === job.job_order_type;

			return matchesSearch && matchesPerson && matchesType;
		});
	}, [jobOrders, searchText, selectedAssignee, selectedType]);

	const grouped = useMemo(() => {
		return BOARD_COLUMNS.reduce((acc, column) => {
			acc[column.key] = filteredJobOrders.filter((job) => normalizeStatus(job.job_order_status) === column.key);
			return acc;
		}, {} as Record<BoardStatus, JobOrder[]>);
	}, [filteredJobOrders]);

	useEffect(() => {
		setColumnVisible({ pending: PAGE_SIZE, in_progress: PAGE_SIZE, completed: PAGE_SIZE, cancelled: PAGE_SIZE });
	}, [searchText, selectedAssignee, selectedType, sortDirection, dateStart, dateEnd]);

	useEffect(() => {
		void fetchJobOrders(dateStart, dateEnd);
	}, [dateStart, dateEnd, sortDirection]);

	const fetchJobOrders = async (start?: string, end?: string) => {
		try {
			setIsLoading(true);
			const response = await jobOrderModel.getJobOrders(1, 300, sortDirection, undefined, undefined, start || undefined, end || undefined);
			setJobOrders(response.data || []);
		} catch (error) {
			console.error('Failed to fetch job orders:', error);
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถดึงข้อมูลงานผลิตได้',
			});
		} finally {
			setIsLoading(false);
		}
	};

	const updateJobStatus = async (jobId: string, targetStatus: BoardStatus, qty?: number, defectQty?: number) => {
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
						}
					: job,
			),
		);

		try {
			await jobOrderModel.updateJobOrderStatus(jobId, targetStatus, user?.employee_id, qty, defectQty);
			setResultDialog({
				isOpen: true,
				status: 'success',
				message: `ย้ายสถานะงานเป็น ${targetLabel} สำเร็จ`,
			});
		} catch (error) {
			setJobOrders(previous);
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถอัปเดตสถานะงานได้',
			});
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

		const qty = Number(completionQty);
		if (Number.isNaN(qty) || qty <= 0) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: 'กรุณาระบุจำนวนที่ผลิตจริงให้มากกว่า 0 ก่อนยืนยันปิดงาน',
			});
			return;
		}

		const defectQty = completionDefectQty.trim() === '' ? 0 : Number(completionDefectQty);
		if (Number.isNaN(defectQty) || defectQty < 0) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: 'กรุณาระบุจำนวนสินค้าเสียหายให้ถูกต้อง (0 ขึ้นไป)',
			});
			return;
		}

		setIsConfirmingComplete(true);
		try {
			pendingCompleteJob.finish_date = new Date().toISOString();
			await updateJobStatus(pendingCompleteJob.job_order_id, 'completed', qty, defectQty);

			closeDetailModal();
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
		if (currentStatus === 'completed') {
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
			} else {
				await updateJobStatus(draggingJobId, column);
			}
		}

		setDraggingJobId(null);
		setDragOverColumn(null);
	};

	const handleCardCopy = (jobOrder: JobOrder) => {
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
	};

	const handleDeleteJobOrder = async () => {
		if (!jobOrderToDelete) {
			return;
		}

		try {
			await jobOrderModel.deleteJobOrder(jobOrderToDelete.job_order_id);
			await fetchJobOrders(dateStart, dateEnd);
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

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.08),transparent_35%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.10),transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,116,144,0.16),transparent_35%)] p-3 sm:p-5 lg:p-7">
			<div className="max-w-[1700px] mx-auto space-y-4 sm:space-y-5">
				<section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
					<div className="rounded-2xl border border-blue-200/60 dark:border-blue-500/20 bg-white/90 dark:bg-slate-800/70 backdrop-blur px-4 py-3">
						<p className="text-xs text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider">งานทั้งหมด</p>
						<p className="text-2xl font-black text-blue-700 dark:text-blue-200 mt-1">{totalCards}</p>
					</div>
					<div className="rounded-2xl border border-sky-200/60 dark:border-sky-500/20 bg-white/90 dark:bg-slate-800/70 backdrop-blur px-4 py-3">
						<p className="text-xs text-sky-700 dark:text-sky-300 font-semibold uppercase tracking-wider">รอดำเนินการ</p>
						<p className="text-2xl font-black text-sky-700 dark:text-sky-200 mt-1">{pendingCards}</p>
					</div>
					<div className="rounded-2xl border border-amber-200/60 dark:border-amber-500/20 bg-white/90 dark:bg-slate-800/70 backdrop-blur px-4 py-3">
						<p className="text-xs text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wider">กำลังผลิต</p>
						<p className="text-2xl font-black text-amber-700 dark:text-amber-200 mt-1">{inProgressCards}</p>
					</div>
					<div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-500/20 bg-white/90 dark:bg-slate-800/70 backdrop-blur px-4 py-3">
						<p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">ผลิตเสร็จแล้ว</p>
						<p className="text-2xl font-black text-emerald-700 dark:text-emerald-200 mt-1">{doneCards}</p>
					</div>
				</section>

				<section className="rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 backdrop-blur overflow-hidden">
					<div className="border-b border-slate-200 dark:border-slate-700 p-3 sm:p-4 lg:p-5 flex flex-col gap-3">
						<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
							<div>
								<h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">Production Board</h1>
								<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ลากการ์ดเพื่อเปลี่ยนสถานะงานผลิตให้ตรงกับกระบวนการจริง</p>
							</div>
							{canAdd && (
								<button
									type="button"
									onClick={() => {
										setCopySeed(null);
										setIsInsertOpen(true);
									}}
									className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:from-blue-700 hover:to-cyan-600 transition-colors shadow-sm"
								>
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
									</svg>
									เพิ่มงานผลิต
								</button>
							)}
						</div>

						<div className="space-y-3">
							<div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/45 p-2.5 sm:p-3">
								<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
									<div className="relative">
										<input
											type="text"
											value={searchText}
											onChange={(e) => setSearchText(e.target.value)}
											placeholder="Search"
											className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
										/>
										<svg className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
										</svg>
									</div>

									<select
										value={selectedAssignee}
										onChange={(e) => setSelectedAssignee(e.target.value)}
										className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
										className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
									>
										<option value="all">Filter (ทุกประเภท)</option>
										<option value="website">ผลิตเพื่อขายบน website</option>
										<option value="purchase">ผลิตจากการสั่งซื้อ</option>
									</select>

									<select
										value={sortDirection}
										onChange={(e) => setSortDirection(e.target.value as 'ASC' | 'DESC')}
										className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
									>
										<option value="ASC">Sort: Target Date (เก่าไปใหม่)</option>
										<option value="DESC">Sort: Target Date (ใหม่ไปเก่า)</option>
									</select>
								</div>
							</div>

							<div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/45 p-2.5 sm:p-3">
								<div className="flex items-center justify-between mb-2 px-1">
									<p className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300 uppercase">ช่วงวันที่เป้าหมาย</p>
									<button
										type="button"
										onClick={() => {
											setDateStart('');
											setDateEnd('');
										}}
										className="text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
									>
										ล้างช่วงวันที่
									</button>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
									<button
										type="button"
										onClick={() => openNativeDatePicker(startDateInputRef.current)}
										className="group relative text-left rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 px-3 py-2.5 hover:border-cyan-400 dark:hover:border-cyan-400 transition-colors cursor-pointer"
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
											<span className="text-xs font-semibold text-slate-600 dark:text-slate-300">เริ่มวันที่</span>
											<svg className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
											</svg>
										</div>
										<p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{dateStart ? formatThaiDateLong(dateStart) : 'เลือกวันที่เริ่มต้น'}</p>
									</button>

									<button
										type="button"
										onClick={() => openNativeDatePicker(endDateInputRef.current)}
										className="group relative text-left rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 px-3 py-2.5 hover:border-cyan-400 dark:hover:border-cyan-400 transition-colors cursor-pointer"
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
											<span className="text-xs font-semibold text-slate-600 dark:text-slate-300">สิ้นสุดวันที่</span>
											<svg className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
											</svg>
										</div>
										<p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{dateEnd ? formatThaiDateLong(dateEnd) : 'เลือกวันที่สิ้นสุด'}</p>
									</button>
								</div>
							</div>
						</div>
					</div>

					{isLoading ? (
						<div className="p-3 sm:p-4">
							<LoadingSkeletonProps />
						</div>
					) : (
						<div className="p-3 sm:p-4 lg:p-5 overflow-x-auto">
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
											onDragLeave={() => setDragOverColumn(null)}
											onDrop={(event) => {
												event.preventDefault();
												void handleDrop(column.key);
											}}
											className={`rounded-2xl border-2 transition-all ${column.accentClass} ${
												isDragOver ? 'ring-2 ring-cyan-500/60 shadow-lg shadow-cyan-500/10 scale-[1.01]' : ''
											} bg-slate-100/70 dark:bg-slate-800/60 flex flex-col h-[70vh] min-h-[430px]`}
										>
											<header className={`px-3 py-2 rounded-t-xl ${column.headerClass}`}>
											<div className="flex items-center justify-between">
													<h2 className={`font-bold text-sm ${column.titleClass}`}>{column.label}</h2>
													<span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.countClass}`}>{cards.length}</span>
												</div>
											</header>

											<div className="p-2 space-y-1.5 overflow-y-auto flex-1 min-h-0">
												{cards.length === 0 && (
													<div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-3 text-xs text-slate-500 dark:text-slate-400 text-center bg-white/50 dark:bg-slate-800/40">
														ไม่มีงานในสถานะนี้
													</div>
												)}

												{visibleCards.map((job) => {
													const assignee = getAssigneeName(job);
													const isCompleted = normalizeStatus(job.job_order_status) === 'completed';
													const delayBadge = getDelayBadge(job);

													return (
														<article
															key={job.job_order_id}
															draggable={!isCompleted}
															onDragStart={(event) => {
																if (isCompleted) {
																	event.preventDefault();
																	return;
																}
																event.dataTransfer.effectAllowed = 'move';
																event.dataTransfer.setData('text/plain', job.job_order_id);
																setDraggingJobId(job.job_order_id);
															}}
															onDragEnd={() => {
																setDraggingJobId(null);
																setDragOverColumn(null);
															}}
														className={`rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm transition-all ${
																isCompleted ? 'cursor-not-allowed opacity-95' : 'hover:shadow-md cursor-grab active:cursor-grabbing'
															} ${
																draggingJobId === job.job_order_id ? 'opacity-60' : ''
															}`}
														>
															<div className="flex items-start gap-1.5">
																<h3 className="flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-1 leading-tight">{job.job_order_name}</h3>
																<span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 leading-none">
																	{job.job_order_type}
																</span>
															</div>

															<div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
																<p className="truncate font-medium text-slate-700 dark:text-slate-300">{assignee}</p>
																<div className="flex items-center gap-2">
																	<span>{formatThaiDate(job.target_date)}</span>
																	<span className="text-slate-300 dark:text-slate-600">·</span>
																	<span>ผลิต {job.job_order_qty ?? 0}</span>
																</div>
																{delayBadge && (
																	<div className="pt-0.5">
																		<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${delayBadge.className}`}>
																			{delayBadge.label}
																		</span>
																	</div>
																)}
															</div>

															<div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1">
																<button
																	type="button"
																	onClick={() => {
																		setSelectedJobOrder(job);
																		setIsDetailOpen(true);
																	}}
																	className="p-1 rounded-md text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors"
																	title="ดูรายละเอียด"
																>
																	<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S3.732 16.057 2.458 12Z" />
																	</svg>
																</button>
																<button
																	type="button"
																	onClick={() => handleCardCopy(job)}
																	className="p-1 rounded-md text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
																	title="Copy เป็นงานใหม่"
																>
																	<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2m-4 4H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z" />
																	</svg>
																</button>
                                                                {canEdit && job.job_order_status !== 'completed' && (
                                                                    <button
                                                                        type="button"                                                                        onClick={() => {
                                                                            setSelectedJobOrder(job);
                                                                            setIsUpdateOpen(true);
                                                                        }}
                                                                        className="p-1 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                                                                        title="แก้ไขงานผลิต"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828  2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                    </button>
                                                                )}
																{canDelete && job.job_order_status !== 'completed' && (
																	<button
																		type="button"
																		onClick={() => {
																			setJobOrderToDelete(job);
																			setIsDeleteDialogOpen(true);
																		}}
																		className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
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
												})}
												{hasMore && (
													<button
														type="button"
														onClick={() =>
															setColumnVisible((prev) => ({
																...prev,
																[column.key]: prev[column.key] + PAGE_SIZE,
															}))
														}
														className="w-full py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
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
					void fetchJobOrders(dateStart, dateEnd);
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
					void fetchJobOrders(dateStart, dateEnd);
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
