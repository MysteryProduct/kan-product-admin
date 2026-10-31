'use client';

import type { JobOrder } from '@/types/job-order';
import { BOARD_COLUMNS, count, type BoardStatus } from '../board-model';
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
	onCreate: () => void;
	canAdd: boolean;
	canEdit: boolean;
	canDelete: boolean;
	actions: JobCardActions;
}

/** Four status columns; cards drag between them, and on phones the columns swipe one at a time. */
export default function BoardView({ isLoading, grouped, columnVisible, dragOverColumn, setDragOverColumn, draggingJobId, onDrop, onLoadMore, onCreate, canAdd, canEdit, canDelete, actions }: BoardViewProps) {
	return (
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
								onDrop(column.key);
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
								<JobCard key={job.job_order_id} job={job} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} isDragging={draggingJobId === job.job_order_id} actions={actions} />
							))}
							{remaining > 0 && (
								<button type="button" className="ka-btn ka-btn--sm" onClick={() => onLoadMore(column.key)}>
									โหลดเพิ่ม ({count(remaining)} งาน)
								</button>
							)}
							{column.key === 'pending' && canAdd && (
								<button type="button" className="ka-col__add" onClick={onCreate}>
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
	);
}
