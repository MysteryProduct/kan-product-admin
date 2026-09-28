'use client';

import { Material } from '@/types/material';
import { formatThaiDate } from '@/lib/date-format';

interface MaterialDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	material: Material;
}

export default function MaterialDetailModal({ isOpen, onClose, material }: MaterialDetailModalProps) {
	if (!isOpen) {
		return null;
	}

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('th-TH', {
			style: 'decimal',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm">
			<div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-[var(--color-bg-primary)] overlay-surface ">
				<div className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-2xl font-bold text-[var(--ink)]">รายละเอียดวัตถุดิบ</h2>
						<button
							onClick={onClose}
							className="ka-btn ka-btn--ghost ka-btn--icon"
							aria-label="ปิดหน้าต่าง"
							type="button"
						>
							<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<div className="space-y-6 p-6">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รหัสวัตถุดิบ</label>
							<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
								{material.material_id}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">วันที่เพิ่ม</label>
							<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
								{formatThaiDate(material.adddate)}
							</div>
						</div>
					</div>

					<div>
						<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">ชื่อวัตถุดิบ</label>
						<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
							{material.material_name}
						</div>
					</div>

					<div>
						<label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รายละเอียดวัตถุดิบ</label>
						<div className="min-h-[120px] whitespace-pre-line rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-[var(--ink)] shadow-sm">
							{material.material_description || '-'}
						</div>
					</div>

					<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-5">
						<div className="flex items-center justify-between">
							<span className="text-lg font-semibold text-[var(--ink)]">ราคา</span>
							<span className="text-2xl font-bold text-[var(--ink)]">฿{formatCurrency(Number(material.material_price || 0))}</span>
						</div>
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

