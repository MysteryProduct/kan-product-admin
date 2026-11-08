import { useEffect, useRef } from 'react';
import JobOrderModel from '@/models/job-order';
import type { JobOrder } from '@/types/job-order';

/**
 * Links into the page: `?jobId=` (from a sale order) opens that exact job, including jobs outside the
 * date filter, and `?create=1` (the Dashboard's "สร้างงานผลิต") opens the create drawer once, then drops
 * the query so a reload or the back button does not open it again (TASK-0321 R6). `&product=` starts it
 * with that product variant (the stock menu's "สั่งผลิต").
 */
export function usePageLinks(jobOrderModel: JobOrderModel, { canView, canAdd, openJob, openCreate, onError }: {
	canView: boolean;
	canAdd: boolean;
	openJob: (job: JobOrder) => void;
	openCreate: (productVariantId: string | null) => void;
	onError: (message: string) => void;
}) {
	const handlers = useRef({ openJob, openCreate, onError });
	useEffect(() => {
		handlers.current = { openJob, openCreate, onError };
	});

	useEffect(() => {
		const jobId = new URLSearchParams(window.location.search).get('jobId');
		if (!canView || !jobId) return;
		let active = true;
		void jobOrderModel.getJobOrderById(jobId).then((job) => {
			if (active) handlers.current.openJob(job);
		}).catch((error: unknown) => {
			if (active) handlers.current.onError(error instanceof Error ? error.message : 'ไม่สามารถเปิดงานผลิตได้');
		});
		return () => { active = false; };
	}, [jobOrderModel, canView]);

	useEffect(() => {
		if (!canAdd) return;
		const url = new URL(window.location.href);
		if (url.searchParams.get('create') !== '1') return;
		const frame = requestAnimationFrame(() => {
			const productVariantId = url.searchParams.get('product');
			url.searchParams.delete('create');
			url.searchParams.delete('product');
			window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
			handlers.current.openCreate(productVariantId);
		});
		return () => cancelAnimationFrame(frame);
	}, [canAdd]);
}
