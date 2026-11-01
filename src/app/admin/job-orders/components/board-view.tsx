'use client';

import type { JobOrder } from '@/types/job-order';
import { ALLOWED_TRANSITIONS, BOARD_COLUMNS, count, normalizeStatus, type BoardStatus } from '../board-model';
import JobCard, { type JobCardActions } from './job-card';

interface BoardViewProps {
	isLoading: boolean;
	grouped: Record<BoardStatus, JobOrder[]>;
	columnVisible: Record<BoardStatus, number>;
	dragOverColumn: BoardStatus | null;
	setDragOverColumn: (column: BoardStatus | null) => void;
	draggingJobId: string | null;
	onDrop: (column: BoardStatus) => void;
	onLoadMore: (column: BoardStatus) => void;
	canAdd: boolean;
	canEdit: boolean;
	canDelete: boolean;
	actions: JobCardActions;
}

/**
 * Four status columns, always all four whatever status tab is chosen. While a card is dragged the
 * columns it may move to get a dashed outline and the others fade; on phones the columns swipe one at a time.
 */
export default function BoardView({ isLoading, grouped, columnVisible, dragOverColumn, setDragOverColumn, draggingJobId, onDrop, onLoadMore, canAdd, canEdit, canDelete, actions }: BoardViewProps) {
	const draggingJob = draggingJobId ? BOARD_COLUMNS.flatMap((column) => grouped[column.key] || []).find((job) => job.job_order_id === draggingJobId) : undefined;
	const dropTargets = draggingJob ? ALLOWED_TRANSITIONS[normalizeStatus(draggingJob.job_order_status)] : null;

	return (
		<>
			<div className={`ka-board ka-motion-state ${isLoading ? 'opacity-60' : ''}`} aria-label="บอร์ดงานผลิต">
				{BOARD_COLUMNS.map((column) => {
					const cards = grouped[column.key] || [];
					const visibleCount = columnVisible[column.key];
					const visibleCards = cards.slice(0, visibleCount);
					const remaining = cards.length - visibleCount;
					const dropState = !dropTargets ? undefined : dropTargets.includes(column.key) ? 'allowed' : 'blocked';
					return (
						<section
							key={column.key}
							aria-label={`${column.label} ${count(cards.length)} งาน`}
							data-drop={dropState}
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
								onDrop(column.key);
							}}
							className={`ka-col ${dragOverColumn === column.key && dropState === 'allowed' ? 'ka-col--over' : ''}`}
							style={{ ['--c' as string]: column.color }}
						>
							<div className="ka-col__head">
								<b>{column.label}</b>
								<span className="ka-col__n numeric">{count(cards.length)}</span>
							</div>
							{cards.length === 0 && <div className="ka-col__empty">{column.empty}</div>}
							{visibleCards.map((job) => (
								<JobCard key={job.job_order_id} job={job} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} isDragging={draggingJobId === job.job_order_id} actions={actions} />
							))}
							{remaining > 0 && (
								<button type="button" className="ka-btn ka-btn--sm" onClick={() => onLoadMore(column.key)}>
									โหลดเพิ่ม ({count(remaining)} งาน)
								</button>
							)}
						</section>
					);
				})}
			</div>
			<p className="ka-panel__note">ลากการ์ดเพื่อเปลี่ยนสถานะ หรือกดปุ่มบนการ์ดเพื่อไปขั้นถัดไป</p>
		</>
	);
}
