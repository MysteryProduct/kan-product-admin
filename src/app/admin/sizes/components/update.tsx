'use client';

import { useEffect, useMemo, useState } from 'react';

import ActionResultDialog from '@/components/ActionResultDialog';
import CategoryModel from '@/models/category';
import SizeModel from '@/models/size';
import type { Category } from '@/types/category';
import type { Size } from '@/types/size';

interface UpdateSizeFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	initialData: Size;
}

const categoryModel = new CategoryModel();
const sizeModel = new SizeModel();

export default function UpdateSizeForm({ isOpen, onClose, onSuccess, initialData }: UpdateSizeFormProps) {
	const [sizeName, setSizeName] = useState('');
	const [categories, setCategories] = useState<Category[]>([]);
	const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		message: '',
	});

	const selectedCount = useMemo(() => selectedCategoryIds.length, [selectedCategoryIds.length]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const fetchFormData = async () => {
			try {
				const [categoryResponse, relation] = await Promise.all([
					categoryModel.getCategories(1, 200),
					sizeModel.getCategoryRelationsBySize(initialData.size_id),
				]);

				setCategories(categoryResponse.data);
				setSelectedCategoryIds(relation.category_ids);
			} catch (fetchError) {
				console.error('Error fetching update size form data:', fetchError);
				setCategories([]);
				setSelectedCategoryIds(initialData.category_ids ?? []);
			}
		};

		setSizeName(initialData.size_name || '');
		setError(null);
		setResultDialog((prev) => ({ ...prev, isOpen: false }));
		fetchFormData();
	}, [isOpen, initialData]);

	const toggleCategory = (categoryId: number) => {
		setSelectedCategoryIds((prev) => {
			if (prev.includes(categoryId)) {
				return prev.filter((id) => id !== categoryId);
			}

			return [...prev, categoryId];
		});
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);

		const normalizedName = sizeName.trim();
		if (!normalizedName) {
			setError('กรุณากรอกชื่อขนาดสินค้า');
			return;
		}

		try {
			setLoading(true);
			await sizeModel.updateSize({
				size_id: initialData.size_id,
				size_name: normalizedName,
				category_ids: selectedCategoryIds,
			});

			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'อัปเดตข้อมูลขนาดสินค้าสำเร็จ',
			});
		} catch (submitError: unknown) {
			const message = submitError instanceof Error
				? submitError.message
				: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลขนาดสินค้า';
			setResultDialog({
				isOpen: true,
				status: 'error',
				message,
			});
		} finally {
			setLoading(false);
		}
	};

	const handleResultClose = () => {
		const isSuccess = resultDialog.status === 'success';
		setResultDialog((prev) => ({ ...prev, isOpen: false }));

		if (isSuccess) {
			onClose();
			onSuccess?.();
		}
	};

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
			<div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
				<div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-6 py-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-xl font-bold text-white sm:text-2xl">แก้ไขขนาดสินค้า</h2>
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg p-2 text-white transition hover:bg-white/20"
						>
							<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6 p-6">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Size ID</label>
							<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
								{initialData.size_id}
							</div>
						</div>
						<div>
							<label htmlFor="size_name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
								ชื่อขนาดสินค้า
							</label>
							<input
								id="size_name"
								type="text"
								value={sizeName}
								onChange={(e) => setSizeName(e.target.value)}
								className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
								disabled={loading}
							/>
						</div>
					</div>

					<div>
						<div className="mb-2 flex items-center justify-between">
							<label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Category ที่ผูกไว้</label>
							<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
								เลือกแล้ว {selectedCount}
							</span>
						</div>

						<div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/30 sm:grid-cols-2">
							{categories.length > 0 ? (
								categories.map((category) => {
									const checked = selectedCategoryIds.includes(category.category_id);

									return (
										<label
											key={category.category_id}
											className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
												checked
													? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300'
													: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
											}`}
										>
											<input
												type="checkbox"
												checked={checked}
												onChange={() => toggleCategory(category.category_id)}
												className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
												disabled={loading}
											/>
											<span>{category.category_name}</span>
										</label>
									);
								})
							) : (
								<p className="col-span-full text-sm text-slate-500 dark:text-slate-400">ไม่พบรายการ Category</p>
							)}
						</div>
					</div>

					{error && (
						<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/30 dark:text-rose-300">
							{error}
						</div>
					)}

					<div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end">
						<button
							type="button"
							onClick={onClose}
							className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
							disabled={loading}
						>
							ยกเลิก
						</button>
						<button
							type="submit"
							className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
							disabled={loading}
						>
							{loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
						</button>
					</div>
				</form>
			</div>

			<ActionResultDialog
				isOpen={resultDialog.isOpen}
				status={resultDialog.status}
				action="update"
				message={resultDialog.message}
				onClose={handleResultClose}
			/>
		</div>
	);
}
