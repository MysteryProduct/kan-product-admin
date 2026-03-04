'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { PaginationMeta } from '@/types/pagination';
import { Material, MaterialResponse } from '@/types/material';
import MaterialModel from '@/models/material';
import { usePermissions } from '@/hooks/usePermissions';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import ConfirmDialog from '@/components/ConfirmDialog';
import ActionResultDialog from '@/components/ActionResultDialog';
import InsertMaterialForm from './components/insert';
import UpdateMaterialForm from './components/update';
import MaterialDetailModal from './components/detail';

const materialModel = new MaterialModel();

type SortField = 'adddate' | 'material_price' | null;
type SortOrder = 'ASC' | 'DESC';

export default function MaterialsPage() {
	const { can } = usePermissions();
	const canAddMaterial = can('materials', 'add');
	const canEditMaterial = can('materials', 'edit');
	const canDeleteMaterial = can('materials', 'delete');

	const [searchQuery, setSearchQuery] = useState('');
	const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [materials, setMaterials] = useState<MaterialResponse | null>(null);
	const [meta, setMeta] = useState<PaginationMeta | null>(null);
	const [sortField, setSortField] = useState<SortField>(null);
	const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
	const [loading, setLoading] = useState(true);

	const [isInsertOpen, setIsInsertOpen] = useState(false);
	const [isUpdateOpen, setIsUpdateOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
	const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);

	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		message: '',
	});

	const fetchMaterials = useCallback(async (targetPage = currentPage) => {
		try {
			setLoading(true);
			const response = await materialModel.getMaterials(targetPage, 10, appliedSearchQuery, sortField, sortOrder);
			setMaterials(response);
			setMeta(response.meta);
		} catch (error) {
			console.error('Failed to fetch materials:', error);
		} finally {
			setLoading(false);
		}
	}, [appliedSearchQuery, currentPage, sortField, sortOrder]);

	useEffect(() => {
		void fetchMaterials();
	}, [fetchMaterials]);

	const handleSearch = () => {
		setCurrentPage(1);
		setAppliedSearchQuery(searchQuery.trim());
	};

	const handleClearSearch = () => {
		setSearchQuery('');
		setAppliedSearchQuery('');
		setCurrentPage(1);
	};

	const handleSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
		if (!sort) {
			setSortField(null);
			setSortOrder('ASC');
			return;
		}

		const nextField = sort.key as SortField;
		if (nextField !== 'adddate' && nextField !== 'material_price') {
			setSortField(null);
			setSortOrder('ASC');
			return;
		}

		setSortField(nextField);
		setSortOrder(sort.direction);
	};

	const handleRefreshMaterials = async (checkPageAfterDelete = false) => {
		let targetPage = currentPage;
		if (checkPageAfterDelete && currentPage > 1 && (materials?.data.length || 0) === 1) {
			targetPage = currentPage - 1;
			setCurrentPage(targetPage);
		}
		await fetchMaterials(targetPage);
	};

	const handleDelete = async () => {
		if (!materialToDelete) {
			return;
		}

		try {
			await materialModel.deleteMaterial(materialToDelete.material_id);
			await handleRefreshMaterials(true);
			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'ลบวัตถุดิบสำเร็จ',
			});
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบวัตถุดิบ',
			});
		} finally {
			setIsDeleteDialogOpen(false);
			setMaterialToDelete(null);
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('th-TH', {
			style: 'decimal',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const columns: DataTableColumn<Material>[] = [
		{
			key: 'material_name',
			label: 'ชื่อวัตถุดิบ',
			width: '260px',
		},
		{
			key: 'material_description',
			label: 'รายละเอียด',
			render: (value) => {
				const description = String(value || '-');
				return description.length > 120 ? `${description.slice(0, 120)}...` : description;
			},
		},
		{
			key: 'adddate',
			label: 'วันที่เพิ่ม',
			sortable: true,
			render: (value) => (value ? new Date(value as Date).toLocaleDateString('th-TH') : '-'),
		},
		{
			key: 'material_price',
			label: 'ราคา',
			sortable: true,
			render: (value) => `฿${formatCurrency(Number(value || 0))}`,
		},
		{
			key: 'material_id',
			label: 'การจัดการ',
			width: '180px',
			render: (_, row) => (
				<div className="flex items-center gap-2">
					<button
						onClick={() => {
							setSelectedMaterial(row);
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

					{canEditMaterial && (
						<button
							onClick={() => {
								setSelectedMaterial(row);
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

					{canDeleteMaterial && (
						<button
							onClick={() => {
								setMaterialToDelete(row);
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
		<div className="bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8 dark:bg-gray-900">
			<div className="overflow-hidden rounded-xl bg-white shadow-sm sm:rounded-2xl dark:bg-gray-800">
				<div className="border-b border-gray-100 p-3 sm:p-4 md:p-6 dark:border-gray-700">
					<div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
						<div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:max-w-md sm:flex-1 sm:flex-row">
							<div className="relative flex-1">
								<input
									type="text"
									placeholder="ค้นหาวัตถุดิบ..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											handleSearch();
										}
									}}
									className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
								/>
								<svg
									className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400 dark:text-gray-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
							</div>
							<button
								type="button"
								onClick={handleSearch}
								className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
							>
								ค้นหา
							</button>
							{(searchQuery || appliedSearchQuery) && (
								<button
									type="button"
									onClick={handleClearSearch}
									className="whitespace-nowrap rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
								>
									ล้าง
								</button>
							)}
						</div>

						{canAddMaterial && (
							<button
								onClick={() => setIsInsertOpen(true)}
								className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
							>
								<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
								<span>เพิ่มข้อมูล</span>
							</button>
						)}
					</div>
				</div>

				{loading && <LoadingSkeletonProps />}
				<DataTable
					data={materials?.data || []}
					columns={columns}
					keyField="material_id"
					disabled={loading}
					className="bg-white p-1 dark:bg-gray-800"
					headerClassName="border-b border-gray-100 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
					rowClassName="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
					paginationMeta={meta}
					currentPage={currentPage}
					onPageChange={setCurrentPage}
					onSortChange={handleSortChange}
				/>

			</div>

			{canAddMaterial && (
				<InsertMaterialForm
					isOpen={isInsertOpen}
					onClose={() => setIsInsertOpen(false)}
					onSuccess={() => void handleRefreshMaterials()}
				/>
			)}

			{canEditMaterial && selectedMaterial && (
				<UpdateMaterialForm
					isOpen={isUpdateOpen}
					onClose={() => {
						setIsUpdateOpen(false);
						setSelectedMaterial(null);
					}}
					onSuccess={() => void handleRefreshMaterials()}
					initialData={selectedMaterial}
				/>
			)}

			{selectedMaterial && (
				<MaterialDetailModal
					isOpen={isDetailOpen}
					onClose={() => {
						setIsDetailOpen(false);
						setSelectedMaterial(null);
					}}
					material={selectedMaterial}
				/>
			)}

			<ConfirmDialog
				isOpen={isDeleteDialogOpen}
				title="ยืนยันการลบวัตถุดิบ"
				message={`คุณแน่ใจหรือไม่ว่าต้องการลบวัตถุดิบ \"${materialToDelete?.material_name || ''}\"? การกระทำนี้ไม่สามารถย้อนกลับได้.`}
				onCancel={() => {
					setIsDeleteDialogOpen(false);
					setMaterialToDelete(null);
				}}
				onConfirm={handleDelete}
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

