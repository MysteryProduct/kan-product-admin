'use client';

import { memo } from 'react';
import RowMenu from '@/components/RowMenu';
import StatusBadge from '@/components/StatusBadge';
import type { JobOrder } from '@/types/job-order';
import { formatThaiDate } from '@/lib/date-format';
import { ALLOWED_TRANSITIONS, count, getAssigneeName, getDelayBadge, initial, mapStatusToLabel, normalizeStatus, TYPE_LABEL, type BoardStatus } from '../board-model';

export interface JobCardActions {
	onView: (job: JobOrder) => void;
	onCopy: (job: JobOrder) => void;
	onEdit: (job: JobOrder) => void;
	onDelete: (job: JobOrder) => void;
	onMove: (job: JobOrder, status: BoardStatus) => void;
	onDragStart: (jobId: string) => void;
	onDragEnd: () => void;
}


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

export default JobCard;
