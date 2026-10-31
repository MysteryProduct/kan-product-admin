'use client';

import StatusBadge from '@/components/StatusBadge';
import type { JobOrder } from '@/types/job-order';
import { formatThaiDate } from '@/lib/date-format';
import { BOARD_COLUMNS, count, getAssigneeName, initial, normalizeStatus, TYPE_LABEL, WEEKDAY_LABELS, type CalendarCell } from '../board-model';

interface CalendarViewProps {
	isLoading: boolean;
	calendarTitle: string;
	calendarCells: CalendarCell[];
	todayDateKey: string;
	selectedDay: string;
	selectedDayJobs: JobOrder[];
	selectedDayDate: Date | null;
	onSelectDay: (dateKey: string) => void;
	onMoveMonth: (direction: -1 | 1) => void;
	onToday: () => void;
	onOpenJob: (job: JobOrder) => void;
	onCreate: (targetDate: string) => void;
	canAdd: boolean;
}

/** A month of target dates with a panel for the chosen day; on phones a day shows dots instead of names. */
export default function CalendarView({ isLoading, calendarTitle, calendarCells, todayDateKey, selectedDay, selectedDayJobs, selectedDayDate, onSelectDay, onMoveMonth, onToday, onOpenJob, onCreate, canAdd }: CalendarViewProps) {
	return (
		<div className={`ka-cal ka-motion-state ${isLoading ? 'opacity-60' : ''}`}>
			<section className="ka-card ka-cal__grid" aria-label={`ปฏิทิน${calendarTitle}`}>
				<div className="ka-cal__head">
					<button type="button" className="ka-btn ka-btn--icon ka-btn--sm" aria-label="เดือนก่อน" onClick={() => onMoveMonth(-1)}>
						<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" /></svg>
					</button>
					<button type="button" className="ka-btn ka-btn--icon ka-btn--sm" aria-label="เดือนถัดไป" onClick={() => onMoveMonth(1)}>
						<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" /></svg>
					</button>
					<h2 className="ka-card__title">{calendarTitle}</h2>
					<button type="button" className="ka-btn ka-btn--sm" onClick={onToday}>วันนี้</button>
					<ul className="ka-legend ka-cal__legend">
						{BOARD_COLUMNS.map((column) => (
							<li key={column.key} data-tone={column.tone}><span className="inline-flex items-center gap-1.5"><i aria-hidden="true" />{column.short}</span></li>
						))}
					</ul>
				</div>
				<div className="ka-cal__wk" aria-hidden="true">
					{WEEKDAY_LABELS.map((dayLabel) => <div key={dayLabel}>{dayLabel}</div>)}
				</div>
				<div className="ka-cal__cells">
					{calendarCells.map((cell) => {
						const isToday = cell.dateKey === todayDateKey;
						const isSelected = cell.dateKey === selectedDay;
						const label = `${cell.date.getDate()} ${cell.date.toLocaleDateString('th-TH', { month: 'long' })}${cell.jobs.length ? ` ${count(cell.jobs.length)} งาน` : ''}`;
						return (
							<button
								key={cell.dateKey}
								type="button"
								className="ka-cell"
								data-out={cell.inCurrentMonth ? undefined : true}
								data-today={isToday || undefined}
								aria-pressed={isSelected}
								aria-label={label}
								onClick={() => onSelectDay(cell.dateKey)}
							>
								<span className="ka-cell__d numeric">{cell.date.getDate()}</span>
								{cell.jobs.slice(0, 3).map((job) => (
									<span key={job.job_order_id} className="ka-ev" data-tone={BOARD_COLUMNS.find((column) => column.key === normalizeStatus(job.job_order_status))?.tone}>{job.job_order_name}</span>
								))}
								{cell.jobs.length > 3 && <span className="ka-todo__cap">+{count(cell.jobs.length - 3)}</span>}
							</button>
						);
					})}
				</div>
			</section>
			<aside className="ka-card ka-cal__day" aria-labelledby="cal-day">
				<div className="flex items-start justify-between gap-2">
					<div>
						<p className="ka-todo__cap">{selectedDayDate ? selectedDayDate.toLocaleDateString('th-TH', { weekday: 'long' }) : 'เลือกวันในปฏิทิน'}</p>
						<h2 id="cal-day" className="ka-card__title">{selectedDayDate ? formatThaiDate(selectedDayDate) : '—'}</h2>
					</div>
					{selectedDayJobs.length > 0 && <StatusBadge tone="neutral">{count(selectedDayJobs.length)} งาน</StatusBadge>}
				</div>
				{selectedDayJobs.length === 0 && <p className="ka-panel__note">ไม่มีงานเป้าหมายในวันนี้</p>}
				{selectedDayJobs.map((job) => {
					const column = BOARD_COLUMNS.find((item) => item.key === normalizeStatus(job.job_order_status));
					return (
						<button key={job.job_order_id} type="button" className="ka-daycard" onClick={() => onOpenJob(job)}>
							<span className="flex items-start justify-between gap-2">
								<b>{job.job_order_name}</b>
								{column && <StatusBadge tone={column.tone}>{column.short}</StatusBadge>}
							</span>
							<span className="ka-todo__cap numeric">{job.job_order_code} · {TYPE_LABEL[String(job.job_order_type)] ?? job.job_order_type} · {count(job.job_order_qty ?? 0)} ชิ้น</span>
							<span className="ka-kc__who"><span className="ka-kc__av" aria-hidden="true">{initial(getAssigneeName(job))}</span>{getAssigneeName(job)}</span>
						</button>
					);
				})}
				{canAdd && selectedDay && (
					<button type="button" className="ka-btn" onClick={() => onCreate(selectedDay)}>
						<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
						เพิ่มงานในวันนี้
					</button>
				)}
			</aside>
		</div>
	);
}
