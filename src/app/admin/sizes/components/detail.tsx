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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm">
			<div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] overlay-surface">
				<div className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-xl font-bold text-[var(--ink)] sm:text-2xl">รายละเอียดขนาดสินค้า</h2>
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

				<div className="space-y-6 p-6">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">Size ID</label>
							<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-[var(--ink)]">
								{size.size_id}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">ชื่อขนาดสินค้า</label>
							<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-[var(--ink)]">
								{size.size_name}
							</div>
						</div>
					</div>

					<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
						<div className="mb-3 flex items-center justify-between gap-3">
							<h3 className="text-base font-semibold text-[var(--ink)]">Category ที่เชื่อมโยง</h3>
							<span className="rounded-full bg-[var(--neutral-soft)] px-3 py-1 text-[13px] font-semibold text-[var(--neutral)]">
								ทั้งหมด {categories.length}
							</span>
						</div>

						{categories.length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{categories.map((category) => (
									<span
										key={category.category_id}
										className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-sm font-medium text-[var(--ink)]"
									>
										{category.category_name}
									</span>
								))}
							</div>
						) : (
							<p className="text-sm text-[var(--ink-muted)]">ยังไม่มี Category ที่เชื่อมโยง</p>
						)}
					</div>

					<div className="border-t border-[var(--border)] pt-4">
						<button
							type="button"
							onClick={onClose}
							className="ka-btn w-full"
						>
							ปิด
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
