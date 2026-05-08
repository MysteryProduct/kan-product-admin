'use client';

import { useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { PaginationMeta } from '@/types/pagination';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import BankAccountModel from '@/models/bank-account';
import { BankAccount, BankAccountResponse } from '@/types/bank-account';
import InsertBankAccountForm from './components/insert';
import UpdateBankAccountForm from './components/update';
import BankAccountDetailModal from './components/detail';
import ConfirmDialog from '@/components/ConfirmDialog';
import ActionResultDialog from '@/components/ActionResultDialog';

const bankAccountModel = new BankAccountModel();

type BankAccountSortField = 'account_name' | 'bank_name' | null;
type SortOrder = 'ASC' | 'DESC';

export default function BankAccountPage() {
	const { can } = usePermissions();
	const canAddBankAccount = can('bank_accounts', 'add');
	const canEditBankAccount = can('bank_accounts', 'edit');
	const canDeleteBankAccount = can('bank_accounts', 'delete');

	const [currentPage, setCurrentPage] = useState(1);
	const [bankAccounts, setBankAccounts] = useState<BankAccountResponse | null>(null);
	const [meta, setMeta] = useState<PaginationMeta | null>(null);
	const [loading, setLoading] = useState(false);

	const [sortField, setSortField] = useState<BankAccountSortField>(null);
	const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');

	const [search, setSearch] = useState('');
	const [appliedSearch, setAppliedSearch] = useState('');

	const [isInsertOpen, setIsInsertOpen] = useState(false);
	const [isUpdateOpen, setIsUpdateOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
	const [bankAccountToDelete, setBankAccountToDelete] = useState<BankAccount | null>(null);

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
		void fetchBankAccounts();
	}, [currentPage, appliedSearch, sortField, sortOrder]);

	const fetchBankAccounts = async (
		page = currentPage,
		query = appliedSearch,
		nextSortField = sortField,
		nextSortOrder = sortOrder,
	) => {
		try {
			setLoading(true);
			const response = await bankAccountModel.getBankAccounts(page, 10, query, nextSortField, nextSortOrder);
			setBankAccounts(response);
			setMeta(response.meta);
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลบัญชีรับเงินได้',
			});
		} finally {
			setLoading(false);
		}
	};

	const handleSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
		if (!sort) {
			setSortField(null);
			setSortOrder('ASC');
			return;
		}

		const nextField = sort.key as BankAccountSortField;
		if (nextField !== 'account_name' && nextField !== 'bank_name') {
			setSortField(null);
			setSortOrder('ASC');
			return;
		}

		setSortField(nextField);
		setSortOrder(sort.direction);
	};

	const handleSearch = () => {
		setCurrentPage(1);
		setAppliedSearch(search.trim());
	};

	const handleClearSearch = () => {
		setSearch('');
		setAppliedSearch('');
		setCurrentPage(1);
	};

	const handleDeleteBankAccount = async () => {
		if (!bankAccountToDelete) {
			return;
		}

		try {
			await bankAccountModel.deleteBankAccount(bankAccountToDelete.account_id);
			setResultDialog({ isOpen: true, status: 'success', message: 'ลบบัญชีรับเงินสำเร็จ' });
			setIsDeleteDialogOpen(false);
			setBankAccountToDelete(null);

			const nextPage = currentPage > 1 && (bankAccounts?.data.length || 0) === 1 ? currentPage - 1 : currentPage;
			if (nextPage !== currentPage) {
				setCurrentPage(nextPage);
			}
			await fetchBankAccounts(nextPage);
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบบัญชีรับเงิน',
			});
		}
	};

	const columns: DataTableColumn<BankAccount>[] = [
		{ key: 'account_number', label: 'เลขที่บัญชี', width: '180px' },
		{ key: 'account_name', label: 'ชื่อบัญชี', sortable: true },
		{ key: 'bank_name', label: 'ธนาคาร', sortable: true },
		{
			key: 'branch_name',
			label: 'สาขา',
			render: (value) => (value as string) || '-',
		},
		{
			key: 'account_id',
			label: 'การจัดการ',
			width: '180px',
			render: (_, row) => (
				<div className="flex items-center gap-2">
					<button
						onClick={() => {
							setSelectedBankAccount(row);
							setIsDetailOpen(true);
						}}
						className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-green-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-green-400"
						type="button"
						title="ดูรายละเอียด"
					>
						<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
						</svg>
					</button>

					{canEditBankAccount && (
						<button
							onClick={() => {
								setSelectedBankAccount(row);
								setIsUpdateOpen(true);
							}}
							className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
							type="button"
							title="แก้ไข"
						>
							<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
							</svg>
						</button>
					)}

					{canDeleteBankAccount && (
						<button
							onClick={() => {
								setBankAccountToDelete(row);
								setIsDeleteDialogOpen(true);
							}}
							className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
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
		<div className="bg-gray-50 p-2 dark:bg-gray-900 sm:p-4 md:p-6 lg:p-8">
			{loading && <LoadingSkeletonProps />}

			<section className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
				<div className="border-b border-gray-100 p-4 dark:border-gray-700">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">รายการบัญชีรับเงิน</h2>
							<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">จัดการบัญชีธนาคารสำหรับรับชำระเงิน</p>
						</div>

						{canAddBankAccount && (
							<button
								type="button"
								onClick={() => setIsInsertOpen(true)}
								className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
							>
								เพิ่มบัญชีรับเงิน
							</button>
						)}
					</div>

					<div className="mt-3 flex flex-col gap-2 sm:flex-row">
						<input
							type="text"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									handleSearch();
								}
							}}
							placeholder="ค้นหาบัญชีจากชื่อบัญชี/เลขที่บัญชี/ธนาคาร"
							className="h-10 flex-1 rounded-xl border border-gray-300 px-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						/>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleSearch}
								className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
							>
								ค้นหา
							</button>
							<button
								type="button"
								onClick={handleClearSearch}
								className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
							>
								ล้าง
							</button>
						</div>
					</div>
				</div>

				<div className="p-2">
					<DataTable
						data={bankAccounts?.data || []}
						columns={columns}
						keyField="account_id"
						className="bg-white dark:bg-gray-800"
						paginationMeta={meta}
						currentPage={currentPage}
						onPageChange={setCurrentPage}
						onSortChange={handleSortChange}
					/>
				</div>
			</section>

			{canAddBankAccount && (
				<InsertBankAccountForm
					isOpen={isInsertOpen}
					onClose={() => setIsInsertOpen(false)}
					onSuccess={() => void fetchBankAccounts()}
				/>
			)}

			{canEditBankAccount && selectedBankAccount && (
				<UpdateBankAccountForm
					isOpen={isUpdateOpen}
					onClose={() => {
						setIsUpdateOpen(false);
						setSelectedBankAccount(null);
					}}
					onSuccess={() => void fetchBankAccounts()}
					initialData={selectedBankAccount}
				/>
			)}

			{selectedBankAccount && (
				<BankAccountDetailModal
					isOpen={isDetailOpen}
					onClose={() => {
						setIsDetailOpen(false);
						setSelectedBankAccount(null);
					}}
					bankAccount={selectedBankAccount}
				/>
			)}

			<ConfirmDialog
				isOpen={isDeleteDialogOpen}
				title="ยืนยันการลบ"
				message={`คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี "${bankAccountToDelete?.account_name || ''}" ?`}
				onConfirm={handleDeleteBankAccount}
				onCancel={() => {
					setIsDeleteDialogOpen(false);
					setBankAccountToDelete(null);
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
