'use client';

import { useEffect, useMemo, useState } from 'react';

import ActionResultDialog from '@/components/ActionResultDialog';
import CategoryModel from '@/models/category';
import SizeModel from '@/models/size';
import type { Category } from '@/types/category';

interface InsertSizeFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
}

const categoryModel = new CategoryModel();
const sizeModel = new SizeModel();

export default function InsertSizeForm({ isOpen, onClose, onSuccess }: InsertSizeFormProps) {
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

		const fetchCategories = async () => {
			try {
				const response = await categoryModel.getCategories(1, 200);
				setCategories(response.data);
			} catch (fetchError) {
				console.error('Error fetching categories for size form:', fetchError);
				setCategories([]);
			}
		};

		fetchCategories();
		setSizeName('');
		setSelectedCategoryIds([]);
		setError(null);
		setResultDialog((prev) => ({ ...prev, isOpen: false }));
	}, [isOpen]);

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
			await sizeModel.createSize({
				size_name: normalizedName,
				category_ids: selectedCategoryIds,
			});

			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'เพิ่มข้อมูลขนาดสินค้าสำเร็จ',
			});
		} catch (submitError: unknown) {
			const message = submitError instanceof Error
				? submitError.message
				: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลขนาดสินค้า';
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm">
			<div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] overlay-surface">
				<div className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-xl font-bold text-[var(--ink)] sm:text-2xl">เพิ่มขนาดสินค้า</h2>
						<button
							type="button"
							onClick={onClose}
							className="ka-btn ka-btn--ghost ka-btn--icon"
							aria-label="ปิดหน้าต่าง"
						>
							<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6 p-6">
					<div>
						<label htmlFor="size_name" className="mb-2 block text-sm font-semibold text-[var(--ink)]">
							ชื่อขนาดสินค้า
						</label>
						<input
							id="size_name"
							type="text"
							value={sizeName}
							onChange={(e) => setSizeName(e.target.value)}
							placeholder="เช่น S, M, L หรือ 37, 38, 39"
							className="ka-input"
							disabled={loading}
						/>
					</div>

					<div>
						<div className="mb-2 flex items-center justify-between">
							<label className="text-sm font-semibold text-[var(--ink)]">Category ที่ต้องการผูก</label>
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

					<div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
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
							className="ka-btn ka-btn--primary"
							disabled={loading}
						>
							{loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
						</button>
					</div>
				</form>
			</div>

			<ActionResultDialog
				isOpen={resultDialog.isOpen}
				status={resultDialog.status}
				action="insert"
				message={resultDialog.message}
				onClose={handleResultClose}
			/>
		</div>
	);
}
