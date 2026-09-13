'use client';
import React from 'react';
import { PurchaseOrder, PurchaseOrderItem } from '@/types/purchase-order';
import { usePermissions } from '@/hooks/usePermissions';
import PurchaseOrderModel from '@/models/purchase-order';
import ConfirmDialog from '@/components/ConfirmDialog';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import { formatThaiDate } from '@/lib/date-format';
import { calculateVatSummary, VAT_TYPE_LABELS } from '@/lib/vat';
import useVatRate from '@/hooks/useVatRate';
import DocumentHistoryPanel from '@/components/document-history/DocumentHistoryPanel';
import DocumentCancellationAction from '@/components/DocumentCancellationAction';
interface PurchaseOrderDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	purchaseOrder: PurchaseOrder;
}
const purchaseOrderModel = new PurchaseOrderModel();
export default function PurchaseOrderDetailModal({
	isOpen,
	onClose,
	purchaseOrder,
	onSuccess,
}: PurchaseOrderDetailModalProps) {
    const vatRate = useVatRate();
	const { can } = usePermissions();
	const canApprovePurchaseOrder = can('purchase_orders', 'approve');
	// if (!isOpen) return null;
	const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
	const [resultDialog, setResultDialog] = React.useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		action: ActionResultDialogAction;
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		action: 'approve',
		message: '',
	});
	const items = ((purchaseOrder.purchaseOrderLists ?? (purchaseOrder as any).items ?? []) as PurchaseOrderItem[]);

	const calculateItemTotal = (item: PurchaseOrderItem) => {
		return item.purchase_order_list_total || (Number(item.purchase_order_list_qty) * Number(item.purchase_order_list_price));
	};

	const grandTotal =
		purchaseOrder.purchase_order_total || items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
	const vatSummary = calculateVatSummary(
		purchaseOrder.purchase_order_total || grandTotal,
		purchaseOrder.vat_type || 'none',
		vatRate,
	);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('th-TH', {
			style: 'decimal',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const statusClassMap = {
		pending: 'bg-[var(--color-bg-tertiary)] text-[var(--color-warning)]',
		active: 'bg-[var(--color-bg-tertiary)] text-[var(--color-success)]',
		inactive: 'bg-[var(--color-bg-tertiary)] text-[var(--color-error)]',
		partial: 'bg-[var(--color-bg-tertiary)] text-[var(--color-info)]',
		completed: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
	};
	const statusText ={
		pending: 'รออนุมัติ ',
		active: 'ใช้งานอยู่',
		inactive: 'ยกเลิก',
		partial: 'รับสินค้าบางส่วน',
		completed: 'รับสินค้าครบแล้ว',
	}
	async function handleApprove() {
		try {
			const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
			if (!user) {
				throw new Error('User not authenticated');
			}
			await purchaseOrderModel.approvePurchaseOrder(purchaseOrder.purchase_order_id, user.employee_id);
			setResultDialog({
				isOpen: true,
				status: 'success',
				action: 'approve',
				message: 'อนุมัติใบสั่งซื้อสำเร็จ',
			});
		} catch (error) {
			console.error('Error approving purchase order:', error);
			setResultDialog({
				isOpen: true,
				status: 'error',
				action: 'approve',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอนุมัติใบสั่งซื้อ',
			});
		}
	}

	const handleResultDialogClose = () => {
		const isSuccess = resultDialog.status === 'success';
		setResultDialog((prev) => ({ ...prev, isOpen: false }));

		if (isSuccess) {
			onSuccess?.();
			onClose();
		}
	};
	return (
		<>
		<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]">
			<div className="overlay-surface my-8 w-full max-w-5xl overflow-hidden rounded-2xl bg-[var(--color-bg-primary)]">
				<div className="border-b border-[var(--color-border)] px-6 py-5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="rounded-lg bg-[var(--color-bg-tertiary)] p-2 text-[var(--color-primary)]">
								<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							</div>
							<h2 className="text-xl font-semibold text-[var(--color-text-primary)]">รายละเอียดใบสั่งซื้อ</h2>
						</div>
						<button
							onClick={onClose}
							className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]"
							aria-label="ปิดรายละเอียดใบสั่งซื้อ"
						>
							<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">ชื่อใบสั่งซื้อ</label>
							<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{purchaseOrder.purchase_order_name || '-'}
							</div>
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">วันที่สร้าง</label>
							<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{formatThaiDate(purchaseOrder.purchase_date)}
							</div>
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">ผู้จัดจำหน่าย</label>
							<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{purchaseOrder.supplier?.supplier_name || '-'}
							</div>
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">สถานะ</label>
							<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								<span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusClassMap[purchaseOrder.purchase_order_status]}`}>
									{statusText[purchaseOrder.purchase_order_status]}
								</span>
							</div>
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">รูปแบบ VAT</label>
							<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{VAT_TYPE_LABELS[purchaseOrder.vat_type || 'none']}
							</div>
						</div>
					</div>

					<div className="mb-6">
						<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">รายละเอียด</label>
						<div className="min-h-[80px] w-full whitespace-pre-line rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-[var(--color-text-primary)]">
							{purchaseOrder.purchase_order_detail || '-'}
						</div>
					</div>

					<div className="mb-6">
						<div className="flex items-center justify-between mb-5">
							<h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
								<div className="rounded-lg bg-[var(--color-bg-tertiary)] p-2 text-[var(--color-primary)]">
									<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
									</svg>
								</div>
								รายการวัตถุดิบ
							</h3>
						</div>

						<div className="space-y-5">
							{items.length > 0 ? (
								items.map((item, index) => (
									<div key={item.purchase_order_list_id ?? `${item.material_id}-${index}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5">
										<div className="flex items-center gap-2 mb-4">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-sm font-semibold text-[var(--color-primary)]">
												{index + 1}
											</div>
											<h4 className="font-semibold text-[var(--color-text-primary)]">รายการที่ {index + 1}</h4>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
											<div className="md:col-span-2">
												<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">วัตถุดิบ</label>
												<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
													{item.material?.material_name || '-'}
												</div>
											</div>
											<div>
												<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">จำนวน</label>
												<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
													{item.purchase_order_list_qty}
												</div>
											</div>
											<div>
												<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">ราคา/หน่วย</label>
												<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
													฿{formatCurrency(item.purchase_order_list_price)}
												</div>
											</div>
											<div>
												<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">หน่วยสินค้า</label>
												<div className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
													{item.productUnit?.product_unit_name || '-'}
												</div>
											</div>
										</div>

									<div className="mt-4 border-t border-[var(--color-border)] pt-4">
											<div className="flex items-center justify-between rounded-lg bg-[var(--color-bg-secondary)] p-3">
											<span className="text-sm font-medium text-[var(--color-text-secondary)]">ยอดรวมรายการนี้</span>
												<span className="numeric text-lg font-semibold text-[var(--color-text-primary)]">฿{formatCurrency(calculateItemTotal(item))}</span>
											</div>
										</div>
									</div>
								))
							) : (
								<div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-8 text-center text-[var(--color-text-secondary)]">
									ไม่พบรายการวัตถุดิบ
								</div>
							)}
						</div>

						<div className="mt-6 space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 text-[var(--color-text-primary)]">
							<div className="flex justify-between items-center text-sm md:text-base">
								<span>ยอดก่อน VAT</span>
								<span>฿{formatCurrency(vatSummary.subtotal)}</span>
							</div>
							<div className="flex justify-between items-center text-sm md:text-base">
								<span>VAT {vatRate}% ({VAT_TYPE_LABELS[purchaseOrder.vat_type || 'none']})</span>
								<span>฿{formatCurrency(vatSummary.vatAmount)}</span>
							</div>
							<div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
								<span className="text-lg font-bold">ยอดรวมทั้งสิ้น</span>
								<span className="numeric text-2xl font-semibold text-[var(--color-primary)]">฿{formatCurrency(vatSummary.total)}</span>
							</div>
						</div>
					</div>

					<DocumentHistoryPanel endpoint={`/purchase-order/${purchaseOrder.purchase_order_id}/history`} />
                    {can('purchase_orders', 'reject') && ['pending', 'active'].includes(purchaseOrder.purchase_order_status) && <DocumentCancellationAction endpoint={`/purchase-order/${purchaseOrder.purchase_order_id}/reject`} onSuccess={() => { onSuccess?.(); onClose(); }} />}

					<div className="flex border-t border-[var(--color-border)] pt-6">
						<button
							type="button"
							onClick={onClose}
							className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-3 font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
						>
							ปิด
						</button>
						{canApprovePurchaseOrder && purchaseOrder.purchase_order_status === 'pending' && (
							<button
								type="button"
								onClick={() => setShowConfirmDialog(true)}
								className="ml-4 w-full rounded-lg bg-[var(--color-primary)] px-6 py-3 font-semibold text-white hover:bg-[var(--color-primary-hover)]"
							>
								อนุมัติ
							</button>
						)}
						{showConfirmDialog && (
							<ConfirmDialog
								isOpen={showConfirmDialog}
								title="ยืนยันการอนุมัติ"
								message="คุณแน่ใจหรือไม่ว่าต้องการอนุมัติใบสั่งซื้อนี้?"
								onConfirm={handleApprove}
								onCancel={() => setShowConfirmDialog(false)}
								bottom_className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-semibold text-white hover:bg-[var(--color-primary-hover)]"
							/>
						)}
					</div>
				</div>
			</div>
			
		</div>
		<ActionResultDialog
			isOpen={resultDialog.isOpen}
			status={resultDialog.status}
			action={resultDialog.action}
			message={resultDialog.message}
			onClose={handleResultDialogClose}
		/>
		</>
	);
}
