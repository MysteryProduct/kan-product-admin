'use client';

import { memo } from 'react';
import RowMenu from '@/components/RowMenu';
import type { JobOrder } from '@/types/job-order';
import { ALLOWED_TRANSITIONS, count, getAssigneeName, getDueInfo, getVariantLabel, initial, mapStatusToLabel, normalizeStatus, TYPE_LABEL, type BoardStatus } from '../board-model';

export interface JobCardActions {
	onView: (job: JobOrder) => void;
	onCopy: (job: JobOrder) => void;
	onEdit: (job: JobOrder) => void;
	onDelete: (job: JobOrder) => void;
	onMove: (job: JobOrder, status: BoardStatus) => void;
	onDragStart: (jobId: string) => void;
	onDragEnd: () => void;
}

/** The forward step of a job, or null when it has none: pending starts, in progress finishes. */
export const nextStep = (job: JobOrder, canEdit: boolean): { status: BoardStatus; label: string } | null => {
	if (!canEdit) return null;
	const status = normalizeStatus(job.job_order_status);
	if (status === 'pending' && ALLOWED_TRANSITIONS.pending.includes('in_progress')) return { status: 'in_progress', label: 'เริ่มผลิต' };
	if (status === 'in_progress' && ALLOWED_TRANSITIONS.in_progress.includes('completed')) return { status: 'completed', label: 'ผลิตเสร็จ' };
	return null;
};

/** "เริ่มผลิต →" / "ผลิตเสร็จ →": the same move as dragging to the next column, so completion still asks for the quantities. */
export function NextStepButton({ job, canEdit, onMove }: { job: JobOrder; canEdit: boolean; onMove: JobCardActions['onMove'] }) {
	const step = nextStep(job, canEdit);
	if (!step) return null;
	return (
		<button type="button" className="ka-jo-next" aria-label={`${step.label} ${job.job_order_code}`} onClick={() => onMove(job, step.status)}>
			{step.label}
			<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" /></svg>
		</button>
	);
}

// Memoised so a keystroke in the search box, or a drag entering a column, does not rebuild every card.
// The title opens the job (a click elsewhere on the card does too); the row menu holds the commands,
// including "เปลี่ยนสถานะ" for keyboards and touch screens.
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
	const hasAssignee = assignee !== '-';
	const jobStatus = normalizeStatus(job.job_order_status);
	const moves = ALLOWED_TRANSITIONS[jobStatus];
	const canMove = canEdit && moves.length > 0;
	const isClosed = jobStatus === 'completed' || jobStatus === 'cancelled';
	const due = getDueInfo(job);
	const { title, pills } = getVariantLabel(job);

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
			onClick={(event) => {
				// Buttons and the menu do their own thing; anywhere else on the card opens the job.
				if ((event.target as HTMLElement).closest('button, a, [role="menu"], [role="dialog"]')) return;
				actions.onView(job);
			}}
			className={`ka-kc ka-jo-card ${canMove ? 'ka-kc--grab' : ''} ${isDragging ? 'ka-kc--dragging' : ''} ${due.late ? 'ka-jo-card--late' : ''}`}
			aria-label={`${job.job_order_code} ${job.job_order_name}`}
		>
			<div className="ka-jo-card__top">
				<button type="button" className="ka-kc__title" onClick={() => actions.onView(job)}>
					{title}
				</button>
				<span className="ka-jo-type">{TYPE_LABEL[String(job.job_order_type)] ?? String(job.job_order_type)}</span>
			</div>
			{pills.length > 0 && (
				<div className="ka-jo-pills">
					{pills.map((pill) => <span key={pill} className="ka-jo-pill">{pill}</span>)}
				</div>
			)}
			<div className="ka-kc__meta">
				<span className="numeric">{job.job_order_code}</span>
				<span>
					<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /></svg>
					<span className="numeric">{count(job.job_order_qty ?? 0)} ชิ้น</span>
				</span>
			</div>
			<span className="ka-jo-due" data-tone={due.tone}>{due.text}</span>
			<div className="ka-jo-card__foot">
				<span className="ka-kc__av" aria-hidden="true">{hasAssignee ? initial(assignee) : '?'}</span>
				<span className="ka-jo-card__who">{hasAssignee ? assignee : 'ยังไม่มอบหมาย'}</span>
				{/* The step button and the menu wrap to the next line together, never the menu alone. */}
				<span className="ka-jo-card__acts">
					<NextStepButton job={job} canEdit={canEdit} onMove={actions.onMove} />
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
				</span>
			</div>
		</article>
	);
});

export default JobCard;
