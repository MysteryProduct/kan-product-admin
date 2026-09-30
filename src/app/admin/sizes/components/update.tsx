'use client';

import { useEffect, useMemo, useState } from 'react';

import ActionResultDialog from '@/components/ActionResultDialog';
import CategoryModel from '@/models/category';
import SizeModel from '@/models/size';
import type { Category } from '@/types/category';
import type { Size } from '@/types/size';
import LoadErrorBanner, { failedLabels, partialLoadText } from '@/components/LoadErrorBanner';
import Modal from '@/components/Modal';

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
	const [loadError, setLoadError] = useState<string | null>(null);
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
			// One failing request must not hide the other, and the person needs to know which one is missing.
			setLoadError(null);
			const results = await Promise.allSettled([
				categoryModel.getCategories(1, 200),
				sizeModel.getCategoryRelationsBySize(initialData.size_id),
			]);
			const [categoryResponse, relation] = results;

			if (categoryResponse.status === 'fulfilled') setCategories(categoryResponse.value.data);
			// Without the saved relation the size's own categories stand in for it.
			setSelectedCategoryIds(
				relation.status === 'fulfilled' ? relation.value.category_ids : (initialData.category_ids ?? []),
			);

			const failed = failedLabels(results, ['ประเภทสินค้า', 'ประเภทที่เลือกไว้เดิม']);
			if (failed.length > 0) {
				console.error('Error fetching update size form data:', results);
				setLoadError(partialLoadText(failed));
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

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				title="แก้ไขขนาดสินค้า"
				size="lg"
				closeOnBackdrop={!loading && !resultDialog.isOpen}
				closeOnEscape={!loading && !resultDialog.isOpen}
				footer={
					<>
						<button
							type="button"
							onClick={onClose}
							className="ka-btn"
							disabled={loading}
						>
							ยกเลิก
						</button>
						<button
							type="submit"
							form="update-size-form"
							className="ka-btn ka-btn--primary"
							disabled={loading}
						>
							{loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
						</button>
					</>
				}
			>
				<form id="update-size-form" onSubmit={handleSubmit} className="space-y-6">
					<LoadErrorBanner message={loadError} />
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">Size ID</label>
							<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)]">
								{initialData.size_id}
							</div>
						</div>
						<div>
							<label htmlFor="size_name" className="mb-2 block text-sm font-semibold text-[var(--ink)]">
								ชื่อขนาดสินค้า
							</label>
							<input
								id="size_name"
								type="text"
								value={sizeName}
								onChange={(e) => setSizeName(e.target.value)}
								className="ka-input"
								disabled={loading}
							/>
						</div>
					</div>

					<div>
						<div className="mb-2 flex items-center justify-between">
							<label className="text-sm font-semibold text-[var(--ink)]">Category ที่ผูกไว้</label>
							<span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[13px] font-semibold text-[var(--ink-muted)]">
								เลือกแล้ว {selectedCount}
							</span>
						</div>

						<div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 sm:grid-cols-2">
							{categories.length > 0 ? (
								categories.map((category) => {
									const checked = selectedCategoryIds.includes(category.category_id);

									return (
										<label
											key={category.category_id}
											className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
												checked
													? 'border-[var(--action)] bg-[var(--brand-soft)] text-[var(--brand-ink)]'
													: 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--ink)] hover:bg-[var(--bg-subtle)]'
											}`}
										>
											<input
												type="checkbox"
												checked={checked}
												onChange={() => toggleCategory(category.category_id)}
												className="ka-check"
												disabled={loading}
											/>
											<span>{category.category_name}</span>
										</label>
									);
								})
							) : (
								<p className="col-span-full text-sm text-[var(--ink-muted)]">ไม่พบรายการ Category</p>
							)}
						</div>
					</div>

					{error && (
						<div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
							{error}
						</div>
					)}
				</form>
			</Modal>

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
