'use client';
import { JobOrder } from '@/types/job-order';
import { formatThaiDate } from '@/lib/date-format';
import DocumentHistoryPanel from '@/components/document-history/DocumentHistoryPanel';
import Modal from '@/components/Modal';

interface JobOrderDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	jobOrder: JobOrder | null;
	mode?: 'view' | 'complete_confirm';
	completionQty?: string;
	completionDefectQty?: string;
	onCompletionQtyChange?: (value: string) => void;
	onCompletionDefectQtyChange?: (value: string) => void;
	onConfirmComplete?: () => void;
	isConfirming?: boolean;
}

const getStatusLabel = (status?: string) => {
	if (!status) {
		return '-';
	}

	if (status === 'pending' || status === 'รอดำเนินการ') {
		return 'รอดำเนินการ';
	}
	if (status === 'in_progress' || status === 'กำลังผลิต') {
		return 'กำลังผลิต';
	}
	if (status === 'completed' || status === 'ผลิตเสร็จแล้ว') {
		return 'ผลิตเสร็จแล้ว';
	}
	if (status === 'cancelled' || status === 'ยกเลิกการผลิต') {
		return 'ยกเลิกการผลิต';
	}
	return status;
};

const getTypeLabel = (type?: string) => {
	if (!type) {
		return '-';
	}

	if (type === 'website') {
		return 'ผลิตเพื่อขายบน website';
	}
	if (type === 'purchase') {
		return 'ผลิตจากการสั่งซื้อ';
	}

	return type;
};

export default function JobOrderDetailModal({
	isOpen,
	onClose,
	jobOrder,
	mode = 'view',
	completionQty = '',
	completionDefectQty = '',
	onCompletionQtyChange,
	onCompletionDefectQtyChange,
	onConfirmComplete,
	isConfirming = false,
}: JobOrderDetailModalProps) {
	if (!isOpen || !jobOrder) {
		return null;
	}

	const isCompleteConfirm = mode === 'complete_confirm';

	const assignee =
		jobOrder.employee?.employee_fullname ||
		`${jobOrder.employee?.employee_firstname || ''} ${jobOrder.employee?.employee_lastname || ''}`.trim() ||
		'-';

	const materials = jobOrder.jobOrderMaterials || jobOrder.job_order_materials || [];
	const sizeLabel = jobOrder.size?.size_name || jobOrder.productVariant?.size?.size_name || (jobOrder.size_id ? String(jobOrder.size_id) : '-');
	const colorLabel = jobOrder.color?.color_name || jobOrder.productVariant?.color?.color_name || (jobOrder.color_id ? String(jobOrder.color_id) : '-');

	return (
		<Modal
			isOpen={isOpen}
			onClose={() => { if (!isConfirming) onClose(); }}
			title="รายละเอียดงานผลิต"
			size="lg"
			closeOnBackdrop={!isConfirming}
			closeOnEscape={!isConfirming}
		>
			<div className="space-y-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">ชื่องานผลิต</p>
						<p className="text-[var(--ink)] font-semibold">{jobOrder.job_order_name || '-'}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">ผู้รับผิดชอบ</p>
						<p className="text-[var(--ink)] font-semibold">{assignee}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">ประเภท</p>
						<p className="text-[var(--ink)] font-semibold">{getTypeLabel(jobOrder.job_order_type)}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">สถานะ</p>
						<p className="text-[var(--ink)] font-semibold">{getStatusLabel(jobOrder.job_order_status)}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">Target Date</p>
						<p className="text-[var(--ink)] font-semibold">{formatThaiDate(jobOrder.target_date)}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">Product Variant</p>
						<p className="text-[var(--ink)] font-semibold">{jobOrder.product_variant_id || '-'}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">Size</p>
						<p className="text-[var(--ink)] font-semibold">{sizeLabel}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">Color</p>
						<p className="text-[var(--ink)] font-semibold">{colorLabel}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">จำนวนที่ผลิต</p>
						<p className="text-[var(--ink)] font-semibold">{jobOrder.job_order_qty ?? 0}</p>
					</div>
					<div>
						<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">ราคาสินค้า (บาท)</p>
						<p className="text-[var(--ink)] font-semibold">{jobOrder.job_order_price ?? 0}</p>
					</div>
				</div>

				<div>
					<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)]">รายละเอียด</p>
					<p className="text-[var(--ink)] whitespace-pre-wrap">{jobOrder.job_order_description || '-'}</p>
				</div>

				<div>
					<p className="text-[13px] uppercase tracking-wider text-[var(--ink-muted)] mb-2">วัตถุดิบที่ใช้</p>
					<div className="rounded-xl border border-[var(--border)] overflow-hidden">
						{materials.length === 0 ? (
							<div className="px-4 py-3 text-[var(--ink-muted)]">ไม่มีข้อมูลวัตถุดิบ</div>
						) : (
							<table className="w-full text-sm">
								<thead className="bg-[var(--bg-muted)] text-[var(--ink-muted)]">
									<tr>
										<th className="text-left px-4 py-2">วัตถุดิบ/ชิ้น</th>
										<th className="text-right px-4 py-2">จำนวน</th>
									</tr>
								</thead>
								<tbody>
									{materials.map((item, index) => (
										<tr key={item.job_order_material_id || `${item.material_id}-${index}`} className="border-t border-[var(--border)] text-[var(--ink)]">
											<td className="px-4 py-2">{item.material?.material_name || item.material_id || '-'}</td>
											<td className="px-4 py-2 text-right">{item.material_qty}</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>

				{isCompleteConfirm && (
					<div className="rounded-xl border border-[var(--success)] bg-[var(--success-soft)]/70 p-4">
						<p className="text-sm font-semibold text-[var(--success)] mb-2">ยืนยันปิดงานผลิต</p>
						<label className="block text-[13px] uppercase tracking-wider text-[var(--ink-muted)] mb-2">จำนวนที่ผลิตจริง</label>
						<input
							type="number"
							min={1}
							step="1"
							value={completionQty}
							onChange={(event) => onCompletionQtyChange?.(event.target.value)}
							className="ka-input w-full max-w-xs"
						/>
						<label className="block text-[13px] uppercase tracking-wider text-[var(--ink-muted)] mt-4 mb-2">จำนวนสินค้าเสียหาย</label>
						<input
							type="number"
							min={0}
							step="1"
							value={completionDefectQty}
							onChange={(event) => onCompletionDefectQtyChange?.(event.target.value)}
							className="ka-input w-full max-w-xs"
						/>
						<p className="text-[13px] text-[var(--success)]/80 mt-2">หลังยืนยัน งานจะถูกเปลี่ยนเป็นสถานะ ผลิตเสร็จแล้ว และจะไม่สามารถลากไปสถานะอื่นได้</p>
						<div className="mt-4 flex flex-col-reverse sm:flex-row justify-end gap-2">
							<button
								type="button"
								onClick={onClose}
								disabled={isConfirming}
								className="ka-btn"
							>
								ยกเลิก
							</button>
							<button
								type="button"
								onClick={onConfirmComplete}
								disabled={isConfirming}
								className="ka-btn ka-btn--primary min-h-11"
							>
								{isConfirming ? 'กำลังยืนยัน...' : 'ยืนยันปิดงาน'}
							</button>
						</div>
					</div>
				)}
			</div>
			{jobOrder && <div className="mt-4"><DocumentHistoryPanel endpoint={`/job-order/${jobOrder.job_order_id}/history`} /></div>}
		</Modal>
	);
}
