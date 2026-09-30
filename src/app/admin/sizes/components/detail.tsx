'use client';

import type { Size } from '@/types/size';
import Modal from '@/components/Modal';

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
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="รายละเอียดขนาดสินค้า"
			size="lg"
			footer={
				<button type="button" onClick={onClose} className="ka-btn">
					ปิด
				</button>
			}
		>
			<div className="space-y-6">
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
			</div>
		</Modal>
	);
}
