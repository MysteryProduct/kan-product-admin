'use client';

import Modal from '@/components/Modal';
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
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="รายละเอียดใบเสร็จรับเงิน"
			size="lg"
			footer={
				<>
					<button
						type="button"
						onClick={onClose}
						className="ka-btn h-11"
					>
						ปิด
					</button>
				</>
			}
		>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
				{paymentReceipt.gateway_reference && (
					<div>
						<p className="text-[13px] text-[var(--ink-muted)]">อ้างอิงผู้ให้บริการ</p>
						<p className="break-all text-sm font-medium text-[var(--ink)]">{paymentReceipt.gateway_reference}</p>
					</div>
				)}
				<div className="sm:col-span-2">
					<p className="text-[13px] text-[var(--ink-muted)]">หมายเหตุ</p>
					<p className="text-sm font-medium text-[var(--ink)]">{paymentReceipt.payment_receipt_remark || '-'}</p>
				</div>
			</div>
			<div className="mt-4">
				<DocumentHistoryPanel endpoint={`/payment-receipts/${paymentReceipt.payment_receipt_id}/history`} />
			</div>
		</Modal>
	);
}
