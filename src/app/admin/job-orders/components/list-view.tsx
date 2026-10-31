'use client';

import type { JobOrder } from '@/types/job-order';
import { BOARD_COLUMNS, count, getAssigneeName, getDueInfo, getVariantLabel, initial, normalizeStatus, TYPE_LABEL, type StatusTab } from '../board-model';
import { NextStepButton, type JobCardActions } from './job-card';

interface ListViewProps {
	isLoading: boolean;
	/** The jobs left after the filters and the status tab. */
	jobs: JobOrder[];
	statusTab: StatusTab;
	canEdit: boolean;
	actions: JobCardActions;
}

/**
 * One card of rows grouped by status. "ทั้งหมด" shows every group, empty ones included; another tab
 * shows only the groups that hold its jobs. Below 640px each row becomes a two-column card.
 */
export default function ListView({ isLoading, jobs, statusTab, canEdit, actions }: ListViewProps) {
	const groups = BOARD_COLUMNS.map((column) => ({ column, jobs: jobs.filter((job) => normalizeStatus(job.job_order_status) === column.key) }))
		.filter((group) => statusTab === 'all' || group.jobs.length > 0);

	return (
		<section className={`ka-card ka-jo-list ka-motion-state ${isLoading ? 'opacity-60' : ''}`} aria-label="รายการงานผลิต">
			<div className="ka-jo-row ka-jo-row--head" aria-hidden="true">
				<span>งาน</span>
				<span className="ka-jo-row__type">ประเภท</span>
				<span className="ka-jo-row__qty">จำนวน</span>
				<span className="ka-jo-row__due">วันเป้าหมาย</span>
				<span className="ka-jo-row__own">ผู้รับผิดชอบ</span>
				<span />
			</div>
			{groups.map(({ column, jobs: groupJobs }) => (
				<div key={column.key} className="ka-jo-group" role="group" aria-label={`${column.label} ${count(groupJobs.length)} งาน`}>
					<div className="ka-jo-group__head">
						<span className="ka-jo-dot ka-jo-dot--sq" style={{ background: column.color }} aria-hidden="true" />
						{column.label}
						<span className="ka-jo-group__n numeric">{count(groupJobs.length)} งาน</span>
					</div>
					{groupJobs.length === 0 && <p className="ka-jo-group__empty">ไม่มีงานในสถานะนี้</p>}
					{groupJobs.map((job) => {
						const { title, pills } = getVariantLabel(job);
						const due = getDueInfo(job);
						const assignee = getAssigneeName(job);
						const hasAssignee = assignee !== '-';
						return (
							<div
								key={job.job_order_id}
								className={`ka-jo-row ${due.late ? 'ka-jo-row--late' : ''}`}
								onClick={(event) => {
									if ((event.target as HTMLElement).closest('button, a')) return;
									actions.onView(job);
								}}
							>
								<div className="ka-jo-row__job">
									<button type="button" className="ka-jo-row__title" onClick={() => actions.onView(job)}>{title}</button>
									<div className="ka-kc__meta">
										<span className="numeric">{job.job_order_code}</span>
										{pills.map((pill) => <span key={pill} className="ka-jo-pill">{pill}</span>)}
									</div>
								</div>
								<span className="ka-jo-row__type"><span className="ka-jo-type">{TYPE_LABEL[String(job.job_order_type)] ?? String(job.job_order_type)}</span></span>
								<span className="ka-jo-row__qty numeric">{count(job.job_order_qty ?? 0)} ชิ้น</span>
								<span className="ka-jo-row__due"><span className="ka-jo-due" data-tone={due.tone}>{due.text}</span></span>
								<span className="ka-jo-row__own">
									<span className="ka-kc__av" aria-hidden="true">{hasAssignee ? initial(assignee) : '?'}</span>
									<span className="ka-jo-card__who">{hasAssignee ? assignee : 'ยังไม่มอบหมาย'}</span>
								</span>
								<span className="ka-jo-row__act"><NextStepButton job={job} canEdit={canEdit} onMove={actions.onMove} /></span>
							</div>
						);
					})}
				</div>
			))}
		</section>
	);
}
