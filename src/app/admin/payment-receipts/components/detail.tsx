'use client';

import { formatThaiDate } from '@/lib/date-format';
import { PAYMENT_METHOD_LABELS, PAYMENT_RECEIPT_STATUS_LABELS, PaymentReceipt } from '@/types/payment-receipt';

interface PaymentReceiptDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	paymentReceipt: PaymentReceipt;
}

const formatCurrency = (amount: number) =>
	new Intl.NumberFormat('th-TH', {
		style: 'decimal',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount || 0);

export default function PaymentReceiptDetailModal({
	isOpen,
	onClose,
	paymentReceipt,
}: PaymentReceiptDetailModalProps) {
	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
			<div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
				<div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">รายละเอียดใบเสร็จรับเงิน</h2>
				</div>

				<div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">เลขที่เอกสาร</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{paymentReceipt.payment_receipt_code}</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">ใบสั่งขาย</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{paymentReceipt.saleOrder?.sale_order_code || paymentReceipt.sale_order_id}
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">วิธีชำระ</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{PAYMENT_METHOD_LABELS[paymentReceipt.payment_method]}</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">สถานะ</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{PAYMENT_RECEIPT_STATUS_LABELS[paymentReceipt.payment_status]}
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">วันที่รับชำระ</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{formatThaiDate(paymentReceipt.payment_date as Date)}
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">ยอดรับชำระ</p>
						<p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">฿{formatCurrency(paymentReceipt.amount_paid)}</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">บัญชีรับเงิน</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
							{paymentReceipt.bankAccount
								? `${paymentReceipt.bankAccount.bank_name} - ${paymentReceipt.bankAccount.account_number}`
								: paymentReceipt.payment_method === 'cash'
									? 'เงินสด'
									: '-'}
						</p>
					</div>
					<div className="sm:col-span-2">
						<p className="text-xs text-gray-500 dark:text-gray-400">หมายเหตุ</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{paymentReceipt.payment_receipt_remark || '-'}</p>
					</div>
				</div>

				<div className="flex justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-700">
					<button
						type="button"
						onClick={onClose}
						className="h-11 rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
					>
						ปิด
					</button>
				</div>
			</div>
		</div>
	);
}
