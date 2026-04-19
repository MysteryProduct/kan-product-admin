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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-300/40 p-4 backdrop-blur-sm dark:bg-gray-900/60">
			<div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-800">
				<div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-5 shadow-lg">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-2xl font-bold text-white">รายละเอียดวัตถุดิบ</h2>
						<button
							onClick={onClose}
							className="rounded-xl p-2 text-white transition-all duration-200 hover:bg-white/20 hover:text-gray-100"
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
							<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รหัสวัตถุดิบ</label>
							<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
								{material.material_id}
							</div>
						</div>
						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">วันที่เพิ่ม</label>
							<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
								{formatThaiDate(material.adddate)}
							</div>
						</div>
					</div>

					<div>
						<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">ชื่อวัตถุดิบ</label>
						<div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
							{material.material_name}
						</div>
					</div>

					<div>
						<label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รายละเอียดวัตถุดิบ</label>
						<div className="min-h-[120px] whitespace-pre-line rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
							{material.material_description || '-'}
						</div>
					</div>

					<div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 shadow-lg">
						<div className="flex items-center justify-between">
							<span className="text-lg font-semibold text-white">ราคา</span>
							<span className="text-2xl font-bold text-white">฿{formatCurrency(Number(material.material_price || 0))}</span>
						</div>
					</div>

					<div className="border-t border-gray-200 pt-4 dark:border-gray-700">
						<button
							type="button"
							onClick={onClose}
							className="w-full rounded-xl border-2 border-gray-300 bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
						>
							ปิด
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

