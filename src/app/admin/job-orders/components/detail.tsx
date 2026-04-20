'use client';

import { JobOrder } from '@/types/job-order';
import { formatThaiDate } from '@/lib/date-format';

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
		<div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
			<div className="mx-auto max-w-3xl mt-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
				<div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">รายละเอียดงานผลิต</h2>
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-300"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<div className="p-6 space-y-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">ชื่องานผลิต</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{jobOrder.job_order_name || '-'}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">ผู้รับผิดชอบ</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{assignee}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">ประเภท</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{getTypeLabel(jobOrder.job_order_type)}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">สถานะ</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{getStatusLabel(jobOrder.job_order_status)}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Target Date</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{formatThaiDate(jobOrder.target_date)}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Product Variant</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{jobOrder.product_variant_id || '-'}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Size</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{sizeLabel}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Color</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{colorLabel}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">จำนวนที่ผลิต</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{jobOrder.job_order_qty ?? 0}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">ราคาสินค้า (บาท)</p>
							<p className="text-slate-900 dark:text-slate-100 font-semibold">{jobOrder.job_order_price ?? 0}</p>
						</div>
					</div>

					<div>
						<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">รายละเอียด</p>
						<p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{jobOrder.job_order_description || '-'}</p>
					</div>

					<div>
						<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">วัตถุดิบที่ใช้</p>
						<div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
							{materials.length === 0 ? (
								<div className="px-4 py-3 text-slate-500 dark:text-slate-400">ไม่มีข้อมูลวัตถุดิบ</div>
							) : (
								<table className="w-full text-sm">
									<thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
										<tr>
											<th className="text-left px-4 py-2">วัตถุดิบ/ชิ้น</th>
											<th className="text-right px-4 py-2">จำนวน</th>
										</tr>
									</thead>
									<tbody>
										{materials.map((item, index) => (
											<tr key={item.job_order_material_id || `${item.material_id}-${index}`} className="border-t border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
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
						<div className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-500/10 p-4">
							<p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">ยืนยันปิดงานผลิต</p>
							<label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">จำนวนที่ผลิตจริง</label>
							<input
								type="number"
								min={0}
								step="0.01"
								value={completionQty}
								onChange={(event) => onCompletionQtyChange?.(event.target.value)}
								className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
							/>
							<label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-4 mb-2">จำนวนสินค้าเสียหาย</label>
							<input
								type="number"
								min={0}
								step="0.01"
								value={completionDefectQty}
								onChange={(event) => onCompletionDefectQtyChange?.(event.target.value)}
								className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
							/>
							<p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-2">หลังยืนยัน งานจะถูกเปลี่ยนเป็นสถานะ ผลิตเสร็จแล้ว และจะไม่สามารถลากไปสถานะอื่นได้</p>
							<div className="mt-4 flex flex-col-reverse sm:flex-row justify-end gap-2">
								<button
									type="button"
									onClick={onClose}
									disabled={isConfirming}
									className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
								>
									ยกเลิก
								</button>
								<button
									type="button"
									onClick={onConfirmComplete}
									disabled={isConfirming}
									className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
								>
									{isConfirming ? 'กำลังยืนยัน...' : 'ยืนยันปิดงาน'}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
