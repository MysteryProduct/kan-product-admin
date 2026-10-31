'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ActionResultDialog from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import CancellationDialog from '@/components/CancellationDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/components/Toast';
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
import ViewSwitch from './components/view-switch';
import { useStatusMoves } from './use-status-moves';
import { useJobOrders } from './use-job-orders';

const jobOrderModel = new JobOrderModel();

export default function JobOrdersPage() {
	const { can } = usePermissions();
	const canView = can('job_orders', 'view');
	// The job order API checks job_orders only, so other menus' rights would only show buttons that fail.
	const canAdd = can('job_orders', 'add');
	const canEdit = can('job_orders', 'edit');
	const canDelete = can('job_orders', 'delete');

	const user = useMemo(() => getUserFromCookie(), []);
	const toast = useToast();
	const toastMoved = (job: JobOrder, status: BoardStatus) => toast({ message: `ย้าย ${job.job_order_code} ไป ${mapStatusToLabel(status)} แล้ว` });

	const [isInsertOpen, setIsInsertOpen] = useState(false);
	const [isUpdateOpen, setIsUpdateOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(null);
	const [copySeed, setCopySeed] = useState<Partial<CreateJobOrderDto> | null>(null);
	const [searchText, setSearchText] = useState('');
	const [selectedAssignee, setSelectedAssignee] = useState('all');
	const [selectedType, setSelectedType] = useState<'all' | 'website' | 'purchase' | 'custom'>('all');
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
	// Typing stays immediate; the board catches up at lower priority.
	const deferredSearchText = useDeferredValue(searchText);
	// "Load more" counts belong to one filter set and fall back to the default when the filters change.
	const filterKey = [deferredSearchText, selectedAssignee, selectedType, sortDirection, dateStart, dateEnd].join('|');
	const [visibleByFilter, setVisibleByFilter] = useState({ key: filterKey, counts: DEFAULT_VISIBLE });
	const columnVisible = visibleByFilter.key === filterKey ? visibleByFilter.counts : DEFAULT_VISIBLE;
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

	const { jobOrders, setJobOrders, isLoading, hasLoaded, fetchJobOrders } = useJobOrders(jobOrderModel, activeRange, sortDirection, (message) =>
		setResultDialog({ isOpen: true, status: 'error', message }),
	);

	const { assigneeOptions, filteredJobOrders, grouped } = useBoardFilters(jobOrders, deferredSearchText, selectedAssignee, selectedType, sortDirection);

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

	const {
		draggingJobId, setDraggingJobId, dragOverColumn, setDragOverColumn, pendingCompleteJob, completionQty, setCompletionQty,
		completionDefectQty, setCompletionDefectQty, isConfirmingComplete, pendingCancelJob, setPendingCancelJob,
		closeDetailModal, moveJob, handleConfirmComplete, handleDrop,
	} = useStatusMoves({ jobOrderModel, jobOrders, setJobOrders, employeeId: user?.employee_id, setResultDialog, setSelectedJobOrder, setIsDetailOpen, onMoved: toastMoved });
	// Cards are memoised with one actions object; the ref hands them the move of the latest render,
	// so a failed move rolls back to the current jobs instead of those of the first render.
	const moveJobRef = useRef(moveJob);
	useEffect(() => {
		moveJobRef.current = moveJob;
	});

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
			onMove: (job, status) => moveJobRef.current(job, status),
			onDragStart: (jobId) => setDraggingJobId(jobId),
			onDragEnd: () => {
				setDraggingJobId(null);
				setDragOverColumn(null);
			},
		}),
		[handleCardCopy, setDraggingJobId, setDragOverColumn],
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

	// "สร้างงานผลิต" on the Dashboard links here with ?create=1: open the drawer once, then drop the
	// query so a reload or the back button does not open it again (TASK-0321 R6).
	useEffect(() => {
		if (!canAdd) return;
		const url = new URL(window.location.href);
		if (url.searchParams.get('create') !== '1') return;
		const frame = requestAnimationFrame(() => {
			url.searchParams.delete('create');
			window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
			setCopySeed(null);
			setIsInsertOpen(true);
		});
		return () => cancelAnimationFrame(frame);
	}, [canAdd]);

	return (
		<div className="ka-page-body ka-jo">
			<div className="ka-ph">
				<div>
					<h1 className="ka-ph__title">งานผลิต</h1>
					<p className="ka-ph__lead">{hasLoaded ? lead : 'กำลังโหลด…'}</p>
				</div>
				<div className="ka-jo__acts">
					<ViewSwitch viewMode={viewMode} onChange={setViewMode} />
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
						toastMoved(pendingCancelJob, 'cancelled');
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
