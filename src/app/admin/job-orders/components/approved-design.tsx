'use client';

import { useEffect, useState } from 'react';
import JobOrderModel from '@/models/job-order';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import type { JobOrder, JobOrderCustomRequest, JobOrderDesignLayer } from '@/types/job-order';

const jobOrderModel = new JobOrderModel();

const SIDE: Record<string, string> = { front: 'ด้านหน้า', back: 'ด้านหลัง' };
const KIND: Record<JobOrderDesignLayer['kind'], string> = { image: 'ภาพ', text: 'ข้อความ', other: 'อื่น ๆ' };
const percent = (value: number | null) => (value === null ? null : `${Math.round(value * 100)}%`);

/** "ด้านหน้า · ตำแหน่ง x 50% y 40% · ขนาด 60% · หมุน 15°", leaving out what the layer does not carry. */
const placementText = (layer: JobOrderDesignLayer) =>
	[
		layer.side ? (SIDE[layer.side] ?? layer.side) : null,
		layer.x !== null && layer.y !== null ? `ตำแหน่ง x ${percent(layer.x)} y ${percent(layer.y)}` : null,
		layer.scale !== null ? `ขนาด ${percent(layer.scale)}` : null,
		layer.rotation !== null ? `หมุน ${Math.round(layer.rotation)}°` : null,
		layer.width && layer.height ? `ไฟล์ ${layer.width} × ${layer.height} px` : null,
	]
		.filter(Boolean)
		.join(' · ');

type Loaded = { jobId: string; request: JobOrderCustomRequest | null; error: string | null };

/**
 * The design staff approved for the Custom request behind a job (TASK-0219 R2): each item's options and
 * its layers with text, image file name, side, position, size and rotation. A job from a list carries
 * only the request codes, so the design is read from the job itself when the dialog opens; it shows the
 * approved revision, never a newer one still under review, and no customer file.
 */
export default function ApprovedDesign({ job }: { job: JobOrder }) {
	const jobId = job.job_order_id;
	// A job read on its own (the dashboard) already carries the design.
	const carried = job.custom_request?.items ? job.custom_request : null;
	const [loaded, setLoaded] = useState<Loaded | null>(null);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (carried) return;
		let current = true;
		jobOrderModel.getJobOrderById(jobId).then(
			(full) => {
				if (current) setLoaded({ jobId, request: full.custom_request ?? null, error: null });
			},
			(error: unknown) => {
				if (current) setLoaded({ jobId, request: null, error: loadErrorText('แบบที่อนุมัติ', error) });
			},
		);
		return () => {
			current = false;
		};
	}, [jobId, carried, attempt]);

	// An answer for another job is not this job's design.
	const answer = carried ? { jobId, request: carried, error: null } : loaded?.jobId === jobId ? loaded : null;
	const request = answer?.request ?? null;
	const items = request?.items ?? [];

	return (
		<section className="ka-jo-design" aria-labelledby="jo-design-title">
			<p id="jo-design-title" className="ka-label mb-2">
				แบบที่อนุมัติ
				{request?.approved_revision ? <span className="ka-todo__cap"> · ฉบับที่ {request.approved_revision}</span> : null}
			</p>
			{!answer && (
				<div role="status" aria-label="กำลังโหลดแบบที่อนุมัติ" className="grid gap-2">
					<span className="ka-skel ka-skel--title" />
					<span className="ka-skel" />
					<span className="ka-skel" style={{ width: '70%' }} />
				</div>
			)}
			{answer?.error && (
				<LoadErrorBanner
					message={answer.error}
					onRetry={() => {
						setLoaded(null);
						setAttempt((n) => n + 1);
					}}
				/>
			)}
			{answer && !answer.error && items.length === 0 && (
				<p className="ka-panel__note">{request ? 'คำขอนี้ไม่มีข้อมูลแบบที่อนุมัติ' : 'ไม่พบคำขอ Custom ของงานนี้'}</p>
			)}
			{items.map((item) => (
				<div key={item.item_no} className="ka-jo-design__item">
					<div className="ka-jo-design__head">
						<b>
							{item.item_no} · {item.template_name}
						</b>
						<span className="numeric">
							{new Intl.NumberFormat('th-TH').format(item.quantity)} {item.sale_unit}
						</span>
					</div>
					{item.options.length > 0 && <p className="ka-jo-design__opts">{item.options.map((option) => `${option.group} ${option.value}`).join(' · ')}</p>}
					{item.layers.length === 0 ? (
						<p className="ka-panel__note">ไม่มีข้อมูลชั้นงานในรายการนี้</p>
					) : (
						<ol className="ka-jo-design__layers" aria-label={`ชั้นงานของรายการ ${item.item_no}`}>
							{item.layers.map((layer) => (
								<li key={layer.no}>
									<span className="k">
										ชั้น {layer.no} · {KIND[layer.kind]}
									</span>
									<span className="v">{layer.kind === 'text' ? `“${layer.text ?? ''}”` : layer.kind === 'image' ? (layer.file_name ?? '-') : '-'}</span>
									<span className="p numeric">{placementText(layer)}</span>
								</li>
							))}
						</ol>
					)}
				</div>
			))}
		</section>
	);
}
