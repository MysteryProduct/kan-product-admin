'use client';

import { formatThaiDate } from '@/lib/date-format';
import { PAYMENT_METHOD_LABELS, PAYMENT_RECEIPT_STATUS_LABELS, PaymentReceipt } from '@/types/payment-receipt';
import DocumentHistoryPanel from '@/components/document-history/DocumentHistoryPanel';

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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm">
			<div className="w-full max-w-3xl rounded-2xl bg-[var(--color-bg-primary)] overlay-surface">
				<div className="border-b border-[var(--border)] px-6 py-4">
					<h2 className="text-xl font-semibold text-[var(--ink)]">รายละเอียดใบเสร็จรับเงิน</h2>
				</div>

				<div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
					<div>
						<p className="text-[13px] text-[var(--ink-muted)]">เลขที่เอกสาร</p>
						<p className="text-sm font-medium text-[var(--ink)]">{paymentReceipt.payment_receipt_code}</p>
					</div>
					<div>
						<p className="text-[13px] text-[var(--ink-muted)]">ใบสั่งขาย</p>
						<p className="text-sm font-medium text-[var(--ink)]">
							{paymentReceipt.saleOrder?.sale_order_code || paymentReceipt.sale_order_id}
						</p>
					</div>
					<div>
						<p className="text-[13px] text-[var(--ink-muted)]">วิธีชำระ</p>
						<p className="text-sm font-medium text-[var(--ink)]">{PAYMENT_METHOD_LABELS[paymentReceipt.payment_method]}</p>
					</div>
					<div>
						<p className="text-[13px] text-[var(--ink-muted)]">สถานะ</p>
						<p className="text-sm font-medium text-[var(--ink)]">
							{PAYMENT_RECEIPT_STATUS_LABELS[paymentReceipt.payment_status]}
						</p>
					</div>
					<div>
						<p className="text-[13px] text-[var(--ink-muted)]">วันที่รับชำระ</p>
						<p className="text-sm font-medium text-[var(--ink)]">
							{formatThaiDate(paymentReceipt.payment_date as Date)}
						</p>
					</div>
					<div>
						<p className="text-[13px] text-[var(--ink-muted)]">ยอดรับชำระ</p>
						<p className="text-sm font-bold text-[var(--success)]">฿{formatCurrency(paymentReceipt.amount_paid)}</p>
					</div>
					<div>
						<p className="text-[13px] text-[var(--ink-muted)]">บัญชีรับเงิน</p>
						<p className="text-sm font-medium text-[var(--ink)]">
							{paymentReceipt.bankAccount
								? `${paymentReceipt.bankAccount.bank_name} - ${paymentReceipt.bankAccount.account_number}`
								: paymentReceipt.payment_method === 'cash'
									? 'เงินสด'
									: '-'}
						</p>
					</div>
					<div className="sm:col-span-2">
						<p className="text-[13px] text-[var(--ink-muted)]">หมายเหตุ</p>
						<p className="text-sm font-medium text-[var(--ink)]">{paymentReceipt.payment_receipt_remark || '-'}</p>
					</div>
				</div>
				<div className="px-6 pb-2">
					<DocumentHistoryPanel endpoint={`/payment-receipts/${paymentReceipt.payment_receipt_id}/history`} />
				</div>

				<div className="flex justify-end border-t border-[var(--border)] px-6 py-4">
					<button
						type="button"
						onClick={onClose}
						className="ka-btn h-11"
					>
						ปิด
					</button>
				</div>
			</div>
		</div>
	);
}
