import { useMemo } from 'react';
import type { JobOrder } from '@/types/job-order';
import { formatThaiDate } from '@/lib/date-format';
import { bangkokDayKey, BOARD_COLUMNS, getAssigneeName, getDueInfo, getVariantLabel, mapStatusToLabel, normalizeStatus, type BoardStatus, type StatusTab } from './board-model';

/**
 * The people filter options, the jobs that pass the search, person and type filters (sorted by target
 * day), those jobs by column, the count behind each status tab and the jobs of the chosen tab.
 */
export function useBoardFilters(jobOrders: JobOrder[], deferredSearchText: string, selectedAssignee: string, selectedType: string, sortDirection: 'ASC' | 'DESC', statusTab: StatusTab) {
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
					job.productVariant?.product?.product_name || '',
					...getVariantLabel(job).pills,
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
		// Nearest target date first ("ใกล้ถึงกำหนดก่อน") or the reverse; jobs without a date go last either way.
		const sign = sortDirection === 'ASC' ? 1 : -1;
		const dayOf = (job: JobOrder) => bangkokDayKey(job.target_date ?? null);

		return jobOrders.filter((job) => {
			const matchesSearch = !q || (searchTextByJob.get(job.job_order_id) ?? '').includes(q);
			const matchesPerson = selectedAssignee === 'all' || selectedAssignee === (job.employee_id || getAssigneeName(job));
			const matchesType = selectedType === 'all' || selectedType === job.job_order_type;

			return matchesSearch && matchesPerson && matchesType;
		}).sort((a, b) => {
			const dayA = dayOf(a);
			const dayB = dayOf(b);
			if (!dayA || !dayB) return dayA ? -1 : dayB ? 1 : 0;
			return dayA === dayB ? 0 : (dayA < dayB ? -1 : 1) * sign;
		});
	}, [jobOrders, searchTextByJob, deferredSearchText, selectedAssignee, selectedType, sortDirection]);

	const grouped = useMemo(() => {
		return BOARD_COLUMNS.reduce((acc, column) => {
			acc[column.key] = filteredJobOrders.filter((job) => normalizeStatus(job.job_order_status) === column.key);
			return acc;
		}, {} as Record<BoardStatus, JobOrder[]>);
	}, [filteredJobOrders]);

	const { tabCounts, tabJobs } = useMemo(() => {
		const late = new Set(filteredJobOrders.filter((job) => getDueInfo(job).late).map((job) => job.job_order_id));
		const inTab = (job: JobOrder, tab: StatusTab) => tab === 'all' || (tab === 'late' ? late.has(job.job_order_id) : normalizeStatus(job.job_order_status) === tab);
		const counts = { all: filteredJobOrders.length, late: late.size } as Record<StatusTab, number>;
		BOARD_COLUMNS.forEach((column) => {
			counts[column.key] = grouped[column.key].length;
		});
		return { tabCounts: counts, tabJobs: filteredJobOrders.filter((job) => inTab(job, statusTab)) };
	}, [filteredJobOrders, grouped, statusTab]);

	return { assigneeOptions, filteredJobOrders, grouped, tabCounts, tabJobs };
}
