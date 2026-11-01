import { useState, type Dispatch, type SetStateAction } from 'react';
import JobOrderModel from '@/models/job-order';
import type { JobOrder } from '@/types/job-order';
import { ALLOWED_TRANSITIONS, normalizeStatus, type BoardStatus } from './board-model';

type ResultDialog = { isOpen: boolean; status: 'success' | 'error'; message: string };

interface StatusMoveDeps {
	jobOrderModel: JobOrderModel;
	jobOrders: JobOrder[];
	setJobOrders: Dispatch<SetStateAction<JobOrder[]>>;
	employeeId?: string;
	setResultDialog: Dispatch<SetStateAction<ResultDialog>>;
	setSelectedJobOrder: (job: JobOrder | null) => void;
	setIsDetailOpen: (open: boolean) => void;
	/** Says where a job went after a move the server accepted. */
	onMoved: (job: JobOrder, status: BoardStatus) => void;
}

/**
 * Status changes of the job order page: a move to completed opens the quantity dialog, a move to
 * cancelled opens the reason dialog, and any other allowed move is saved at once.
 */
export function useStatusMoves({ jobOrderModel, jobOrders, setJobOrders, employeeId, setResultDialog, setSelectedJobOrder, setIsDetailOpen, onMoved }: StatusMoveDeps) {
	const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
	const [dragOverColumn, setDragOverColumn] = useState<BoardStatus | null>(null);
	const [pendingCompleteJob, setPendingCompleteJob] = useState<JobOrder | null>(null);
	const [completionQty, setCompletionQty] = useState('');
	const [completionDefectQty, setCompletionDefectQty] = useState('');
	const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);
	const [pendingCancelJob, setPendingCancelJob] = useState<JobOrder | null>(null);

	const updateJobStatus = async (jobId: string, targetStatus: BoardStatus, qty?: number, defectQty?: number, reason?: string): Promise<boolean> => {
		const previous = [...jobOrders];
		const moved = previous.find((job) => job.job_order_id === jobId);
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
			await jobOrderModel.updateJobOrderStatus(jobId, targetStatus, employeeId, qty, defectQty, reason);
			if (moved) onMoved(moved, targetStatus);
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

	const startComplete = (job: JobOrder) => {
		setSelectedJobOrder(job);
		setPendingCompleteJob(job);
		setCompletionQty(job.job_order_qty && job.job_order_qty > 0 ? String(job.job_order_qty) : '');
		setCompletionDefectQty(typeof job.job_order_defect_qty === 'number' && job.job_order_defect_qty > 0 ? String(job.job_order_defect_qty) : '0');
		setIsDetailOpen(true);
	};

	/** The card button, the row menu and a drop all move a job through here. */
	const moveJob = (job: JobOrder, status: BoardStatus) => {
		if (status === 'completed') {
			startComplete(job);
		} else if (status === 'cancelled') {
			setPendingCancelJob(job);
		} else {
			void updateJobStatus(job.job_order_id, status);
		}
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
		setDraggingJobId(null);
		setDragOverColumn(null);
		if (!current) {
			return;
		}

		const currentStatus = normalizeStatus(current.job_order_status);
		if (currentStatus === column || !ALLOWED_TRANSITIONS[currentStatus].includes(column)) {
			return;
		}

		moveJob(current, column);
	};

	return {
		draggingJobId,
		setDraggingJobId,
		dragOverColumn,
		setDragOverColumn,
		pendingCompleteJob,
		completionQty,
		setCompletionQty,
		completionDefectQty,
		setCompletionDefectQty,
		isConfirmingComplete,
		pendingCancelJob,
		setPendingCancelJob,
		closeDetailModal,
		moveJob,
		handleConfirmComplete,
		handleDrop,
	};
}
