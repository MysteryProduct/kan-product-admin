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
	'ka-input';

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
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm">
				<div className="w-full max-w-2xl rounded-2xl bg-[var(--color-bg-primary)] overlay-surface ">
					<div className="border-b border-[var(--border)] px-6 py-4">
						<h2 className="text-xl font-semibold text-[var(--ink)]">แก้ไขบัญชีรับเงิน</h2>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4 p-6">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-sm font-medium text-[var(--ink)]">เลขที่บัญชี</label>
								<input
									type="text"
									value={formData.account_number}
									onChange={(event) => setFormData((prev) => ({ ...prev, account_number: event.target.value }))}
									className={INPUT_CLASSNAME}
								/>
								{errors.account_number && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.account_number}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-[var(--ink)]">ชื่อบัญชี</label>
								<input
									type="text"
									value={formData.account_name}
									onChange={(event) => setFormData((prev) => ({ ...prev, account_name: event.target.value }))}
									className={INPUT_CLASSNAME}
								/>
								{errors.account_name && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.account_name}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-[var(--ink)]">ธนาคาร</label>
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
								{errors.bank_name && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.bank_name}</p>}
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium text-[var(--ink)]">สาขา</label>
								<input
									type="text"
									value={formData.branch_name}
									onChange={(event) => setFormData((prev) => ({ ...prev, branch_name: event.target.value }))}
									className={INPUT_CLASSNAME}
								/>
							</div>
						</div>

						<div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
							<button
								type="button"
								onClick={onClose}
								disabled={isSubmitting}
								className="ka-btn"
							>
								ยกเลิก
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								className="ka-btn ka-btn--primary"
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
