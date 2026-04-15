'use client';

import type { Size } from '@/types/size';

interface SizeDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	size: Size | null;
}

export default function SizeDetailModal({ isOpen, onClose, size }: SizeDetailModalProps) {
	if (!isOpen || !size) {
		return null;
	}

	const categories = size.category ?? [];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
			<div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
				<div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-xl font-bold text-white sm:text-2xl">รายละเอียดขนาดสินค้า</h2>
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

				<div className="space-y-6 p-6">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Size ID</label>
							<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
								{size.size_id}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">ชื่อขนาดสินค้า</label>
							<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
								{size.size_name}
							</div>
						</div>
					</div>

					<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
						<div className="mb-3 flex items-center justify-between gap-3">
							<h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Category ที่เชื่อมโยง</h3>
							<span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
								ทั้งหมด {categories.length}
							</span>
						</div>

						{categories.length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{categories.map((category) => (
									<span
										key={category.category_id}
										className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-sm font-medium text-indigo-700 dark:border-indigo-700/50 dark:bg-slate-800 dark:text-indigo-300"
									>
										{category.category_name}
									</span>
								))}
							</div>
						) : (
							<p className="text-sm text-slate-500 dark:text-slate-400">ยังไม่มี Category ที่เชื่อมโยง</p>
						)}
					</div>

					<div className="border-t border-slate-200 pt-4 dark:border-slate-700">
						<button
							type="button"
							onClick={onClose}
							className="w-full rounded-xl border border-slate-300 bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
						>
							ปิด
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
