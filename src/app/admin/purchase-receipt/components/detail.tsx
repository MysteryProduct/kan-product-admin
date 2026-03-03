'use client';
import React from 'react';
import { PurchaseReceipt, PurchaseReceiptListItem } from '@/types/purchase-receipt';
import { usePermissions } from '@/hooks/usePermissions';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import PurchaseReceiptModel from '@/models/purchase-receipt';


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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-300/40 p-4 backdrop-blur-sm">
			<div className="w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-800">
				<div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-5 shadow-lg">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-2xl font-bold text-white">รายละเอียดใบรับสินค้า</h2>
						<button
							onClick={onClose}
							className="rounded-xl p-2 text-white transition-all duration-200 hover:bg-white/20 hover:text-black"
							type="button"
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
							<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">เลขที่ใบรับสินค้า</label>
							<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
								{purchaseReceipt.purchase_receipt_code || purchaseReceipt.purchase_receipt_id}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">เลขที่ใบสั่งซื้อ</label>
							<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
								{purchaseReceipt.purchaseOrder?.purchase_order_code || purchaseReceipt.purchase_order_id}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">วันที่รับสินค้า</label>
							<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
								{purchaseReceipt.entry_date ? new Date(purchaseReceipt.entry_date).toLocaleDateString('th-TH') : '-'}
							</div>
						</div>
					</div>

					<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">ผู้จัดจำหน่าย</label>
							<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
								{purchaseReceipt.supplier?.supplier_name || purchaseReceipt.supplier_id || '-'}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รายละเอียดใบรับสินค้า</label>
							<div className="min-h-[44px] rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
								{purchaseReceipt.purchase_receipt_detail || purchaseReceipt.purchase_receipt_detail || '-'}
							</div>
						</div>
					</div>

					<div className="space-y-4">
						{items.length > 0 ? (
							items.map((item, index) => (
								<div
									key={item.purchase_receipt_list_id || `${item.purchase_order_list_id}-${index}`}
									className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-900"
								>
									<div className="mb-3 flex items-center gap-2">
										<span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
											{index + 1}
										</span>
										{/* <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
											PO List ID: {item.purchase_order_list_id}
										</span> */}
									</div>

									<div className="grid grid-cols-1 gap-4 md:grid-cols-5">
										<div>
											<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">วัตถุดิบ</label>
											<div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
												{getMaterialDisplay(item)}
											</div>
										</div>
										<div>
											<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">จำนวนรับ</label>
											<div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
												{item.purchase_receipt_list_qty}
											</div>
										</div>
										<div>
											<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ราคา/หน่วย</label>
											<div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
												฿{formatCurrency(item.purchase_receipt_list_price)}
											</div>
										</div>
										<div>
											<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">หน่วย</label>
											<div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
												{item.productUnit?.product_unit_name || item.product_unit_id || '-'}
											</div>
										</div>
										<div>
											<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ยอดรวม</label>
											<div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
												฿{formatCurrency(calculateItemTotal(item))}
											</div>
										</div>
									</div>
								</div>
							))
						) : (
							<div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
								ไม่พบรายการวัตถุดิบ
							</div>
						)}
					</div>

					<div className="mt-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 shadow-lg">
						<div className="flex items-center justify-between">
							<span className="text-lg font-semibold text-white">ยอดรวมทั้งสิ้น</span>
							<span className="text-2xl font-bold text-white">฿{formatCurrency(grandTotal)}</span>
						</div>
					</div>

					<div className="flex pt-6 border-t-2 border-gray-200">
						<button
							type="button"
							onClick={onClose}
							className="w-full px-6 py-3.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-semibold border-2 border-gray-200 hover:border-gray-300"
						>
							ปิด
						</button>
						{canApprovePurchaseReceipt && purchaseReceipt.purchase_receipt_status === 'pending' && (
							<button
								type="button"
								onClick={() => setShowConfirmDialog(true)}
								className="w-full ml-4 px-6 py-3.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold border-2 border-green-600 hover:border-green-700"
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
								bottom_className=" px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold border-2 border-green-600 hover:border-green-700"
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
