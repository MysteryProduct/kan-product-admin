'use client';

import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import Pagination from '@/components/Pagination';
import PurchaseOrderListModel from '@/models/purchase-order-list';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import { PurchaseOrderItem, PurchaseOrderItemResponse } from '@/types/purchase-order-list';
import { PurchaseOrder } from '@/types/purchase-order';
import { PaginationMeta } from '@/types/pagination';

interface ReceiptItemForm {
	id: string;
	material_id: string;
	purchase_order_list_id: string;
	purchase_receipt_list_qty: number;
	purchase_receipt_list_price: number;
	product_unit_id: number;
	ordered_qty: number;
	material_name?: string;
	product_unit_name?: string;
	material?: {
		material_id: string;
		material_name: string;
	};
	productUnit?: {
		product_unit_id: number;
		product_unit_name: string;
	};
}

interface InsertPurchaseReceiptFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	purchaseOrder: PurchaseOrder | null;
}

type SelectionSortField = 'purchase_order_list_price' | 'purchase_order_list_total' | null;
type SortOrder = 'ASC' | 'DESC';

const purchaseOrderListModel = new PurchaseOrderListModel();
const purchaseReceiptModel = new PurchaseReceiptModel();

const mapOrderItemToFormItem = (item: PurchaseOrderItem): ReceiptItemForm => ({
	id: crypto.randomUUID(),
	material_id: item.material_id,
	purchase_order_list_id: item.purchase_order_list_id,
	purchase_receipt_list_qty: Number(item.purchase_order_list_balance_qty || 0),
	purchase_receipt_list_price: Number(item.purchase_order_list_price || 0),
	product_unit_id: Number(item.product_unit_id || 0),
	ordered_qty: Number(item.purchase_order_list_balance_qty || 0),
	material_name: item.material?.material_name,
	product_unit_name: item.productUnit?.product_unit_name,
	material: item.material,
	productUnit: item.productUnit,
});

export default function InsertPurchaseReceiptForm({ isOpen, onClose, onSuccess, purchaseOrder }: InsertPurchaseReceiptFormProps) {
	const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
	const [receiptDetail, setReceiptDetail] = useState('');
	const [items, setItems] = useState<ReceiptItemForm[]>([]);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoadingItems, setIsLoadingItems] = useState(false);

	const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
	const [selectionRows, setSelectionRows] = useState<PurchaseOrderItem[]>([]);
	const [selectionMeta, setSelectionMeta] = useState<PaginationMeta | null>(null);
	const [selectionPage, setSelectionPage] = useState(1);
	const [selectionSearch, setSelectionSearch] = useState('');
	const [selectionAppliedSearch, setSelectionAppliedSearch] = useState('');
	const [selectionSortField, setSelectionSortField] = useState<SelectionSortField>(null);
	const [selectionSortOrder, setSelectionSortOrder] = useState<SortOrder>('ASC');
	const [isSelectionLoading, setIsSelectionLoading] = useState(false);
	const [selectedOrderItems, setSelectedOrderItems] = useState<Record<string, PurchaseOrderItem>>({});

	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		action: ActionResultDialogAction;
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		action: 'insert',
		message: '',
	});

	const existingItemIds = useMemo(() => new Set(items.map((item) => String(item.purchase_order_list_id))), [items]);

	useEffect(() => {
		if (isOpen && purchaseOrder?.purchase_order_id) {
			void loadInitialPurchaseOrderItems(purchaseOrder.purchase_order_id);
			setEntryDate(new Date().toISOString().slice(0, 10));
			setReceiptDetail('');
			setErrors({});
		}
	}, [isOpen, purchaseOrder?.purchase_order_id]);

	useEffect(() => {
		if (!isSelectModalOpen || !purchaseOrder?.purchase_order_id) {
			return;
		}
		void fetchSelectionItems();
	}, [
		isSelectModalOpen,
		purchaseOrder?.purchase_order_id,
		selectionPage,
		selectionAppliedSearch,
		selectionSortField,
		selectionSortOrder,
		items,
	]);

	const loadInitialPurchaseOrderItems = async (purchaseOrderId: string) => {
		try {
			setIsLoadingItems(true);
			const response = await purchaseOrderListModel.getPurchaseOrderItems(purchaseOrderId, 1, 500);
			if (response.data) {
				response.data.forEach((item) => {
					item.material_id = item.material?.material_id || item.material_id;
					item.product_unit_id = item.productUnit?.product_unit_id || item.product_unit_id;
				});
			}
			setItems((response.data || []).map(mapOrderItemToFormItem));
		} catch (error) {
			console.error('Failed to load purchase order items:', error);
			setItems([]);
			setResultDialog({
				isOpen: true,
				status: 'error',
				action: 'insert',
				message: error instanceof Error ? error.message : 'ไม่สามารถโหลดรายการวัตถุดิบได้',
			});
		} finally {
			setIsLoadingItems(false);
		}
	};

	const fetchSelectionItems = async () => {
		if (!purchaseOrder?.purchase_order_id) {
			return;
		}

		try {
			setIsSelectionLoading(true);
            const excludeIds = Array.from(existingItemIds).join(',');
			const response: PurchaseOrderItemResponse = await purchaseOrderListModel.getPurchaseOrderItems(
				purchaseOrder.purchase_order_id,
				selectionPage,
				10,
				selectionAppliedSearch,
				selectionSortField,
				selectionSortOrder,
                excludeIds ,
			);
            if (response.data) {
				response.data.forEach((item) => {
					item.material_id = item.material?.material_id || item.material_id;
					item.product_unit_id = item.productUnit?.product_unit_id || item.product_unit_id;
				});
			}
            
			setSelectionRows(response.data || []);
			setSelectionMeta(response.meta || null);
		} catch (error) {
			console.error('Failed to fetch selectable purchase order items:', error);
			setSelectionRows([]);
			setSelectionMeta(null);
		}
		finally {
			setIsSelectionLoading(false);
		}
	};

	const calculateItemTotal = (item: ReceiptItemForm) => Number(item.purchase_receipt_list_qty) * Number(item.purchase_receipt_list_price);

	const grandTotal = useMemo(() => items.reduce((sum, item) => sum + calculateItemTotal(item), 0), [items]);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('th-TH', {
			style: 'decimal',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const updateItem = (id: string, field: keyof ReceiptItemForm, value: number) => {
		setItems((prev) =>
			prev.map((item) => {
				if (item.id !== id) {
					return item;
				}

				if (field === 'purchase_receipt_list_qty') {
					const nextQty = Number.isNaN(value) ? 0 : Math.min(value, item.ordered_qty);
					return { ...item, purchase_receipt_list_qty: nextQty };
				}

				return {
					...item,
					[field]: Number.isNaN(value) ? 0 : value,
				};
			}),
		);
	};

	const handleRemoveItem = (id: string) => {
		setItems((prev) => prev.filter((item) => item.id !== id));
	};

	const openSelectModal = () => {
		setSelectionPage(1);
		setSelectionSearch('');
		setSelectionAppliedSearch('');
		setSelectionSortField(null);
		setSelectionSortOrder('ASC');
		setSelectedOrderItems({});
		setIsSelectModalOpen(true);
	};

	const toggleOrderItemSelection = (item: PurchaseOrderItem) => {
		const itemId = String(item.purchase_order_list_id);
		setSelectedOrderItems((prev) => {
			if (prev[itemId]) {
				const next = { ...prev };
				delete next[itemId];
				return next;
			}
			return { ...prev, [itemId]: item };
		});
	};

	const toggleSelectAllCurrentPage = () => {
		const currentIds = selectionRows.map((row) => String(row.purchase_order_list_id));
		const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedOrderItems[id]);

		setSelectedOrderItems((prev) => {
			const next = { ...prev };
			if (allSelected) {
				currentIds.forEach((id) => delete next[id]);
				return next;
			}
			selectionRows.forEach((row) => {
				next[String(row.purchase_order_list_id)] = row;
			});
			return next;
		});
	};

	const addSelectedItems = () => {
		const selectedValues = Object.values(selectedOrderItems).filter(
			(item) => !existingItemIds.has(String(item.purchase_order_list_id)),
		);

		if (selectedValues.length === 0) {
			return;
		}

		setItems((prev) => [...prev, ...selectedValues.map(mapOrderItemToFormItem)]);
		setIsSelectModalOpen(false);
		setSelectedOrderItems({});
	};

	const handleSelectionSearch = () => {
		setSelectionPage(1);
		setSelectionAppliedSearch(selectionSearch.trim());
	};

	const handleSelectionClearSearch = () => {
		setSelectionSearch('');
		setSelectionAppliedSearch('');
		setSelectionPage(1);
	};

	const handleSelectionSort = (field: Exclude<SelectionSortField, null>) => {
		if (selectionSortField === field) {
			setSelectionSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
		} else {
			setSelectionSortField(field);
			setSelectionSortOrder('ASC');
		}
		setSelectionPage(1);
	};

	const validate = () => {
		const nextErrors: Record<string, string> = {};

		if (!purchaseOrder?.purchase_order_id) {
			nextErrors.purchase_order_id = 'ไม่พบข้อมูลใบสั่งซื้อ';
		}
		if (!entryDate) {
			nextErrors.entry_date = 'กรุณาเลือกวันที่รับสินค้า';
		}
		if (items.length === 0) {
			nextErrors.items = 'ไม่พบรายการวัตถุดิบในใบสั่งซื้อ';
		}

		items.forEach((item, index) => {
			if (!item.purchase_order_list_id) {
				nextErrors[`item_${index}_material`] = 'กรุณาเลือกรายการวัตถุดิบ';
			}
			if (item.purchase_receipt_list_qty <= 0) {
				nextErrors[`item_${index}_qty`] = 'จำนวนรับต้องมากกว่า 0';
			}
			if (item.purchase_receipt_list_qty > item.ordered_qty) {
				nextErrors[`item_${index}_qty`] = 'จำนวนรับต้องไม่มากกว่าจำนวนที่สั่งซื้อ';
			}
			if (item.purchase_receipt_list_price < 0) {
				nextErrors[`item_${index}_price`] = 'ราคาต้องไม่ติดลบ';
			}
		});

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const resetAndClose = () => {
		setEntryDate(new Date().toISOString().slice(0, 10));
		setReceiptDetail('');
		setItems([]);
		setSelectedOrderItems({});
		setIsSelectModalOpen(false);
		setErrors({});
		onClose();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) {
			return;
		}

		setIsSubmitting(true);
		try {
			const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
			if (!user) {
				throw new Error('User not authenticated');
			}

			await purchaseReceiptModel.createPurchaseReceipt({
				purchase_order_id: purchaseOrder!.purchase_order_id,
				supplier_id: purchaseOrder!.supplier_id || purchaseOrder!.supplier?.supplier_id || '',
				entry_date: entryDate,
				purchase_receipt_detail: receiptDetail,
				purchase_receipt_total: grandTotal,
				create_by: user.employee_id,
				purchaseReceiptLists: items.map((item) => ({
					material_id: item.material_id,
					purchase_order_list_id: item.purchase_order_list_id,
					purchase_receipt_list_qty: Number(item.purchase_receipt_list_qty),
					purchase_receipt_list_price: Number(item.purchase_receipt_list_price),
					purchase_receipt_list_total: calculateItemTotal(item),
					product_unit_id: Number(item.product_unit_id),
				})),
			});

			setResultDialog({
				isOpen: true,
				status: 'success',
				action: 'insert',
				message: 'สร้างใบรับสินค้าสำเร็จ',
			});
		} catch (error) {
			console.error('Failed to create purchase receipt:', error);
			setResultDialog({
				isOpen: true,
				status: 'error',
				action: 'insert',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างใบรับสินค้า',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResultDialogClose = () => {
		const isSuccess = resultDialog.status === 'success';
		setResultDialog((prev) => ({ ...prev, isOpen: false }));
		if (isSuccess) {
			onSuccess();
			resetAndClose();
		}
	};

	if (!isOpen) {
		return null;
	}

	const selectedCount = Object.keys(selectedOrderItems).length;
	const showSelectionPagination = (selectionMeta?.total || 0) > 10 && (selectionMeta?.last_page || 0) > 1;
	const allCurrentPageSelected =
		selectionRows.length > 0 && selectionRows.every((row) => selectedOrderItems[String(row.purchase_order_list_id)]);

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-300/40 p-4 backdrop-blur-sm">
				<div className="w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-800">
					<div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-5 shadow-lg">
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-2xl font-bold text-white">สร้างใบรับสินค้า</h2>
							<button
								onClick={resetAndClose}
								disabled={isSubmitting}
								className="rounded-xl p-2 text-white transition-all duration-200 hover:bg-white/20 hover:text-black disabled:opacity-50"
								type="button"
							>
								<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>

					<form onSubmit={handleSubmit} className="max-h-[calc(90vh-160px)] overflow-y-auto p-6">
						<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
							<div>
								<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">เลขที่ใบสั่งซื้อ</label>
								<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
									{purchaseOrder?.purchase_order_code || purchaseOrder?.purchase_order_id || '-'}
								</div>
							</div>
							<div>
								<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">ผู้จัดจำหน่าย</label>
								<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
									{purchaseOrder?.supplier?.supplier_name || '-'}
								</div>
							</div>
							<div>
								<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">วันที่รับสินค้า</label>
								<input
									type="date"
									value={entryDate}
									onChange={(e) => setEntryDate(e.target.value)}
									className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100"
									disabled={isSubmitting}
								/>
								{errors.entry_date && <p className="mt-1 text-sm text-red-500">{errors.entry_date}</p>}
							</div>
						</div>

						<div className="mb-6">
							<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รายละเอียดใบรับสินค้า</label>
							<textarea
								rows={3}
								value={receiptDetail}
								onChange={(e) => setReceiptDetail(e.target.value)}
								className="w-full resize-none rounded-xl border border-gray-300 px-4 py-2 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100"
								placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
								disabled={isSubmitting}
							/>
						</div>

						<div className="mb-4 flex items-center justify-between">
							<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">รายการวัตถุดิบอ้างอิงจากใบสั่งซื้อ</h3>
							<button
								type="button"
								onClick={openSelectModal}
								disabled={isSubmitting}
								className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								เพิ่มรายการ
							</button>
						</div>

						{isLoadingItems ? (
							<div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
								กำลังโหลดรายการวัตถุดิบ...
							</div>
						) : (
							<div className="space-y-4">
								{items.map((item, index) => (
									<div key={item.id} className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
										<div className="mb-3 flex items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{index + 1}</span>
											</div>
											<button
												type="button"
												onClick={() => handleRemoveItem(item.id)}
												disabled={isSubmitting || items.length <= 1}
												className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300"
											>
												ลบ
											</button>
										</div>

										<div className="grid grid-cols-1 gap-4 md:grid-cols-5">
											<div>
												<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ชื่อวัตถุดิบ</label>
												<div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">{item.material?.material_name || item.material_id}</div>
												{errors[`item_${index}_material`] && <p className="mt-1 text-xs text-red-500">{errors[`item_${index}_material`]}</p>}
											</div>
											<div>
												<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">จำนวนรับ</label>
												<input
													type="number"
													min={0}
													max={item.ordered_qty}
													step="0.01"
													value={item.purchase_receipt_list_qty}
													onChange={(e) => updateItem(item.id, 'purchase_receipt_list_qty', Number(e.target.value))}
													className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100"
													disabled={isSubmitting}
												/>
												<p className="mt-1 text-[11px] text-gray-500">จำนวนสั่งซื้อ: {item.ordered_qty}</p>
												{errors[`item_${index}_qty`] && <p className="mt-1 text-xs text-red-500">{errors[`item_${index}_qty`]}</p>}
											</div>
											<div>
												<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ราคา/หน่วย</label>
												<input
													type="number"
													min={0}
													step="0.01"
													value={item.purchase_receipt_list_price}
													onChange={(e) => updateItem(item.id, 'purchase_receipt_list_price', Number(e.target.value))}
													className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100"
													disabled={isSubmitting}
												/>
												{errors[`item_${index}_price`] && <p className="mt-1 text-xs text-red-500">{errors[`item_${index}_price`]}</p>}
											</div>
											<div>
												<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">หน่วย</label>
												<div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">{item.productUnit?.product_unit_name || item.product_unit_id || '-'}</div>
											</div>
											<div>
												<label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ยอดรวม</label>
												<div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">฿{formatCurrency(calculateItemTotal(item))}</div>
											</div>
										</div>
									</div>
								))}
							</div>
						)}

						{errors.items && <p className="mt-3 text-sm text-red-500">{errors.items}</p>}

						<div className="mt-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 shadow-lg">
							<div className="flex items-center justify-between">
								<span className="text-lg font-semibold text-white">ยอดรวมทั้งสิ้น</span>
								<span className="text-2xl font-bold text-white">฿{formatCurrency(grandTotal)}</span>
							</div>
						</div>

						<div className="mt-6 flex gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
							<button type="button" onClick={resetAndClose} disabled={isSubmitting} className="w-full rounded-xl border-2 border-gray-300 bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">ยกเลิก</button>
							<button type="submit" disabled={isSubmitting || isLoadingItems} className="w-full rounded-xl border-2 border-blue-600 bg-blue-600 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-60">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกใบรับสินค้า'}</button>
						</div>
					</form>
				</div>
			</div>

			{isSelectModalOpen && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
						<div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">เลือกรายการวัตถุดิบเพื่อเพิ่ม</h3>
							<button
								type="button"
								onClick={() => {
									setIsSelectModalOpen(false);
									setSelectedOrderItems({});
								}}
								className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
							>
								✕
							</button>
						</div>

						<div className="border-b border-gray-200 p-4 dark:border-gray-700">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex flex-1 gap-2">
									<input
										type="text"
										placeholder="ค้นหาวัตถุดิบ..."
										value={selectionSearch}
										onChange={(e) => setSelectionSearch(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleSelectionSearch()}
										className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
									/>
									<button type="button" onClick={handleSelectionSearch} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">ค้นหา</button>
									{(selectionSearch || selectionAppliedSearch) && (
										<button type="button" onClick={handleSelectionClearSearch} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">ล้าง</button>
									)}
								</div>
							</div>
						</div>

						<div className="max-h-[55vh] overflow-auto p-4">
							<table className="w-full text-sm">
								<thead>
									<tr className="bg-gray-100 text-left text-gray-700 dark:bg-gray-700 dark:text-gray-200">
										<th className="w-14 px-3 py-2">
											<input type="checkbox" checked={allCurrentPageSelected} onChange={toggleSelectAllCurrentPage} />
										</th>
										<th className="px-3 py-2">วัตถุดิบ</th>
										<th className="px-3 py-2">จำนวนสั่งซื้อ</th>
										<th className="px-3 py-2">
											<button type="button" className="flex items-center gap-1 font-semibold" onClick={() => handleSelectionSort('purchase_order_list_price')}>
												ราคา/หน่วย
												{selectionSortField === 'purchase_order_list_price' && <span>{selectionSortOrder === 'ASC' ? '↑' : '↓'}</span>}
											</button>
										</th>
										<th className="px-3 py-2">หน่วย</th>
										<th className="px-3 py-2">
											<button type="button" className="flex items-center gap-1 font-semibold" onClick={() => handleSelectionSort('purchase_order_list_total')}>
												ยอดรวม
												{selectionSortField === 'purchase_order_list_total' && <span>{selectionSortOrder === 'ASC' ? '↑' : '↓'}</span>}
											</button>
										</th>
									</tr>
								</thead>
								<tbody>
									{isSelectionLoading ? (
										<tr>
											<td colSpan={6} className="px-3 py-6 text-center text-gray-500">กำลังโหลดข้อมูล...</td>
										</tr>
									) : selectionRows.length === 0 ? (
										<tr>
											<td colSpan={6} className="px-3 py-6 text-center text-gray-500">ไม่พบรายการที่เลือกได้</td>
										</tr>
									) : (
										selectionRows.map((orderItem) => {
											const itemId = String(orderItem.purchase_order_list_id);
											const total = Number(orderItem.purchase_order_list_qty || 0) * Number(orderItem.purchase_order_list_price || 0);
											return (
												<tr key={itemId} className="border-b border-gray-100 dark:border-gray-700">
													<td className="px-3 py-2">
														<input
															type="checkbox"
															checked={Boolean(selectedOrderItems[itemId])}
															onChange={() => toggleOrderItemSelection(orderItem)}
														/>
													</td>
													<td className="px-3 py-2 text-gray-900 dark:text-gray-100">{orderItem.material?.material_name || orderItem.material_id}</td>
													<td className="px-3 py-2">{orderItem.purchase_order_list_qty}</td>
													<td className="px-3 py-2">฿{formatCurrency(Number(orderItem.purchase_order_list_price || 0))}</td>
													<td className="px-3 py-2">{orderItem.productUnit?.product_unit_name || orderItem.product_unit_id || '-'}</td>
													<td className="px-3 py-2 font-semibold text-blue-600">฿{formatCurrency(total)}</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>

						{showSelectionPagination && (
							<Pagination meta={selectionMeta} currentPage={selectionPage} onPageChange={setSelectionPage} />
						)}

						<div className="flex items-center justify-between border-t border-gray-200 px-5 py-4 dark:border-gray-700">
							<p className="text-sm text-gray-600 dark:text-gray-300">เลือกแล้ว {selectedCount} รายการ</p>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => {
										setIsSelectModalOpen(false);
										setSelectedOrderItems({});
									}}
									className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
								>
									ยกเลิก
								</button>
								<button
									type="button"
									onClick={addSelectedItems}
									disabled={selectedCount === 0}
									className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									เพิ่มรายการที่เลือก
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

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
