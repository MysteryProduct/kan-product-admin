'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ActionResultDialog from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import CancellationDialog from '@/components/CancellationDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import JobOrderModel from '@/models/job-order';
import CreateJobOrderDrawer from './components/create-drawer';
import UpdateJobOrderForm from './components/update';
import JobOrderDetailModal from './components/detail';
import { CreateJobOrderDto, JobOrder } from '@/types/job-order';
import { ALLOWED_TRANSITIONS, count, DEFAULT_VISIBLE, getUserFromCookie, mapStatusToLabel, normalizeStatus, PAGE_SIZE, STATUS_META, type BoardStatus, type StatusTab } from './board-model';
import BoardView from './components/board-view';
import FilterBar, { type JobType } from './components/filter-bar';
import StatusTabs from './components/status-tabs';
import OverdueBanner from './components/overdue-banner';
import { useViewMode } from './use-view-mode';
import { useBoardFilters } from './use-board-filters';
import CalendarView from './components/calendar-view';
import ListView from './components/list-view';
import type { JobCardActions } from './components/job-card';
import ViewSwitch from './components/view-switch';
import { useStatusMoves } from './use-status-moves';
import { useJobOrders } from './use-job-orders';
import { useCalendarState } from './use-calendar-state';
import { usePageLinks } from './use-page-links';
import { NoJobsState, NoMatchState, ViewSkeleton } from './components/view-states';
import { TYPE_FILTER_OPTIONS } from './components/filter-bar';

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
	const [selectedType, setSelectedType] = useState<JobType>('all');
	const [statusTab, setStatusTab] = useState<StatusTab>('all');
	const [searchOpen, setSearchOpen] = useState(false);
	const [viewMode, setViewMode] = useViewMode();
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
	const calendar = useCalendarState();

	// The board and list show the chosen target-date range; the calendar shows its month. Whichever view
	// is open decides what is loaded, so switching back to the board reloads the board's range.
	const boardRange = useMemo(() => ({ start: dateStart, end: dateEnd }), [dateStart, dateEnd]);
	const activeRange = viewMode === 'calendar' ? calendar.monthRange : boardRange;

	const { jobOrders, setJobOrders, isLoading, hasLoaded, loadError, fetchJobOrders } = useJobOrders(jobOrderModel, activeRange, sortDirection);

	const { assigneeOptions, filteredJobOrders, grouped, tabCounts, tabJobs } = useBoardFilters(jobOrders, deferredSearchText, selectedAssignee, selectedType, sortDirection, statusTab);

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
	const overdueCards = tabCounts.late;
	// What the "no match" state says is on, and what "ล้างตัวกรอง" turns off.
	const activeFilters = [
		...(deferredSearchText.trim() ? [`ค้นหา “${deferredSearchText.trim()}”`] : []),
		...(selectedAssignee !== 'all' ? [`ผู้รับผิดชอบ ${assigneeOptions.find((option) => option.value === selectedAssignee)?.label ?? ''}`] : []),
		...(selectedType !== 'all' ? [`ประเภท ${TYPE_FILTER_OPTIONS.find((option) => option.value === selectedType)?.label ?? ''}`] : []),
		...(statusTab !== 'all' && viewMode !== 'board' ? [`สถานะ ${STATUS_META[statusTab].label}`] : []),
	];
	const clearFilters = () => {
		setSearchText('');
		setSelectedAssignee('all');
		setSelectedType('all');
		setStatusTab('all');
	};
	const visibleCount = viewMode === 'board' ? filteredJobOrders.length : tabJobs.length;
	const lead = `${count(totalCards)} งานในช่วงนี้ · ${overdueCards > 0 ? `เลยกำหนด ${count(overdueCards)} งาน` : 'ไม่มีงานเลยกำหนด'}`;

	const openCreate = (seed: Partial<CreateJobOrderDto> | null) => {
		setCopySeed(seed);
		setIsInsertOpen(true);
	};

	usePageLinks(jobOrderModel, {
		canView,
		canAdd,
		openJob: (job) => {
			setSelectedJobOrder(job);
			setIsDetailOpen(true);
		},
		openCreate: (productVariantId) => openCreate(productVariantId ? { product_variant_id: productVariantId } : null),
		onError: (message) => setResultDialog({ isOpen: true, status: 'error', message }),
	});

	return (
		<div className="ka-page-body ka-jo">
			<div className="ka-ph">
				<div>
					<h1 className="ka-ph__title">งานผลิต</h1>
					<p className="ka-ph__lead">{hasLoaded ? lead : 'กำลังโหลด…'}</p>
				</div>
				<div className="ka-jo__acts">
					<button type="button" className="ka-btn ka-btn--ghost ka-btn--icon ka-jo-search-toggle" aria-label="ค้นหางานผลิต" aria-expanded={searchOpen} aria-controls="jo-search"
						onClick={() => {
							setSearchOpen((open) => !open);
							requestAnimationFrame(() => document.getElementById('jo-search')?.focus());
						}}
					>
						<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
					</button>
					<ViewSwitch viewMode={viewMode} onChange={setViewMode} />
					{canAdd && (
						<button type="button" onClick={() => openCreate(null)} className="ka-btn ka-btn--primary ka-jo-create">
							<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
							สร้างงานผลิต
						</button>
					)}
				</div>
			</div>

			<OverdueBanner
				overdue={overdueCards}
				onShow={() => {
					setStatusTab('late');
					if (viewMode === 'board') setViewMode('list');
				}}
			/>

			<StatusTabs value={statusTab} counts={tabCounts} onChange={setStatusTab} />

			<FilterBar
				isLoading={isLoading}
				hasLoaded={hasLoaded}
				viewMode={viewMode}
				searchOpen={searchOpen}
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

			<LoadErrorBanner message={loadError} onRetry={() => void fetchJobOrders()} />

			{isLoading && !hasLoaded ? (
				<ViewSkeleton viewMode={viewMode} />
			) : viewMode !== 'calendar' && hasLoaded && jobOrders.length === 0 ? (
				<NoJobsState canAdd={canAdd} onCreate={() => openCreate(null)} />
			) : viewMode !== 'calendar' && visibleCount === 0 && jobOrders.length > 0 ? (
				<NoMatchState filters={activeFilters} onClear={clearFilters} />
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
			) : viewMode === 'list' ? (
				<ListView isLoading={isLoading} jobs={tabJobs} statusTab={statusTab} canEdit={canEdit} actions={cardActions} />
			) : (
				<CalendarView
					isLoading={isLoading}
					monthDate={calendar.monthDate}
					jobs={tabJobs}
					todayKey={calendar.todayKey}
					selectedDay={calendar.selectedDay}
					onSelectDay={calendar.selectDay}
					onMoveMonth={calendar.moveMonth}
					onToday={calendar.goToday}
					onCreate={(targetDate) => openCreate({ target_date: targetDate })}
					canAdd={canAdd}
					canEdit={canEdit}
					actions={cardActions}
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
