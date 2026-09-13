'use client';
import React from 'react';
import { PurchaseReceipt, PurchaseReceiptListItem } from '@/types/purchase-receipt';
import { usePermissions } from '@/hooks/usePermissions';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import { formatThaiDate } from '@/lib/date-format';
import { calculateVatSummary, VAT_TYPE_LABELS } from '@/lib/vat';
import useVatRate from '@/hooks/useVatRate';
import DocumentHistoryPanel from '@/components/document-history/DocumentHistoryPanel';
import DocumentCancellationAction from '@/components/DocumentCancellationAction';


interface PurchaseReceiptDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	purchaseReceipt: PurchaseReceipt;
}
const purchaseReceiptModel = new PurchaseReceiptModel();
export default function PurchaseReceiptDetailModal({
	isOpen,
	onClose,
	onSuccess,
	purchaseReceipt,
}: PurchaseReceiptDetailModalProps) {
	const vatRate = useVatRate();
	if (!isOpen) {
		return null;
	}
	const { can } = usePermissions();
	const canApprovePurchaseReceipt = can('purchase_receipt', 'approve');
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
	const items = purchaseReceipt.purchaseReceiptLists || [];

	const calculateItemTotal = (item: PurchaseReceiptListItem) => {
		if (typeof item.purchase_receipt_list_total === 'number') {
			return item.purchase_receipt_list_total;
		}
		return Number(item.purchase_receipt_list_qty) * Number(item.purchase_receipt_list_price);
	};

	const getMaterialDisplay = (item: PurchaseReceiptListItem) => {
		return (
			item.material?.material_name ||
			item.purchaseOrderList?.material?.material_name ||
			item.material_id ||
			item.purchaseOrderList?.material_id ||
			'-'
		);
	};

	const grandTotal =
		purchaseReceipt.purchase_receipt_total || items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
	const vatSummary = calculateVatSummary(
		purchaseReceipt.purchase_receipt_total || grandTotal,
		purchaseReceipt.vat_type || 'none',
		vatRate,
	);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('th-TH', {
			style: 'decimal',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	async function handleApprove() {
		try {
			const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
			if (!user) {
				throw new Error('User not authenticated');
			}
			await purchaseReceiptModel.approvePurchaseReceipt(purchaseReceipt.purchase_receipt_id, user.employee_id);
			setResultDialog({
				isOpen: true,
				status: 'success',
				action: 'approve',
				message: 'อนุมัติใบรับสินค้าสำเร็จ',
			});
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				action: 'approve',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอนุมัติใบรับสินค้า',
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
			<div className="overlay-surface w-full max-w-6xl overflow-hidden rounded-2xl bg-[var(--color-bg-primary)]">
				<div className="border-b border-[var(--color-border)] px-6 py-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-xl font-semibold text-[var(--color-text-primary)]">รายละเอียดใบรับสินค้า</h2>
						<button
							onClick={onClose}
							className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]"
							type="button"
							aria-label="ปิดรายละเอียดใบรับสินค้า"
						>
							<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<div className="max-h-[calc(90vh-160px)] overflow-y-auto p-6">
					<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">เลขที่ใบรับสินค้า</label>
							<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{purchaseReceipt.purchase_receipt_code || purchaseReceipt.purchase_receipt_id}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">เลขที่ใบสั่งซื้อ</label>
							<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{purchaseReceipt.purchaseOrder?.purchase_order_code || purchaseReceipt.purchase_order_id}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">วันที่รับสินค้า</label>
							<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{formatThaiDate(purchaseReceipt.entry_date)}
							</div>
						</div>
					</div>

					<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">ผู้จัดจำหน่าย</label>
							<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{purchaseReceipt.supplier?.supplier_name || purchaseReceipt.supplier_id || '-'}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">รูปแบบ VAT</label>
							<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{VAT_TYPE_LABELS[purchaseReceipt.vat_type || 'none']}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">รายละเอียดใบรับสินค้า</label>
							<div className="min-h-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-[var(--color-text-primary)]">
								{purchaseReceipt.purchase_receipt_detail || purchaseReceipt.purchase_receipt_detail || '-'}
							</div>
						</div>
					</div>

					<div className="space-y-4">
						{items.length > 0 ? (
							items.map((item, index) => (
								<div
									key={item.purchase_receipt_list_id || `${item.purchase_order_list_id}-${index}`}
									className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4"
								>
									<div className="mb-3 flex items-center gap-2">
										<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-sm font-semibold text-[var(--color-primary)]">
											{index + 1}
										</span>
									</div>

									<div className="grid grid-cols-1 gap-4 md:grid-cols-5">
										<div>
											<label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">วัตถุดิบ</label>
											<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
												{getMaterialDisplay(item)}
											</div>
										</div>
										<div>
											<label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">จำนวนรับ</label>
											<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
												{item.purchase_receipt_list_qty}
											</div>
										</div>
										<div>
											<label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">ราคา/หน่วย</label>
											<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
												฿{formatCurrency(item.purchase_receipt_list_price)}
											</div>
										</div>
										<div>
											<label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">หน่วย</label>
											<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
												{item.productUnit?.product_unit_name || item.product_unit_id || '-'}
											</div>
										</div>
										<div>
											<label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">ยอดรวม</label>
											<div className="numeric rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">
												฿{formatCurrency(calculateItemTotal(item))}
											</div>
										</div>
									</div>
								</div>
							))
						) : (
							<div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center text-[var(--color-text-secondary)]">
								ไม่พบรายการวัตถุดิบ
							</div>
						)}
					</div>

					<div className="mt-6 space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 text-[var(--color-text-primary)]">
						<div className="flex items-center justify-between text-sm md:text-base">
							<span>ยอดก่อน VAT</span>
							<span>฿{formatCurrency(vatSummary.subtotal)}</span>
						</div>
						<div className="flex items-center justify-between text-sm md:text-base">
							<span>VAT {vatRate}% ({VAT_TYPE_LABELS[purchaseReceipt.vat_type || 'none']})</span>
							<span>฿{formatCurrency(vatSummary.vatAmount)}</span>
						</div>
						<div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
							<span className="text-lg font-semibold">ยอดรวมทั้งสิ้น</span>
							<span className="numeric text-2xl font-semibold text-[var(--color-primary)]">฿{formatCurrency(vatSummary.total)}</span>
						</div>
					</div>

					<DocumentHistoryPanel endpoint={`/purchase-receipt/${purchaseReceipt.purchase_receipt_id}/history`} />
                    {can('purchase_receipt', 'reject') && ['pending', 'approved'].includes(purchaseReceipt.purchase_receipt_status) && <DocumentCancellationAction endpoint={`/purchase-receipt/${purchaseReceipt.purchase_receipt_id}/reject`} onSuccess={() => { onSuccess?.(); onClose(); }} />}

					<div className="flex border-t border-[var(--color-border)] pt-6">
						<button
							type="button"
							onClick={onClose}
							className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-3 font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
						>
							ปิด
						</button>
						{canApprovePurchaseReceipt && purchaseReceipt.purchase_receipt_status === 'pending' && (
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
								message="คุณแน่ใจหรือไม่ว่าต้องการอนุมัติใบรับสินค้านี้?"
								onConfirm={handleApprove}
								onCancel={() => setShowConfirmDialog(false)}
								bottom_className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-semibold text-white hover:bg-[var(--color-primary-hover)]"
							/>
						)}
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
		</div>
	);
}
