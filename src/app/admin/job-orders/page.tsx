'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ActionResultDialog from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import CancellationDialog from '@/components/CancellationDialog';
import { usePermissions } from '@/hooks/usePermissions';
import JobOrderModel from '@/models/job-order';
import CreateJobOrderDrawer from './components/create-drawer';
import UpdateJobOrderForm from './components/update';
import JobOrderDetailModal from './components/detail';
import { CreateJobOrderDto, JobOrder } from '@/types/job-order';
import { toDateValue, toLocalIsoDate } from '@/lib/date-format';
import { ALLOWED_TRANSITIONS, BOARD_COLUMNS, count, DEFAULT_VISIBLE, getDelayDays, getUserFromCookie, mapStatusToLabel, normalizeStatus, PAGE_SIZE, buildCalendarCells, parseCalendarMonth, toDateKey, toIsoDate, type BoardStatus, type CalendarCell, type ViewMode } from './board-model';
import BoardView from './components/board-view';
import FilterBar from './components/filter-bar';
import { useBoardFilters } from './use-board-filters';
import CalendarView from './components/calendar-view';
import type { JobCardActions } from './components/job-card';

const jobOrderModel = new JobOrderModel();

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

	const { assigneeOptions, filteredJobOrders, grouped } = useBoardFilters(jobOrders, deferredSearchText, selectedAssignee, selectedType);

	const calendarDate = useMemo(() => parseCalendarMonth(calendarMonth), [calendarMonth]);

	const calendarTitle = useMemo(() => {
		return calendarDate.toLocaleDateString('th-TH', {
			month: 'long',
			year: 'numeric',
		});
	}, [calendarDate]);

	const calendarCells = useMemo<CalendarCell[]>(
		() => (viewMode === 'calendar' ? buildCalendarCells(calendarDate, filteredJobOrders) : []),
		[viewMode, calendarDate, filteredJobOrders],
	);

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
	const selectedDayJobs = calendarCells.find((cell) => cell.dateKey === selectedDay)?.jobs ?? [];
	const selectedDayDate = selectedDay ? new Date(`${selectedDay}T00:00:00`) : null;

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

			<FilterBar
				isLoading={isLoading}
				hasLoaded={hasLoaded}
				viewMode={viewMode}
				searchText={searchText}
				setSearchText={setSearchText}
				dateStart={dateStart}
				dateEnd={dateEnd}
				setDateStart={setDateStart}
				setDateEnd={setDateEnd}
				assigneeOptions={assigneeOptions}
				selectedAssignee={selectedAssignee}
				setSelectedAssignee={setSelectedAssignee}
				selectedType={selectedType}
				setSelectedType={setSelectedType}
				sortDirection={sortDirection}
				setSortDirection={setSortDirection}
			/>

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
				<BoardView
					isLoading={isLoading}
					grouped={grouped}
					columnVisible={columnVisible}
					dragOverColumn={dragOverColumn}
					setDragOverColumn={setDragOverColumn}
					draggingJobId={draggingJobId}
					onDrop={(column) => void handleDrop(column)}
					onLoadMore={(column) => setVisibleByFilter({ key: filterKey, counts: { ...columnVisible, [column]: columnVisible[column] + PAGE_SIZE } })}
					onCreate={() => openCreate(null)}
					canAdd={canAdd}
					canEdit={canEdit}
					canDelete={canDelete}
					actions={cardActions}
				/>
			) : (
				<CalendarView
					isLoading={isLoading}
					calendarTitle={calendarTitle}
					calendarCells={calendarCells}
					todayDateKey={todayDateKey}
					selectedDay={selectedDay}
					selectedDayJobs={selectedDayJobs}
					selectedDayDate={selectedDayDate}
					onSelectDay={setSelectedDay}
					onMoveMonth={moveCalendarMonth}
					onToday={() => {
						const now = new Date();
						setCalendarMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
						setSelectedDay(todayDateKey);
					}}
					onOpenJob={(job) => {
						setSelectedJobOrder(job);
						setIsDetailOpen(true);
					}}
					onCreate={(targetDate) => openCreate({ target_date: targetDate })}
					canAdd={canAdd}
				/>
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
					presets={['ลูกค้ายกเลิกคำสั่งซื้อ', 'วัตถุดิบไม่พอ', 'สร้างงานซ้ำ']}
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
