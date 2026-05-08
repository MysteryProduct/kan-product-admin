'use client';

import { BankAccount } from '@/types/bank-account';

interface BankAccountDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	bankAccount: BankAccount;
}

export default function BankAccountDetailModal({ isOpen, onClose, bankAccount }: BankAccountDetailModalProps) {
	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
			<div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
				<div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">รายละเอียดบัญชีรับเงิน</h2>
				</div>

				<div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">รหัสบัญชี</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{bankAccount.account_id}</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">เลขที่บัญชี</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{bankAccount.account_number}</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">ชื่อบัญชี</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{bankAccount.account_name}</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 dark:text-gray-400">ธนาคาร</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{bankAccount.bank_name}</p>
					</div>
					<div className="sm:col-span-2">
						<p className="text-xs text-gray-500 dark:text-gray-400">สาขา</p>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{bankAccount.branch_name || '-'}</p>
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
