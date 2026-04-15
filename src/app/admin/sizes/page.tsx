'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import ActionResultDialog from '@/components/ActionResultDialog';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import SizeModel from '@/models/size';
import type { Size, SizeCategoryRelation } from '@/types/size';
import type { PaginationMeta } from '@/types/pagination';

import InsertSizeForm from './components/insert';
import UpdateSizeForm from './components/update';
import SizeDetailModal from './components/detail';

export default function SizesPage() {
	const sizeModel = useMemo(() => new SizeModel(), []);
	const { can } = usePermissions();
	const canAddSize = can('sizes', 'add');
	const canEditSize = can('sizes', 'edit');
	const canDeleteSize = can('sizes', 'delete');

	const [sizes, setSizes] = useState<Size[]>([]);
	const [meta, setMeta] = useState<PaginationMeta | null>(null);
	const [currentPage, setCurrentPage] = useState<number>(1);
	const [searchQuery, setSearchQuery] = useState('');
	const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
	const [loading, setLoading] = useState<boolean>(true);

	const [isInsertOpen, setIsInsertOpen] = useState<boolean>(false);
	const [isUpdateOpen, setIsUpdateOpen] = useState<boolean>(false);
	const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
	const [selectedSize, setSelectedSize] = useState<Size | null>(null);

	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [sizeToDelete, setSizeToDelete] = useState<Size | null>(null);

	const [relationsBySizeId, setRelationsBySizeId] = useState<Record<number, SizeCategoryRelation>>({});

	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		message: '',
	});

	const totalSizes = useMemo(() => meta?.total ?? sizes.length, [meta?.total, sizes.length]);

	const fetchSizes = useCallback(async (checkPageAfterDelete = false) => {
		try {
			setLoading(true);
			let pageToFetch = currentPage;

			if (checkPageAfterDelete && currentPage > 1 && sizes.length === 1) {
				pageToFetch = currentPage - 1;
				setCurrentPage(pageToFetch);
			}

			const response = await sizeModel.getSizes(pageToFetch, 10, appliedSearchQuery);
			setSizes(response.data);
			setMeta(response.meta);
		} catch (error) {
			console.error('Error fetching sizes:', error);
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: 'ไม่สามารถดึงข้อมูลขนาดสินค้าได้',
			});
		} finally {
			setLoading(false);
		}
	}, [appliedSearchQuery, currentPage, sizeModel, sizes.length]);

	const loadRelationForSize = useCallback(async (size: Size): Promise<SizeCategoryRelation> => {
		try {
			const relation = await sizeModel.getCategoryRelationsBySize(size.size_id);            
			return relation;
		} catch {
			return {
				category_ids: size.category_ids ?? [],
				category: size.category ?? [],
			};
		}
	}, [sizeModel]);

	const hydrateSizeWithRelations = useCallback(async (size: Size): Promise<Size> => {
		const relation = await loadRelationForSize(size);
        console.log(relation);
        
		return {
			...size,
			category_ids: relation.category.map((cat) => cat.category_id),
			category: relation.category,
		};
	}, [loadRelationForSize]);

	useEffect(() => {
		fetchSizes();
	}, [fetchSizes]);

	useEffect(() => {
		if (sizes.length === 0) {
			setRelationsBySizeId({});
			return;
		}

		let isMounted = true;

		const loadRelations = async () => {
			const entries = await Promise.all(
				sizes.map(async (size) => {
					const relation = await loadRelationForSize(size);
					return [size.size_id, relation] as const;
				})
			);

			if (!isMounted) {
				return;
			}

			const nextRelations = entries.reduce<Record<number, SizeCategoryRelation>>((acc, [sizeId, relation]) => {
				acc[sizeId] = relation;
				return acc;
			}, {});

			setRelationsBySizeId(nextRelations);
		};

		loadRelations();

		return () => {
			isMounted = false;
		};
	}, [loadRelationForSize, sizes]);

	const handleSearch = () => {
		setCurrentPage(1);
		setAppliedSearchQuery(searchQuery.trim());
	};

	const handleClearSearch = () => {
		setSearchQuery('');
		setAppliedSearchQuery('');
		setCurrentPage(1);
	};

	const handleOpenDetail = async (size: Size) => {
		const hydratedSize = await hydrateSizeWithRelations(size);
		setSelectedSize(hydratedSize);
		setIsDetailOpen(true);
	};

	const handleOpenUpdate = async (size: Size) => {
		const hydratedSize = await hydrateSizeWithRelations(size);
		setSelectedSize(hydratedSize);
		setIsUpdateOpen(true);
	};

	const handleDelete = async () => {
		if (!sizeToDelete) {
			return;
		}

		try {
			await sizeModel.deleteSize(sizeToDelete.size_id);
			await fetchSizes(true);
			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'ลบข้อมูลขนาดสินค้าสำเร็จ',
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบข้อมูลขนาดสินค้า';
			console.error('Error deleting size:', error);
			setResultDialog({
				isOpen: true,
				status: 'error',
				message,
			});
		}
	};

	return (
		<div className="flex-1 bg-slate-50 p-2 sm:p-4 md:p-6 lg:p-8 dark:bg-slate-900">
			<div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-100 via-white to-cyan-100 p-5 shadow-sm dark:border-sky-900/50 dark:from-sky-950 dark:via-slate-900 dark:to-cyan-950">
					<p className="text-sm font-medium text-sky-700 dark:text-sky-300">ขนาดสินค้าทั้งหมด</p>
					<p className="mt-2 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">{totalSizes}</p>
				</div>
			</div>

			<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="border-b border-slate-100 p-3 dark:border-slate-700 sm:p-4 md:p-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
							<div className="relative flex-1">
								<input
									type="text"
									placeholder="ค้นหาขนาดสินค้า"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											handleSearch();
										}
									}}
									className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
								/>
								<svg className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</div>
							<button
								type="button"
								onClick={handleSearch}
								className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
							>
								ค้นหา
							</button>
							{(searchQuery || appliedSearchQuery) && (
								<button
									type="button"
									onClick={handleClearSearch}
									className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
								>
									ล้าง
								</button>
							)}
						</div>

						{canAddSize && (
							<button
								onClick={() => setIsInsertOpen(true)}
								className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
							>
								<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
								เพิ่มขนาดสินค้า
							</button>
						)}
					</div>
				</div>

				<div className="overflow-x-auto p-3">
					<table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-700/50">
								<th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 sm:table-cell">Size ID</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">ชื่อขนาด</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Category ที่ผูก</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Action</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-700">
							{sizes.length > 0 ? (
								sizes.map((size) => {
									const relation = relationsBySizeId[size.size_id];
									const relationCategories = relation?.category ?? size.category ?? [];

									return (
										<tr key={size.size_id} className="bg-white transition hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/70">
											<td className="hidden px-4 py-4 text-sm text-slate-600 dark:text-slate-300 sm:table-cell">{size.size_id}</td>
											<td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">{size.size_name}</td>
											<td className="px-4 py-4">
												{relationCategories.length > 0 ? (
													<div className="flex flex-wrap gap-2">
														{relationCategories.slice(0, 3).map((category) => (
															<span key={category.category_id} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
																{category.category_name}
															</span>
														))}
														{relationCategories.length > 3 && (
															<span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
																+{relationCategories.length - 3}
															</span>
														)}
													</div>
												) : (
													<span className="text-sm text-slate-400 dark:text-slate-500">ยังไม่ผูก Category</span>
												)}
											</td>
											<td className="px-4 py-4">
												<div className="flex items-center gap-3">
													<button
														onClick={() => handleOpenDetail(size)}
														className="text-slate-400 transition hover:text-indigo-500"
														title="ดูรายละเอียด"
													>
														<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
														</svg>
													</button>

													{canEditSize && (
														<button
															onClick={() => handleOpenUpdate(size)}
															className="text-slate-400 transition hover:text-sky-500"
															title="แก้ไข"
														>
															<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
																<path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
															</svg>
														</button>
													)}

													{canDeleteSize && (
														<button
															onClick={() => {
																setSizeToDelete(size);
																setIsDeleteDialogOpen(true);
															}}
															className="text-slate-400 transition hover:text-rose-500"
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
											</td>
										</tr>
									);
								})
							) : (
								<tr>
									<td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
										ไม่พบข้อมูลขนาดสินค้า
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{meta && meta.last_page > 1 && (
					<div className="border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="text-sm text-slate-600 dark:text-slate-300">
								Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, meta.total)} of {meta.total} results
							</div>
							<Pagination currentPage={currentPage} meta={meta} onPageChange={setCurrentPage} />
						</div>
					</div>
				)}
			</div>

			{loading && <LoadingSkeleton />}

			{canAddSize && (
				<InsertSizeForm
					isOpen={isInsertOpen}
					onClose={() => setIsInsertOpen(false)}
					onSuccess={() => {
						setIsInsertOpen(false);
						fetchSizes();
					}}
				/>
			)}

			{canEditSize && selectedSize && (
				<UpdateSizeForm
					isOpen={isUpdateOpen}
					onClose={() => {
						setIsUpdateOpen(false);
						setSelectedSize(null);
					}}
					onSuccess={() => {
						setIsUpdateOpen(false);
						setSelectedSize(null);
						fetchSizes();
					}}
					initialData={selectedSize}
				/>
			)}

			<SizeDetailModal
				isOpen={isDetailOpen}
				onClose={() => {
					setIsDetailOpen(false);
					setSelectedSize(null);
				}}
				size={selectedSize}
			/>

			<ConfirmDialog
				isOpen={canDeleteSize && isDeleteDialogOpen}
				onConfirm={handleDelete}
				onCancel={() => {
					setIsDeleteDialogOpen(false);
					setSizeToDelete(null);
				}}
				message={`คุณต้องการลบขนาดสินค้า "${sizeToDelete?.size_name}" ใช่หรือไม่?`}
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
