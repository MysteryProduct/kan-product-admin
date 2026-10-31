import { useMemo } from 'react';
import type { JobOrder } from '@/types/job-order';
import { formatThaiDate } from '@/lib/date-format';
import { BOARD_COLUMNS, getAssigneeName, mapStatusToLabel, normalizeStatus, type BoardStatus } from './board-model';

/** The board's people filter options, the jobs that pass the search, person and type filters, and those jobs by column. */
export function useBoardFilters(jobOrders: JobOrder[], deferredSearchText: string, selectedAssignee: string, selectedType: string) {
	const assigneeOptions = useMemo(() => {
		const map = new Map<string, string>();
		jobOrders.forEach((job) => {
			const key = job.employee_id || getAssigneeName(job);
			if (!key) {
				return;
			}
			map.set(key, getAssigneeName(job));
		});
		return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
	}, [jobOrders]);

	// Searchable text per job, built once per fetch instead of on every keystroke.
	// Fields are joined with a newline, which a search box cannot contain, so a match never spans two fields.
	const searchTextByJob = useMemo(() => {
		return new Map(
			jobOrders.map((job) => [
				job.job_order_id,
				[
					job.job_order_code || '',
					job.job_order_name || '',
					getAssigneeName(job),
					String(job.target_date || ''),
					formatThaiDate(job.target_date),
					mapStatusToLabel(normalizeStatus(job.job_order_status)),
					String(job.job_order_qty ?? ''),
				]
					.join('\n')
					.toLowerCase(),
			]),
		);
	}, [jobOrders]);

	const filteredJobOrders = useMemo(() => {
		const q = deferredSearchText.trim().toLowerCase();

		return jobOrders.filter((job) => {
			const matchesSearch = !q || (searchTextByJob.get(job.job_order_id) ?? '').includes(q);
			const matchesPerson = selectedAssignee === 'all' || selectedAssignee === (job.employee_id || getAssigneeName(job));
			const matchesType = selectedType === 'all' || selectedType === job.job_order_type;

			return matchesSearch && matchesPerson && matchesType;
		});
	}, [jobOrders, searchTextByJob, deferredSearchText, selectedAssignee, selectedType]);

	const grouped = useMemo(() => {
		return BOARD_COLUMNS.reduce((acc, column) => {
			acc[column.key] = filteredJobOrders.filter((job) => normalizeStatus(job.job_order_status) === column.key);
			return acc;
		}, {} as Record<BoardStatus, JobOrder[]>);
	}, [filteredJobOrders]);

	return { assigneeOptions, filteredJobOrders, grouped };
}
