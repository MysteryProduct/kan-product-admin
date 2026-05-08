'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog from '@/components/ActionResultDialog';
import BankAccountModel from '@/models/bank-account';
import { BankAccount } from '@/types/bank-account';
import { THAI_BANK_OPTIONS } from '@/lib/bank';

interface UpdateBankAccountFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	initialData: BankAccount;
}

const bankAccountModel = new BankAccountModel();
const INPUT_CLASSNAME =
	'h-11 w-full rounded-xl border border-gray-300 px-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

export default function UpdateBankAccountForm({ isOpen, onClose, onSuccess, initialData }: UpdateBankAccountFormProps) {
	const [formData, setFormData] = useState({
		account_number: '',
		account_name: '',
		bank_name: THAI_BANK_OPTIONS[0]?.value || '',
		branch_name: '',
	});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
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
		if (isOpen && initialData) {
			setFormData({
				account_number: initialData.account_number || '',
				account_name: initialData.account_name || '',
				bank_name: initialData.bank_name || THAI_BANK_OPTIONS[0]?.value || '',
				branch_name: initialData.branch_name || '',
			});
			setErrors({});
		}
	}, [isOpen, initialData]);

	const validate = () => {
		const nextErrors: Record<string, string> = {};
		if (!formData.account_number.trim()) {
			nextErrors.account_number = 'กรุณากรอกเลขที่บัญชี';
		}
		if (!formData.account_name.trim()) {
			nextErrors.account_name = 'กรุณากรอกชื่อบัญชี';
		}
		if (!formData.bank_name.trim()) {
			nextErrors.bank_name = 'กรุณาเลือกธนาคาร';
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

			await bankAccountModel.updateBankAccount({
				account_id: initialData.account_id,
				...formData,
				update_by: user?.employee_id,
			});

			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'แก้ไขบัญชีรับเงินสำเร็จ',
			});
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการแก้ไขบัญชีรับเงิน',
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
				<div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
					<div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">แก้ไขบัญชีรับเงิน</h2>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4 p-6">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">เลขที่บัญชี</label>
								<input
									type="text"
									value={formData.account_number}
									onChange={(event) => setFormData((prev) => ({ ...prev, account_number: event.target.value }))}
									className={INPUT_CLASSNAME}
								/>
								{errors.account_number && <p className="mt-1 text-xs text-red-500">{errors.account_number}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">ชื่อบัญชี</label>
								<input
									type="text"
									value={formData.account_name}
									onChange={(event) => setFormData((prev) => ({ ...prev, account_name: event.target.value }))}
									className={INPUT_CLASSNAME}
								/>
								{errors.account_name && <p className="mt-1 text-xs text-red-500">{errors.account_name}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">ธนาคาร</label>
								<select
									value={formData.bank_name}
									onChange={(event) => setFormData((prev) => ({ ...prev, bank_name: event.target.value }))}
									className={INPUT_CLASSNAME}
								>
									{THAI_BANK_OPTIONS.map((bank) => (
										<option key={bank.value} value={bank.value}>
											{bank.label}
										</option>
									))}
								</select>
								{errors.bank_name && <p className="mt-1 text-xs text-red-500">{errors.bank_name}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">สาขา</label>
								<input
									type="text"
									value={formData.branch_name}
									onChange={(event) => setFormData((prev) => ({ ...prev, branch_name: event.target.value }))}
									className={INPUT_CLASSNAME}
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
