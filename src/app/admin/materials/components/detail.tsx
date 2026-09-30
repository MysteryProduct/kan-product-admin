'use client';

import Modal from '@/components/Modal';
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
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="รายละเอียดวัตถุดิบ"
			size="lg"
			footer={
				<button type="button" onClick={onClose} className="ka-btn">
					ปิด
				</button>
			}
		>
			<div className="space-y-6">
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
			</div>
		</Modal>
	);
}

