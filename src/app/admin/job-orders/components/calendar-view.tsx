'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { JobOrder } from '@/types/job-order';
import { bangkokDayKey, BOARD_COLUMNS, buildCalendarCells, count, getDueInfo, getVariantLabel, normalizeStatus, toIsoDate, WEEKDAY_LABELS } from '../board-model';
import { NextStepButton, type JobCardActions } from './job-card';

interface CalendarViewProps {
	isLoading: boolean;
	monthDate: Date;
	/** The month's jobs left after the filters and the status tab. */
	jobs: JobOrder[];
	todayKey: string;
	selectedDay: string;
	onSelectDay: (dayKey: string) => void;
	onMoveMonth: (direction: -1 | 1) => void;
	onToday: () => void;
	onCreate: (targetDate: string) => void;
	canAdd: boolean;
	canEdit: boolean;
	actions: JobCardActions;
}

const MONTH_TITLE = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' });
const MONTH_NAME = new Intl.DateTimeFormat('th-TH', { month: 'long' });
const DAY_TITLE = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });
const WEEKDAY = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long' });
const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/** Bar colour of a job in a day: overdue first, then its status. */
const toneOf = (job: JobOrder) => (getDueInfo(job).late ? 'late' : normalizeStatus(job.job_order_status));
const statusLabel = (job: JobOrder) => BOARD_COLUMNS.find((column) => column.key === normalizeStatus(job.job_order_status))?.label ?? '';
const dotColor = (job: JobOrder) => (getDueInfo(job).late ? 'var(--danger)' : BOARD_COLUMNS.find((column) => column.key === normalizeStatus(job.job_order_status))?.color);

/**
 * A month of target days with a panel for the chosen day. Days are buttons in one tab stop: the arrow
 * keys move the day (into the next or previous month too). On phones a day shows dots instead of names
 * and the panel moves under the month.
 */
export default function CalendarView({ isLoading, monthDate, jobs, todayKey, selectedDay, onSelectDay, onMoveMonth, onToday, onCreate, canAdd, canEdit, actions }: CalendarViewProps) {
	const cells = useMemo(() => buildCalendarCells(monthDate, jobs), [monthDate, jobs]);
	const gridRef = useRef<HTMLDivElement | null>(null);
	const focusAfterMove = useRef(false);

	// After an arrow key the chosen day may be in a re-rendered month, so focus follows once it exists.
	useEffect(() => {
		if (!focusAfterMove.current) return;
		const target = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${selectedDay}"]`);
		if (target) {
			target.focus();
			focusAfterMove.current = false;
		}
	}, [selectedDay, cells]);

	const dayJobs = cells.find((cell) => cell.dateKey === selectedDay)?.jobs ?? [];
	const upcoming = useMemo(
		() => jobs
			.filter((job) => ['pending', 'in_progress'].includes(normalizeStatus(job.job_order_status)))
			.sort((a, b) => (bangkokDayKey(a.target_date ?? null) ?? '9').localeCompare(bangkokDayKey(b.target_date ?? null) ?? '9'))
			.slice(0, 4),
		[jobs],
	);
	const selectedNoon = new Date(`${selectedDay}T12:00:00+07:00`);
	const tabStop = cells.some((cell) => cell.dateKey === selectedDay) ? selectedDay : cells.find((cell) => cell.inCurrentMonth)?.dateKey;

	return (
		<div className={`ka-cal ka-jo-cal ka-motion-state ${isLoading ? 'opacity-60' : ''}`}>
			<section className="ka-card ka-cal__grid" aria-label={`ปฏิทิน${MONTH_TITLE.format(monthDate)}`}>
				<div className="ka-cal__head">
					<button type="button" className="ka-btn ka-btn--icon ka-btn--sm" aria-label="เดือนก่อน" onClick={() => onMoveMonth(-1)}>
						<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" /></svg>
					</button>
					<button type="button" className="ka-btn ka-btn--icon ka-btn--sm" aria-label="เดือนถัดไป" onClick={() => onMoveMonth(1)}>
						<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" /></svg>
					</button>
					<h2 className="ka-card__title">{MONTH_TITLE.format(monthDate)}</h2>
					<button type="button" className="ka-btn ka-btn--sm" onClick={onToday}>วันนี้</button>
				</div>
				<div className="ka-cal__wk" aria-hidden="true">
					{WEEKDAY_LABELS.map((dayLabel) => <div key={dayLabel}>{dayLabel}</div>)}
				</div>
				<div className="ka-cal__cells" ref={gridRef}>
					{cells.map((cell) => {
						const shown = cell.jobs.slice(0, 2);
						const more = cell.jobs.length - shown.length;
						return (
							<button
								key={cell.dateKey}
								type="button"
								className="ka-cell"
								data-day={cell.dateKey}
								data-out={cell.inCurrentMonth ? undefined : true}
								data-today={cell.dateKey === todayKey || undefined}
								aria-pressed={cell.dateKey === selectedDay}
								aria-label={`${cell.date.getDate()} ${MONTH_NAME.format(cell.date)} ${cell.jobs.length ? `${count(cell.jobs.length)} งาน` : 'ไม่มีงาน'}`}
								tabIndex={cell.dateKey === tabStop ? 0 : -1}
								onClick={() => onSelectDay(cell.dateKey)}
								onKeyDown={(event) => {
									const step = STEP[event.key];
									if (!step) return;
									event.preventDefault();
									focusAfterMove.current = true;
									onSelectDay(toIsoDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate() + step)));
								}}
							>
								<span className="ka-cell__d numeric">{cell.date.getDate()}</span>
								{shown.map((job) => <span key={job.job_order_id} className="ka-ev" data-tone={toneOf(job)}>{getVariantLabel(job).title}</span>)}
								{more > 0 && <span className="ka-jo-more">+{count(more)} งาน</span>}
							</button>
						);
					})}
				</div>
			</section>
			<aside className="ka-card ka-cal__day" aria-labelledby="cal-day">
				<div>
					<p className="ka-todo__cap m-0">{WEEKDAY.format(selectedNoon)}</p>
					<h2 id="cal-day" className="ka-card__title">{DAY_TITLE.format(selectedNoon)}{selectedDay === todayKey ? ' (วันนี้)' : ''}</h2>
				</div>
				{dayJobs.map((job) => (
					<div key={job.job_order_id} className="ka-jo-pj">
						<span className="ka-jo-dot" style={{ background: dotColor(job) }} aria-hidden="true" />
						<div className="ka-jo-pj__body">
							<button type="button" className="ka-jo-row__title" onClick={() => actions.onView(job)}>{getVariantLabel(job).title}</button>
							<p className="ka-todo__cap numeric m-0">{job.job_order_code} · {count(job.job_order_qty ?? 0)} ชิ้น · {statusLabel(job)}</p>
						</div>
						<NextStepButton job={job} canEdit={canEdit} onMove={actions.onMove} />
					</div>
				))}
				{dayJobs.length === 0 && (
					<>
						<p className="ka-panel__note m-0">ไม่มีงานครบกำหนดวันนี้</p>
						{upcoming.length > 0 && <h3 className="ka-jo-pj__head">งานที่ยังไม่เสร็จ</h3>}
						{upcoming.map((job) => (
							<div key={job.job_order_id} className="ka-jo-pj">
								<span className="ka-jo-dot" style={{ background: dotColor(job) }} aria-hidden="true" />
								<div className="ka-jo-pj__body">
									<button type="button" className="ka-jo-row__title" onClick={() => actions.onView(job)}>{getVariantLabel(job).title}</button>
									<p className="ka-todo__cap m-0">{getDueInfo(job).text} · {statusLabel(job)}</p>
								</div>
							</div>
						))}
					</>
				)}
				{canAdd && (
					<button type="button" className="ka-btn" onClick={() => onCreate(selectedDay)}>
						<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
						เพิ่มงานในวันที่นี้
					</button>
				)}
			</aside>
		</div>
	);
}
