'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog from '@/components/ActionResultDialog';
import BankAccountModel from '@/models/bank-account';
import PaymentReceiptModel from '@/models/payment-receipt';
import { BankAccount } from '@/types/bank-account';
import {
	PAYMENT_METHOD_OPTIONS,
	PAYMENT_RECEIPT_STATUS_OPTIONS,
	PAYMENT_RECEIPT_TYPE_OPTIONS,
	PaymentReceipt,
	PaymentReceiptStatus,
	PaymentReceiptType,
} from '@/types/payment-receipt';

interface UpdatePaymentReceiptFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	initialData: PaymentReceipt;
}

const paymentReceiptModel = new PaymentReceiptModel();
const bankAccountModel = new BankAccountModel();
const INPUT_CLASSNAME =
	'h-11 w-full rounded-xl border border-gray-300 px-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

export default function UpdatePaymentReceiptForm({
	isOpen,
	onClose,
	onSuccess,
	initialData,
}: UpdatePaymentReceiptFormProps) {
	const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
	const [loadingAccounts, setLoadingAccounts] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [formData, setFormData] = useState({
		payment_receipt_code: '',
		payment_receipt_type: 'full' as PaymentReceiptType,
		payment_method: 'bank' as 'cash' | 'bank',
		amount_paid: '',
		payment_date: new Date().toISOString().slice(0, 10),
		payment_status: 'paid' as PaymentReceiptStatus,
		payment_receipt_remark: '',
		account_id: '',
	});
	const [errors, setErrors] = useState<Record<string, string>>({});
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
		if (!isOpen) {
			return;
		}

		const loadBankAccounts = async () => {
			try {
				setLoadingAccounts(true);
				const response = await bankAccountModel.getBankAccounts(1, 200);
				setBankAccounts(response.data || []);
			} catch (error) {
				console.error('Failed to load bank accounts:', error);
			} finally {
				setLoadingAccounts(false);
			}
		};

		void loadBankAccounts();
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !initialData) {
			return;
		}

		setFormData({
			payment_receipt_code: initialData.payment_receipt_code || '',
			payment_receipt_type: initialData.payment_receipt_type || 'full',
			payment_method: initialData.payment_method || 'bank',
			amount_paid: String(Number(initialData.amount_paid || 0).toFixed(2)),
			payment_date: String(initialData.payment_date || '').slice(0, 10),
			payment_status: initialData.payment_status || 'paid',
			payment_receipt_remark: initialData.payment_receipt_remark || '',
			account_id: initialData.account_id || '',
		});
		setErrors({});
	}, [isOpen, initialData]);

	const validate = () => {
		const nextErrors: Record<string, string> = {};
		if (!formData.payment_receipt_code.trim()) {
			nextErrors.payment_receipt_code = 'กรุณาระบุเลขที่ใบเสร็จรับเงิน';
		}

		const paidAmount = Number(formData.amount_paid);
		if (Number.isNaN(paidAmount) || paidAmount <= 0) {
			nextErrors.amount_paid = 'ยอดรับชำระต้องมากกว่า 0';
		}

		if (!formData.payment_date) {
			nextErrors.payment_date = 'กรุณาเลือกวันที่รับชำระ';
		}

		if (formData.payment_method === 'bank' && !formData.account_id) {
			nextErrors.account_id = 'กรุณาเลือกบัญชีรับเงิน';
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!validate()) {
			return;
		}

		try {
			setIsSubmitting(true);
			const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;

			await paymentReceiptModel.updatePaymentReceipt({
				payment_receipt_id: initialData.payment_receipt_id,
				payment_receipt_code: formData.payment_receipt_code,
				payment_receipt_type: formData.payment_receipt_type,
				payment_method: formData.payment_method,
				amount_paid: Number(formData.amount_paid),
				payment_date: formData.payment_date,
				payment_status: formData.payment_status,
				payment_receipt_remark: formData.payment_receipt_remark,
				account_id: formData.payment_method === 'bank' ? formData.account_id : undefined,
				update_by: user?.employee_id,
			});

			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'แก้ไขใบเสร็จรับเงินสำเร็จ',
			});
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการแก้ไขใบเสร็จรับเงิน',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResultClose = () => {
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

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
				<div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
					<div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">แก้ไขใบเสร็จรับเงิน</h2>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4 p-6">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">เลขที่ใบเสร็จรับเงิน</label>
								<input
									type="text"
									value={formData.payment_receipt_code}
									onChange={(event) => setFormData((prev) => ({ ...prev, payment_receipt_code: event.target.value }))}
									className={INPUT_CLASSNAME}
								/>
								{errors.payment_receipt_code && <p className="mt-1 text-xs text-red-500">{errors.payment_receipt_code}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">ประเภทรายการชำระ</label>
								<select
									value={formData.payment_receipt_type}
									onChange={(event) =>
										setFormData((prev) => ({ ...prev, payment_receipt_type: event.target.value as PaymentReceiptType }))
									}
									className={INPUT_CLASSNAME}
								>
									{PAYMENT_RECEIPT_TYPE_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">วิธีชำระเงิน</label>
								<select
									value={formData.payment_method}
									onChange={(event) =>
										setFormData((prev) => ({ ...prev, payment_method: event.target.value as 'cash' | 'bank' }))
									}
									className={INPUT_CLASSNAME}
								>
									{PAYMENT_METHOD_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">บัญชีรับเงิน</label>
								<select
									value={formData.account_id}
									disabled={formData.payment_method !== 'bank' || loadingAccounts}
									onChange={(event) => setFormData((prev) => ({ ...prev, account_id: event.target.value }))}
									className={`${INPUT_CLASSNAME} disabled:cursor-not-allowed disabled:opacity-60`}
								>
									<option value="">เลือกบัญชี</option>
									{bankAccounts.map((bankAccount) => (
										<option key={bankAccount.account_id} value={bankAccount.account_id}>
											{bankAccount.bank_name} - {bankAccount.account_number}
										</option>
									))}
								</select>
								{errors.account_id && <p className="mt-1 text-xs text-red-500">{errors.account_id}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">ยอดรับชำระ</label>
								<input
									type="number"
									min={0}
									step="0.01"
									value={formData.amount_paid}
									onChange={(event) => setFormData((prev) => ({ ...prev, amount_paid: event.target.value }))}
									className={INPUT_CLASSNAME}
								/>
								{errors.amount_paid && <p className="mt-1 text-xs text-red-500">{errors.amount_paid}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">วันที่รับชำระ</label>
								<input
									type="date"
									value={formData.payment_date}
									onChange={(event) => setFormData((prev) => ({ ...prev, payment_date: event.target.value }))}
									className={INPUT_CLASSNAME}
								/>
								{errors.payment_date && <p className="mt-1 text-xs text-red-500">{errors.payment_date}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">สถานะ</label>
								<select
									value={formData.payment_status}
									onChange={(event) =>
										setFormData((prev) => ({ ...prev, payment_status: event.target.value as PaymentReceiptStatus }))
									}
									className={INPUT_CLASSNAME}
								>
									{PAYMENT_RECEIPT_STATUS_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>

							<div className="md:col-span-2">
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">หมายเหตุ</label>
								<textarea
									rows={3}
									value={formData.payment_receipt_remark}
									onChange={(event) => setFormData((prev) => ({ ...prev, payment_receipt_remark: event.target.value }))}
									className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
								/>
							</div>
						</div>

						<div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
							<button
								type="button"
								onClick={onClose}
								disabled={isSubmitting}
								className="h-11 rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
							>
								ยกเลิก
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
							>
								{isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
							</button>
						</div>
					</form>
				</div>
			</div>

			<ActionResultDialog
				isOpen={resultDialog.isOpen}
				status={resultDialog.status}
				action="update"
				message={resultDialog.message}
				onClose={handleResultClose}
			/>
		</>
	);
}
