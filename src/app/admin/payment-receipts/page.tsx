'use client';

import { useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { PaginationMeta } from '@/types/pagination';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import SaleOrderModel from '@/models/sale-order';
import PaymentReceiptModel from '@/models/payment-receipt';
import { SaleOrder, SaleOrderResponse } from '@/types/sale-order';
import {
	PAYMENT_METHOD_LABELS,
	PAYMENT_RECEIPT_STATUS_LABELS,
	PaymentReceipt,
	PaymentReceiptResponse,
} from '@/types/payment-receipt';
import InsertPaymentReceiptForm from './components/insert';
import UpdatePaymentReceiptForm from './components/update';
import PaymentReceiptDetailModal from './components/detail';
import ConfirmDialog from '@/components/ConfirmDialog';
import ActionResultDialog from '@/components/ActionResultDialog';
import { formatThaiDate } from '@/lib/date-format';
import { PAYMENT_RECEIPT_STATUS_TONE, SALE_ORDER_STATUS_TONE } from '@/lib/status-tones';
import StatusBadge from '@/components/StatusBadge';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import DocumentCode from '@/components/DocumentCode';

const saleOrderModel = new SaleOrderModel();
const paymentReceiptModel = new PaymentReceiptModel();

type SaleOrderSortField = 'sale_order_total' | null;
type PaymentReceiptSortField = 'payment_date' | 'amount_paid' | null;
type SortOrder = 'ASC' | 'DESC';

const formatCurrency = (amount: number) =>
	new Intl.NumberFormat('th-TH', {
		style: 'decimal',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount || 0);

export default function PaymentReceiptPage() {
	const { can } = usePermissions();
	const canAddPaymentReceipt = can('payment_receipts', 'add');
	const canEditPaymentReceipt = can('payment_receipts', 'edit');
	const canDeletePaymentReceipt = can('payment_receipts', 'delete');

	const [saleOrderPage, setSaleOrderPage] = useState(1);
	const [paymentReceiptPage, setPaymentReceiptPage] = useState(1);

	const [saleOrders, setSaleOrders] = useState<SaleOrderResponse | null>(null);
	const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceiptResponse | null>(null);

	const [saleOrderMeta, setSaleOrderMeta] = useState<PaginationMeta | null>(null);
	const [paymentReceiptMeta, setPaymentReceiptMeta] = useState<PaginationMeta | null>(null);

	const [loading, setLoading] = useState(false);
	const [saleOrdersError, setSaleOrdersError] = useState<string | null>(null);
	const [receiptsError, setReceiptsError] = useState<string | null>(null);

	const [saleOrderSortField, setSaleOrderSortField] = useState<SaleOrderSortField>(null);
	const [saleOrderSortOrder, setSaleOrderSortOrder] = useState<SortOrder>('ASC');

	const [paymentReceiptSortField, setPaymentReceiptSortField] = useState<PaymentReceiptSortField>(null);
	const [paymentReceiptSortOrder, setPaymentReceiptSortOrder] = useState<SortOrder>('ASC');

	const [saleOrderSearch, setSaleOrderSearch] = useState('');
	const [saleOrderAppliedSearch, setSaleOrderAppliedSearch] = useState('');
	const [paymentReceiptSearch, setPaymentReceiptSearch] = useState('');
	const [paymentReceiptAppliedSearch, setPaymentReceiptAppliedSearch] = useState('');

	const [isInsertOpen, setIsInsertOpen] = useState(false);
	const [isUpdateOpen, setIsUpdateOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const [selectedSaleOrder, setSelectedSaleOrder] = useState<SaleOrder | null>(null);
	const [selectedPaymentReceipt, setSelectedPaymentReceipt] = useState<PaymentReceipt | null>(null);
	const [paymentReceiptToDelete, setPaymentReceiptToDelete] = useState<PaymentReceipt | null>(null);

	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		message: '',
	});

	useEffect(() => {
		void fetchSaleOrders();
	}, [saleOrderPage, saleOrderAppliedSearch, saleOrderSortField, saleOrderSortOrder]);

	useEffect(() => {
		void fetchPaymentReceipts();
	}, [paymentReceiptPage, paymentReceiptAppliedSearch, paymentReceiptSortField, paymentReceiptSortOrder]);

	const fetchSaleOrders = async (
		page = saleOrderPage,
		search = saleOrderAppliedSearch,
		sortField = saleOrderSortField,
		sortOrder = saleOrderSortOrder,
	) => {
		try {
			setLoading(true);
			setSaleOrdersError(null);
			const response = await saleOrderModel.getSaleOrders(page, 10, search, sortField, sortOrder);
			setSaleOrders(response);
			setSaleOrderMeta(response.meta);
		} catch (error) {
			console.error('Failed to fetch sale orders:', error);
			setSaleOrdersError(loadErrorText('รายการใบสั่งขาย', error));
		} finally {
			setLoading(false);
		}
	};

	const fetchPaymentReceipts = async (
		page = paymentReceiptPage,
		search = paymentReceiptAppliedSearch,
		sortField = paymentReceiptSortField,
		sortOrder = paymentReceiptSortOrder,
	) => {
		try {
			setLoading(true);
			setReceiptsError(null);
			const response = await paymentReceiptModel.getPaymentReceipts(page, 10, search, sortField, sortOrder);
			setPaymentReceipts(response);
			setPaymentReceiptMeta(response.meta);
		} catch (error) {
			console.error('Failed to fetch payment receipts:', error);
			setReceiptsError(loadErrorText('รายการใบเสร็จรับเงิน', error));
		} finally {
			setLoading(false);
		}
	};

	const handleSaleOrderSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
		if (!sort) {
			setSaleOrderSortField(null);
			setSaleOrderSortOrder('ASC');
			return;
		}
		const nextField = sort.key as SaleOrderSortField;
		if (nextField !== 'sale_order_total') {
			setSaleOrderSortField(null);
			setSaleOrderSortOrder('ASC');
			return;
		}
		setSaleOrderSortField(nextField);
		setSaleOrderSortOrder(sort.direction);
	};

	const handlePaymentReceiptSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
		if (!sort) {
			setPaymentReceiptSortField(null);
			setPaymentReceiptSortOrder('ASC');
			return;
		}
		const nextField = sort.key as PaymentReceiptSortField;
		if (nextField !== 'payment_date' && nextField !== 'amount_paid') {
			setPaymentReceiptSortField(null);
			setPaymentReceiptSortOrder('ASC');
			return;
		}
		setPaymentReceiptSortField(nextField);
		setPaymentReceiptSortOrder(sort.direction);
	};

	const handleDeletePaymentReceipt = async () => {
		if (!paymentReceiptToDelete) {
			return;
		}

		try {
			await paymentReceiptModel.deletePaymentReceipt(paymentReceiptToDelete.payment_receipt_id);
			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'ลบใบเสร็จรับเงินสำเร็จ',
			});
			setIsDeleteDialogOpen(false);
			setPaymentReceiptToDelete(null);

			const nextPage =
				paymentReceiptPage > 1 && (paymentReceipts?.data.length || 0) === 1 ? paymentReceiptPage - 1 : paymentReceiptPage;
			if (nextPage !== paymentReceiptPage) {
				setPaymentReceiptPage(nextPage);
			}

			await Promise.all([
				fetchPaymentReceipts(nextPage, paymentReceiptAppliedSearch, paymentReceiptSortField, paymentReceiptSortOrder),
				fetchSaleOrders(),
			]);
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบใบเสร็จรับเงิน',
			});
		}
	};

	const openPaymentReceiptDetail = async (paymentReceipt: PaymentReceipt) => {
		try {
			const detail = await paymentReceiptModel.getPaymentReceiptById(paymentReceipt.payment_receipt_id);
			setSelectedPaymentReceipt(detail);
			setIsDetailOpen(true);
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถโหลดรายละเอียดใบเสร็จรับเงินได้',
			});
		}
	};

	const openPaymentReceiptUpdate = async (paymentReceipt: PaymentReceipt) => {
		try {
			const detail = await paymentReceiptModel.getPaymentReceiptById(paymentReceipt.payment_receipt_id);
			setSelectedPaymentReceipt(detail);
			setIsUpdateOpen(true);
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลเพื่อแก้ไขใบเสร็จรับเงินได้',
			});
		}
	};

	const saleOrderColumns: DataTableColumn<SaleOrder>[] = [
		{
			key: 'sale_order_code',
			label: 'รหัสใบสั่งขาย',
			width: '200px',
			render: (_, row) => (
				<DocumentCode
					code={row.sale_order_code || row.sale_order_id}
					legacyCode={row.legacy_code}
					search={saleOrderAppliedSearch}
				/>
			),
		},
		{
			key: 'sale_order_name',
			label: 'ชื่อใบสั่งขาย',
		},
		{
			key: 'sale_order_total',
			label: 'ยอดรวม',
			sortable: true,
			render: (value) => `฿${formatCurrency(Number(value || 0))}`,
		},
		{
			key: 'sale_order_status',
			label: 'สถานะ',
			render: (_, row) => {
				const status = row.sale_order_status || 'unknown';
				return (
					<StatusBadge tone={SALE_ORDER_STATUS_TONE[status]}>{status}</StatusBadge>
				);
			},
		},
		{
			key: 'sale_order_id',
			label: 'สร้างใบเสร็จรับเงิน',
			width: '190px',
			render: (_, row) => (
				<button
					onClick={() => {
						setSelectedSaleOrder(row);
						setIsInsertOpen(true);
					}}
					disabled={!canAddPaymentReceipt}
					className="ka-btn ka-btn--primary"
					type="button"
				>
					สร้างใบเสร็จรับเงิน
				</button>
			),
		},
	];

	const paymentReceiptColumns: DataTableColumn<PaymentReceipt>[] = [
		{
			key: 'payment_receipt_code',
			label: 'เลขที่ใบเสร็จรับเงิน',
			width: '200px',
			render: (_, row) => (
				<DocumentCode
					code={row.payment_receipt_code}
					legacyCode={row.legacy_code}
					search={paymentReceiptAppliedSearch}
				/>
			),
		},
		{
			key: 'sale_order_id',
			label: 'ใบสั่งขาย',
			render: (_, row) => row.saleOrder?.sale_order_code || row.sale_order_id,
		},
		{
			key: 'payment_method',
			label: 'วิธีชำระ',
			render: (value) => PAYMENT_METHOD_LABELS[value as 'cash' | 'bank'],
		},
		{
			key: 'amount_paid',
			label: 'ยอดรับชำระ',
			sortable: true,
			render: (value) => `฿${formatCurrency(Number(value || 0))}`,
		},
		{
			key: 'payment_date',
			label: 'วันที่รับชำระ',
			sortable: true,
			render: (value) => formatThaiDate(value as Date),
		},
		{
			key: 'payment_status',
			label: 'สถานะ',
			render: (value) => {
				const status = value as PaymentReceipt['payment_status'];
				return (
					<StatusBadge tone={PAYMENT_RECEIPT_STATUS_TONE[status]}>{PAYMENT_RECEIPT_STATUS_LABELS[status] || status}</StatusBadge>
				);
			},
		},
		{
			key: 'payment_receipt_id',
			label: 'การจัดการ',
			width: '180px',
			render: (_, row) => (
				<div className="flex items-center gap-2">
					<button
						onClick={() => void openPaymentReceiptDetail(row)}
						className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--success)]"
						type="button"
						title="ดูรายละเอียด"
					>
						<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
						</svg>
					</button>

					{canEditPaymentReceipt && row.payment_receipt_type !== 'refund' && (
						<button
							onClick={() => void openPaymentReceiptUpdate(row)}
							className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--brand-ink)]"
							type="button"
							title="แก้ไข"
						>
							<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
							</svg>
						</button>
					)}

					{canDeletePaymentReceipt && row.payment_receipt_type !== 'refund' && (
						<button
							onClick={() => {
								setPaymentReceiptToDelete(row);
								setIsDeleteDialogOpen(true);
							}}
							className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--danger)]"
							type="button"
							title="ลบ"
						>
							<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path
									fillRule="evenodd"
									d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
									clipRule="evenodd"
								/>
							</svg>
						</button>
					)}
				</div>
			),
		},
	];

	return (
		<div className="bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
			<LoadErrorBanner message={saleOrdersError} onRetry={() => void fetchSaleOrders()} className="mb-4" />
			<LoadErrorBanner message={receiptsError} onRetry={() => void fetchPaymentReceipts()} className="mb-4" />
			{loading && <LoadingSkeletonProps />}
			<div className="space-y-6">
				<section className="ka-card">
					<div className="border-b border-[var(--border)] p-4">
						<h2 className="text-lg font-semibold text-[var(--ink)]">รายการใบสั่งขาย (สำหรับสร้างใบเสร็จรับเงิน)</h2>
						<p className="mt-1 text-sm text-[var(--ink-muted)]">เลือกใบสั่งขายจากตารางนี้ แล้วกดปุ่มสร้างใบเสร็จรับเงิน</p>
						<div className="mt-3 flex flex-col gap-2 sm:flex-row">
							<input
								type="text"
								value={saleOrderSearch}
								onChange={(event) => setSaleOrderSearch(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') {
										event.preventDefault();
										setSaleOrderPage(1);
										setSaleOrderAppliedSearch(saleOrderSearch.trim());
									}
								}}
								placeholder="ค้นหาใบสั่งขายด้วย keyword"
								className="ka-input h-10 flex-1"
							/>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => {
										setSaleOrderPage(1);
										setSaleOrderAppliedSearch(saleOrderSearch.trim());
									}}
									className="ka-btn ka-btn--primary"
								>
									ค้นหา
								</button>
								<button
									type="button"
									onClick={() => {
										setSaleOrderSearch('');
										setSaleOrderAppliedSearch('');
										setSaleOrderPage(1);
									}}
									className="ka-btn"
								>
									ล้าง
								</button>
							</div>
						</div>
					</div>
					<div className="p-2">
						<DataTable
							data={saleOrders?.data || []}
							columns={saleOrderColumns}
							keyField="sale_order_id"
							className="bg-[var(--bg-surface)]"
							paginationMeta={saleOrderMeta}
							currentPage={saleOrderPage}
							onPageChange={setSaleOrderPage}
							onSortChange={handleSaleOrderSortChange}
						/>
					</div>
				</section>

				<section className="ka-card">
					<div className="border-b border-[var(--border)] p-4">
						<h2 className="text-lg font-semibold text-[var(--ink)]">รายการใบเสร็จรับเงิน</h2>
						<p className="mt-1 text-sm text-[var(--ink-muted)]">ตารางใบเสร็จรับเงินทั้งหมด พร้อมดูรายละเอียด แก้ไข และลบ</p>
						<div className="mt-3 flex flex-col gap-2 sm:flex-row">
							<input
								type="text"
								value={paymentReceiptSearch}
								onChange={(event) => setPaymentReceiptSearch(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') {
										event.preventDefault();
										setPaymentReceiptPage(1);
										setPaymentReceiptAppliedSearch(paymentReceiptSearch.trim());
									}
								}}
								placeholder="ค้นหาใบเสร็จรับเงินด้วย keyword"
								className="ka-input h-10 flex-1"
							/>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => {
										setPaymentReceiptPage(1);
										setPaymentReceiptAppliedSearch(paymentReceiptSearch.trim());
									}}
									className="ka-btn ka-btn--primary"
								>
									ค้นหา
								</button>
								<button
									type="button"
									onClick={() => {
										setPaymentReceiptSearch('');
										setPaymentReceiptAppliedSearch('');
										setPaymentReceiptPage(1);
									}}
									className="ka-btn"
								>
									ล้าง
								</button>
							</div>
						</div>
					</div>
					<div className="p-2">
						<DataTable
							data={paymentReceipts?.data || []}
							columns={paymentReceiptColumns}
							keyField="payment_receipt_id"
							className="bg-[var(--bg-surface)]"
							paginationMeta={paymentReceiptMeta}
							currentPage={paymentReceiptPage}
							onPageChange={setPaymentReceiptPage}
							onSortChange={handlePaymentReceiptSortChange}
						/>
					</div>
				</section>
			</div>

			{canAddPaymentReceipt && (
				<InsertPaymentReceiptForm
					isOpen={isInsertOpen}
					onClose={() => {
						setIsInsertOpen(false);
						setSelectedSaleOrder(null);
					}}
					onSuccess={() => {
						void fetchPaymentReceipts();
						void fetchSaleOrders();
					}}
					saleOrder={selectedSaleOrder}
				/>
			)}

			{canEditPaymentReceipt && selectedPaymentReceipt && (
				<UpdatePaymentReceiptForm
					isOpen={isUpdateOpen}
					onClose={() => {
						setIsUpdateOpen(false);
						setSelectedPaymentReceipt(null);
					}}
					onSuccess={() => {
						void fetchPaymentReceipts();
						void fetchSaleOrders();
					}}
					initialData={selectedPaymentReceipt}
				/>
			)}

			{selectedPaymentReceipt && (
				<PaymentReceiptDetailModal
					isOpen={isDetailOpen}
					onClose={() => {
						setIsDetailOpen(false);
						setSelectedPaymentReceipt(null);
					}}
					paymentReceipt={selectedPaymentReceipt}
				/>
			)}

			<ConfirmDialog
				isOpen={isDeleteDialogOpen}
				title="ยืนยันการลบใบเสร็จรับเงิน"
				message={`คุณแน่ใจหรือไม่ว่าต้องการลบใบเสร็จรับเงิน "${paymentReceiptToDelete?.payment_receipt_code || ''}" ?`}
				onConfirm={handleDeletePaymentReceipt}
				onCancel={() => {
					setIsDeleteDialogOpen(false);
					setPaymentReceiptToDelete(null);
				}}
			/>

			<ActionResultDialog
				isOpen={resultDialog.isOpen}
				status={resultDialog.status}
				action="delete"
				message={resultDialog.message}
				onClose={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
			/>
		</div>
	);
}
