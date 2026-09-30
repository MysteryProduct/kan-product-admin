'use client';

import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import Modal from '@/components/Modal';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import Pagination from '@/components/Pagination';
import { PurchaseReceipt, PurchaseReceiptListItem } from '@/types/purchase-receipt';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import PurchaseOrderListModel from '@/models/purchase-order-list';
import { PurchaseOrderItem } from '@/types/purchase-order-list';
import { PaginationMeta } from '@/types/pagination';
import { calculateVatSummary, VAT_TYPE_LABELS, VAT_TYPE_OPTIONS, VatType } from '@/lib/vat';
import useVatRate from '@/hooks/useVatRate';
import { toDateInputValue } from '@/lib/date-format';

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
}

interface UpdatePurchaseReceiptFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	initialData: PurchaseReceipt;
}

type SelectionSortField = 'purchase_order_list_price' | 'purchase_order_list_total' | null;
type SortOrder = 'ASC' | 'DESC';

const purchaseReceiptModel = new PurchaseReceiptModel();
const purchaseOrderListModel = new PurchaseOrderListModel();

const mapOrderItemToFormItem = (item: PurchaseOrderItem): ReceiptItemForm => ({
	id: crypto.randomUUID(),
	material_id: item.material_id,
	purchase_order_list_id: item.purchase_order_list_id,
	purchase_receipt_list_qty: Number(item.purchase_order_list_qty || 0),
	purchase_receipt_list_price: Number(item.purchase_order_list_price || 0),
	product_unit_id: Number(item.product_unit_id || 0),
	ordered_qty: Number(item.purchase_order_list_qty || 0),
	material_name: item.material?.material_name,
	product_unit_name: item.productUnit?.product_unit_name,
});

export default function UpdatePurchaseReceiptForm({ isOpen, onClose, onSuccess, initialData }: UpdatePurchaseReceiptFormProps) {
	const vatRate = useVatRate();
	const [entryDate, setEntryDate] = useState<string>('');
	const [receiptDetail, setReceiptDetail] = useState('');
	const [vatType, setVatType] = useState<VatType>('none');
	const [items, setItems] = useState<ReceiptItemForm[]>([]);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

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
		action: 'update',
		message: '',
	});

	const existingItemIds = useMemo(() => new Set(items.map((item) => String(item.purchase_order_list_id))), [items]);

	useEffect(() => {
		if (!isOpen || !initialData) {
			return;
		}

		setEntryDate(toDateInputValue(initialData.entry_date));
		setReceiptDetail(initialData.purchase_receipt_detail || initialData.purchase_receipt_detail || '');
		setVatType(initialData.vat_type || 'none');
		setItems(
			(initialData.purchaseReceiptLists || []).map((item: PurchaseReceiptListItem) => ({
				id: crypto.randomUUID(),
				material_id:
					item.material?.material_id ||
					item.purchaseOrderList?.material?.material_id ||
					item.purchaseOrderList?.material_id ||
					item.material_id,
				purchase_order_list_id: item.purchase_order_list_id,
				purchase_receipt_list_qty: Number(item.purchase_receipt_list_qty || 0),
				purchase_receipt_list_price: Number(item.purchase_receipt_list_price || 0),
				product_unit_id: Number(item.product_unit_id || 0),
				ordered_qty: Number((item.purchaseOrderList?.purchase_order_list_balance_qty || 0) + (item.purchase_receipt_list_qty || 0)),
				material_name: item.material?.material_name || item.purchaseOrderList?.material?.material_name,
				product_unit_name: item.productUnit?.product_unit_name,
			})),
		);
		setErrors({});
	}, [isOpen, initialData]);

	useEffect(() => {
		if (!isSelectModalOpen || !initialData?.purchase_order_id) {
			return;
		}
		void fetchSelectionItems();
	}, [
		isSelectModalOpen,
		initialData?.purchase_order_id,
		selectionPage,
		selectionAppliedSearch,
		selectionSortField,
		selectionSortOrder,
		items,
	]);

	const fetchSelectionItems = async () => {
		if (!initialData?.purchase_order_id) {
			return;
		}

		try {
			setIsSelectionLoading(true);
			const excludeIds = Array.from(existingItemIds).join(',');
			const response = await purchaseOrderListModel.getPurchaseOrderItems(
				initialData.purchase_order_id,
				selectionPage,
				10,
				selectionAppliedSearch,
				selectionSortField,
				selectionSortOrder,
				excludeIds,
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
		} finally {
			setIsSelectionLoading(false);
		}
	};

	const calculateItemTotal = (item: ReceiptItemForm) => Number(item.purchase_receipt_list_qty) * Number(item.purchase_receipt_list_price);
	const grandTotal = useMemo(() => items.reduce((sum, item) => sum + calculateItemTotal(item), 0), [items]);
	const vatSummary = useMemo(() => calculateVatSummary(grandTotal, vatType, vatRate), [grandTotal, vatType, vatRate]);

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
				return { ...item, [field]: Number.isNaN(value) ? 0 : value };
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
		if (!entryDate) {
			nextErrors.entry_date = 'กรุณาเลือกวันที่รับสินค้า';
		}
		if (items.length === 0) {
			nextErrors.items = 'ไม่พบรายการวัตถุดิบในใบรับสินค้า';
		}
		items.forEach((item, index) => {
			if (!item.purchase_order_list_id || !item.material_id) {
				nextErrors[`item_${index}_material`] = 'กรุณาเลือกรายการวัตถุดิบ';
			}
			if (!Number.isInteger(item.purchase_receipt_list_qty)) {
				nextErrors[`item_${index}_qty`] = 'จำนวนรับต้องเป็นจำนวนเต็ม';
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

			await purchaseReceiptModel.updatePurchaseReceipt({
				purchase_receipt_id: initialData.purchase_receipt_id,
				purchase_order_id: initialData.purchase_order_id,
				supplier_id: initialData.supplier_id,
				entry_date: entryDate,
				purchase_receipt_detail: receiptDetail,
				vat_type: vatType,
				purchase_receipt_subtotal: vatSummary.subtotal,
				purchase_receipt_vat_amount: vatSummary.vatAmount,
				purchase_receipt_total: vatSummary.total,
				update_by: user.employee_id,
				create_by: initialData.create_by,
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
				action: 'update',
				message: 'แก้ไขใบรับสินค้าสำเร็จ',
			});
		} catch (error) {
			console.error('Failed to update purchase receipt:', error);
			setResultDialog({
				isOpen: true,
				status: 'error',
				action: 'update',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการแก้ไขใบรับสินค้า',
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
			onClose();
		}
	};

	if (!isOpen) {
		return null;
	}

	const selectedCount = Object.keys(selectedOrderItems).length;
	const showSelectionPagination = (selectionMeta?.total || 0) > 10 && (selectionMeta?.last_page || 0) > 1;
	const allCurrentPageSelected = selectionRows.length > 0 && selectionRows.every((row) => selectedOrderItems[String(row.purchase_order_list_id)]);

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={() => { if (!isSubmitting) onClose(); }}
				title="แก้ไขใบรับสินค้า"
				size="xl"
				closeOnBackdrop={!isSubmitting && !isSelectModalOpen && !resultDialog.isOpen}
				closeOnEscape={!isSubmitting && !isSelectModalOpen && !resultDialog.isOpen}
				footer={
					<>
						<button type="button" onClick={onClose} disabled={isSubmitting} className="ka-btn w-full">ยกเลิก</button>
						<button type="submit" form="purchase-receipt-update-form" disabled={isSubmitting} className="ka-btn ka-btn--primary min-h-11 w-full">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</button>
					</>
				}
			>
				<form id="purchase-receipt-update-form" onSubmit={handleSubmit}>
					<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">เลขที่ใบรับสินค้า</label>
							<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">{initialData.purchase_receipt_code || initialData.purchase_receipt_id}</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">เลขที่ใบสั่งซื้อ</label>
							<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">{initialData.purchaseOrder?.purchase_order_code || initialData.purchase_order_id}</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รูปแบบ VAT</label>
							<select
								value={vatType}
								onChange={(e) => setVatType(e.target.value as VatType)}
								className="ka-input w-full"
								disabled={isSubmitting}
							>
								{VAT_TYPE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">วันที่รับสินค้า</label>
							<input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="ka-input w-full" disabled={isSubmitting} />
							{errors.entry_date && <p className="mt-1 text-sm text-[var(--danger)]">{errors.entry_date}</p>}
						</div>
					</div>

					<div className="mb-6">
						<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รายละเอียดใบรับสินค้า</label>
						<textarea rows={3} value={receiptDetail} onChange={(e) => setReceiptDetail(e.target.value)} className="ka-textarea w-full resize-none" placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)" disabled={isSubmitting} />
					</div>

					<div className="mb-4 flex items-center justify-between">
						<h3 className="text-lg font-bold text-[var(--ink)]">รายการวัตถุดิบอ้างอิงจากใบสั่งซื้อ</h3>
						<button type="button" onClick={openSelectModal} disabled={isSubmitting} className="ka-btn ka-btn--primary min-h-11">เพิ่มรายการ</button>
					</div>

					<div className="space-y-4">
						{items.map((item, index) => (
							<div key={item.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
								<div className="mb-3 flex items-center justify-between gap-2">
									<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand-ink)]">{index + 1}</span>
									<button type="button" onClick={() => handleRemoveItem(item.id)} disabled={isSubmitting || items.length <= 1} className="rounded-lg bg-[var(--danger-soft)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-50">ลบ</button>
								</div>

								<div className="grid grid-cols-1 gap-4 md:grid-cols-5">
									<div><label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">วัตถุดิบ</label><div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--ink)]">{item.material_name || item.material_id || '-'}</div>{errors[`item_${index}_material`] && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors[`item_${index}_material`]}</p>}</div>
									<div>
										<label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">จำนวนรับ</label>
										<input type="number" min={0} max={item.ordered_qty} step="1" value={item.purchase_receipt_list_qty} onChange={(e) => updateItem(item.id, 'purchase_receipt_list_qty', Number(e.target.value))} className="ka-input w-full" disabled={isSubmitting} />
										<p className="mt-1 text-[11px] text-[var(--ink-muted)]">จำนวนสั่งซื้อ: {item.ordered_qty}</p>
										{errors[`item_${index}_qty`] && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors[`item_${index}_qty`]}</p>}
									</div>
									<div>
										<label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">ราคา/หน่วย</label>
										<input type="number" min={0} step="0.01" value={item.purchase_receipt_list_price} onChange={(e) => updateItem(item.id, 'purchase_receipt_list_price', Number(e.target.value))} className="ka-input w-full" disabled={isSubmitting} />
										{errors[`item_${index}_price`] && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors[`item_${index}_price`]}</p>}
									</div>
									<div><label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">หน่วย</label><div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--ink)]">{item.product_unit_name || item.product_unit_id || '-'}</div></div>
									<div><label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">ยอดรวม</label><div className="rounded-xl border border-[var(--brand-soft)] bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-ink)]">฿{formatCurrency(calculateItemTotal(item))}</div></div>
								</div>
							</div>
						))}
					</div>

					{errors.items && <p className="mt-3 text-sm text-[var(--danger)]">{errors.items}</p>}

					<div className="mt-6 space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 text-[var(--color-text-primary)]">
						<div className="flex items-center justify-between text-sm md:text-base">
							<span>ยอดก่อน VAT</span>
							<span>฿{formatCurrency(vatSummary.subtotal)}</span>
						</div>
						<div className="flex items-center justify-between text-sm md:text-base">
							<span>VAT {vatRate}% ({VAT_TYPE_LABELS[vatType]})</span>
							<span>฿{formatCurrency(vatSummary.vatAmount)}</span>
						</div>
						<div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
							<span className="text-lg font-semibold">ยอดรวมทั้งสิ้น</span>
							<span className="text-2xl font-bold">฿{formatCurrency(vatSummary.total)}</span>
						</div>
					</div>
				</form>
			</Modal>

			<Modal
				isOpen={isSelectModalOpen}
				onClose={() => { setIsSelectModalOpen(false); setSelectedOrderItems({}); }}
				title="เลือกรายการวัตถุดิบเพื่อเพิ่ม"
				size="xl"
				layer="elevated"
				footer={
					<div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm text-[var(--ink-muted)]">เลือกแล้ว {selectedCount} รายการ</p>
						<div className="flex gap-2">
							<button type="button" onClick={() => { setIsSelectModalOpen(false); setSelectedOrderItems({}); }} className="ka-btn">ยกเลิก</button>
							<button type="button" onClick={addSelectedItems} disabled={selectedCount === 0} className="ka-btn ka-btn--primary min-h-11">เพิ่มรายการที่เลือก</button>
						</div>
					</div>
				}
			>
				<div className="border-b border-[var(--border)] pb-4">
					<div className="flex flex-1 gap-2">
						<input type="text" placeholder="ค้นหาวัตถุดิบ..." value={selectionSearch} onChange={(e) => setSelectionSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSelectionSearch()} className="ka-input w-full" />
						<button type="button" onClick={handleSelectionSearch} className="ka-btn ka-btn--primary min-h-11">ค้นหา</button>
						{(selectionSearch || selectionAppliedSearch) && <button type="button" onClick={handleSelectionClearSearch} className="ka-btn">ล้าง</button>}
					</div>
				</div>

				<div className="max-h-[55vh] overflow-auto py-4">
					<table className="w-full text-sm">
						<thead>
							<tr className="bg-[var(--bg-muted)] text-left text-[var(--ink)]">
								<th className="w-14 px-3 py-2"><label className="ka-check-hit"><input type="checkbox" className="ka-check" aria-label="เลือกทั้งหมดในหน้านี้" checked={allCurrentPageSelected} onChange={toggleSelectAllCurrentPage} /></label></th>
								<th className="px-3 py-2">วัตถุดิบ</th>
								<th className="px-3 py-2">จำนวนสั่งซื้อ</th>
								<th className="px-3 py-2"><button type="button" className="flex items-center gap-1 font-semibold" onClick={() => handleSelectionSort('purchase_order_list_price')}>ราคา/หน่วย{selectionSortField === 'purchase_order_list_price' && <span>{selectionSortOrder === 'ASC' ? '↑' : '↓'}</span>}</button></th>
								<th className="px-3 py-2">หน่วย</th>
								<th className="px-3 py-2"><button type="button" className="flex items-center gap-1 font-semibold" onClick={() => handleSelectionSort('purchase_order_list_total')}>ยอดรวม{selectionSortField === 'purchase_order_list_total' && <span>{selectionSortOrder === 'ASC' ? '↑' : '↓'}</span>}</button></th>
							</tr>
						</thead>
						<tbody>
							{isSelectionLoading ? (
								<tr><td colSpan={6} className="px-3 py-6 text-center text-[var(--ink-muted)]">กำลังโหลดข้อมูล...</td></tr>
							) : selectionRows.length === 0 ? (
								<tr><td colSpan={6} className="px-3 py-6 text-center text-[var(--ink-muted)]">ไม่พบรายการที่เลือกได้</td></tr>
							) : selectionRows.map((orderItem) => {
								const itemId = String(orderItem.purchase_order_list_id);
								const total = Number(orderItem.purchase_order_list_qty || 0) * Number(orderItem.purchase_order_list_price || 0);
								return (
									<tr key={itemId} className="border-b border-[var(--border)]">
										<td className="px-3 py-2"><label className="ka-check-hit"><input type="checkbox" className="ka-check" aria-label={`เลือก ${orderItem.material?.material_name || orderItem.material_id}`} checked={Boolean(selectedOrderItems[itemId])} onChange={() => toggleOrderItemSelection(orderItem)} /></label></td>
										<td className="px-3 py-2 text-[var(--ink)]">{orderItem.material?.material_name || orderItem.material_id}</td>
										<td className="px-3 py-2">{orderItem.purchase_order_list_qty}</td>
										<td className="px-3 py-2">฿{formatCurrency(Number(orderItem.purchase_order_list_price || 0))}</td>
										<td className="px-3 py-2">{orderItem.productUnit?.product_unit_name || orderItem.product_unit_id || '-'}</td>
										<td className="px-3 py-2 font-semibold text-[var(--brand-ink)]">฿{formatCurrency(total)}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				{showSelectionPagination && <Pagination meta={selectionMeta} currentPage={selectionPage} onPageChange={setSelectionPage} />}
			</Modal>

			<ActionResultDialog isOpen={resultDialog.isOpen} status={resultDialog.status} action={resultDialog.action} message={resultDialog.message} onClose={handleResultDialogClose} />
		</>
	);
}
