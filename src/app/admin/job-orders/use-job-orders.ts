import { useCallback, useEffect, useRef, useState } from 'react';
import JobOrderModel from '@/models/job-order';
import type { JobOrder } from '@/types/job-order';

/** The jobs whose target date falls in `range`, reloaded whenever the range or the sort changes. */
export function useJobOrders(jobOrderModel: JobOrderModel, range: { start: string; end: string }, sortDirection: 'ASC' | 'DESC', onError: (message: string) => void) {
	const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [hasLoaded, setHasLoaded] = useState(false);
	const requestIdRef = useRef(0);
	const onErrorRef = useRef(onError);
	useEffect(() => {
		onErrorRef.current = onError;
	});

	const fetchJobOrders = useCallback(async () => {
		// Only the latest request may update the board, so a slow earlier response cannot overwrite a newer range.
		const requestId = ++requestIdRef.current;
		setIsLoading(true);
		try {
			const response = await jobOrderModel.getJobOrders(1, 300, sortDirection, undefined, undefined, range.start || undefined, range.end || undefined);
			if (requestId !== requestIdRef.current) {
				return;
			}
			setJobOrders(response.data || []);
			setHasLoaded(true);
		} catch (error) {
			if (requestId !== requestIdRef.current) {
				return;
			}
			console.error('Failed to fetch job orders:', error);
			onErrorRef.current(error instanceof Error ? error.message : 'ไม่สามารถดึงข้อมูลงานผลิตได้');
		} finally {
			if (requestId === requestIdRef.current) {
				setIsLoading(false);
			}
		}
	}, [jobOrderModel, range, sortDirection]);

	useEffect(() => {
		// Started after the effect returns, so the loading flag is not set synchronously inside the effect;
		// the request id already ignores a response that a newer range has replaced.
		void Promise.resolve().then(fetchJobOrders);
	}, [fetchJobOrders]);

	return { jobOrders, setJobOrders, isLoading, hasLoaded, fetchJobOrders };
}
