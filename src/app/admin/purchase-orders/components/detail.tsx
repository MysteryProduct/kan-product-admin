'use client';
import React from 'react';
import { PurchaseOrder, PurchaseOrderItem } from '@/types/purchase-order';
import { usePermissions } from '@/hooks/usePermissions';
import PurchaseOrderModel from '@/models/purchase-order';
import ConfirmDialog from '@/components/ConfirmDialog';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
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

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('th-TH', {
			style: 'decimal',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const statusClassMap = {
		pending: 'bg-yellow-100 text-yellow-700',
		active: 'bg-green-100 text-green-700',
		inactive: 'bg-red-100 text-red-700',
		partial: 'bg-blue-100 text-blue-700',
		completed: 'bg-gray-100 text-gray-700',
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
		<div className="fixed inset-0 bg-gray-300/40 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
			<div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full my-8 overflow-hidden">
				<div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-5 shadow-lg">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="bg-white bg-opacity-20 p-2 rounded-lg backdrop-blur-sm">
								<svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							</div>
							<h2 className="text-2xl font-bold text-white">รายละเอียดใบสั่งซื้อ</h2>
						</div>
						<button
							onClick={onClose}
							className="text-white hover:text-black hover:bg-white hover:bg-opacity-25 rounded-xl p-2 transition-all duration-200 hover:scale-105"
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
							<label className="block text-sm font-semibold text-gray-700 mb-2">ชื่อใบสั่งซื้อ</label>
							<div className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
								{purchaseOrder.purchase_order_name || '-'}
							</div>
						</div>

						<div>
							<label className="block text-sm font-semibold text-gray-700 mb-2">วันที่สร้าง</label>
							<div className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
								{purchaseOrder.purchase_date ? new Date(purchaseOrder.purchase_date).toLocaleDateString('th-TH') : '-'}
							</div>
						</div>

						<div>
							<label className="block text-sm font-semibold text-gray-700 mb-2">ผู้จัดจำหน่าย</label>
							<div className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
								{purchaseOrder.supplier?.supplier_name || '-'}
							</div>
						</div>

						<div>
							<label className="block text-sm font-semibold text-gray-700 mb-2">สถานะ</label>
							<div className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
								<span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusClassMap[purchaseOrder.purchase_order_status]}`}>
									{statusText[purchaseOrder.purchase_order_status]}
								</span>
							</div>
						</div>
					</div>

					<div className="mb-6">
						<label className="block text-sm font-semibold text-gray-700 mb-2">รายละเอียด</label>
						<div className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm min-h-[80px] whitespace-pre-line">
							{purchaseOrder.purchase_order_detail || '-'}
						</div>
					</div>

					<div className="mb-6">
						<div className="flex items-center justify-between mb-5">
							<h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
								<div className="bg-blue-100 p-2 rounded-lg">
									<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
									</svg>
								</div>
								รายการสินค้า
							</h3>
						</div>

						<div className="space-y-5">
							{items.length > 0 ? (
								items.map((item, index) => (
									<div key={item.purchase_order_list_id ?? `${item.product_id}-${index}`} className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-2xl border border-gray-200 shadow-sm">
										<div className="flex items-center gap-2 mb-4">
											<div className="bg-blue-100 text-blue-600 font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center">
												{index + 1}
											</div>
											<h4 className="font-semibold text-gray-900">รายการที่ {index + 1}</h4>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
											<div className="md:col-span-2">
												<label className="block text-sm font-semibold text-gray-700 mb-2">สินค้า</label>
												<div className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
													{item.product?.product_name || '-'}
												</div>
											</div>
											<div>
												<label className="block text-sm font-semibold text-gray-700 mb-2">จำนวน</label>
												<div className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
													{item.purchase_order_list_qty}
												</div>
											</div>
											<div>
												<label className="block text-sm font-semibold text-gray-700 mb-2">ราคา/หน่วย</label>
												<div className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
													฿{formatCurrency(item.purchase_order_list_price)}
												</div>
											</div>
											<div>
												<label className="block text-sm font-semibold text-gray-700 mb-2">หน่วยสินค้า</label>
												<div className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
													{item.productUnit?.product_unit_name || '-'}
												</div>
											</div>
										</div>

										<div className="mt-4 pt-4 border-t-2 border-gray-200">
											<div className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg">
												<span className="text-sm font-semibold text-gray-700">ยอดรวมรายการนี้:</span>
												<span className="text-xl font-bold text-blue-600">฿{formatCurrency(calculateItemTotal(item))}</span>
											</div>
										</div>
									</div>
								))
							) : (
								<div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-xl bg-gray-50">
									ไม่พบรายการสินค้า
								</div>
							)}
						</div>

						<div className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl shadow-lg">
							<div className="flex justify-between items-center">
								<span className="text-lg font-bold text-white">ยอดรวมทั้งสิ้น:</span>
								<span className="text-3xl font-bold text-white">฿{formatCurrency(grandTotal)}</span>
							</div>
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
						{canApprovePurchaseOrder && purchaseOrder.purchase_order_status === 'pending' && (
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
								message="คุณแน่ใจหรือไม่ว่าต้องการอนุมัติใบสั่งซื้อนี้?"
								onConfirm={handleApprove}
								onCancel={() => setShowConfirmDialog(false)}
								bottom_className=" px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold border-2 border-green-600 hover:border-green-700"
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
