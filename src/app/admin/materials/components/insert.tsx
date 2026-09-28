'use client';

import { useEffect, useState } from 'react';
import MaterialModel from '@/models/material';
import ActionResultDialog from '@/components/ActionResultDialog';
import SizeModel from '@/models/size';
import ColorModel from '@/models/color';
import CustomSelect from '@/components/CustomSelect';
interface InsertMaterialFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}
interface Color {
	color_id: number;
	color_name: string;
	color_hex: string;
}

interface Size {
	size_id: number;
	size_name: string;
}

const materialModel = new MaterialModel();
const sizeModel = new SizeModel();
const colorModel = new ColorModel();

export default function InsertMaterialForm({ isOpen, onClose, onSuccess }: InsertMaterialFormProps) {
	const [materialName, setMaterialName] = useState('');
	const [materialDescription, setMaterialDescription] = useState('');
	const [materialPrice, setMaterialPrice] = useState(0);
	const [materialSize, setMaterialSize] = useState<number>(0);
	const [materialColor, setMaterialColor] = useState<number>(0);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sizeOptions, setSizeOptions] = useState<Size[]>([]);
	const [colorOptions, setColorOptions] = useState<Color[]>([]);

	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		message: '',
	});

	const resetForm = () => {
		setMaterialName('');
		setMaterialDescription('');
		setMaterialPrice(0);
		setMaterialSize(0);
		setMaterialColor(0);
		setError(null);
	};

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const fetchOptions = async () => {
			const sizes = await sizeModel.getSizes();
			const colors = await colorModel.getColors();
			setSizeOptions(sizes.data);
			setColorOptions(colors.data);
		};
		fetchOptions();
	}, [isOpen]);


	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const price = Number(materialPrice);
		if (!materialName.trim()) {
			setError('กรุณากรอกชื่อวัตถุดิบ');
			return;
		}
		if (!materialDescription.trim()) {
			setError('กรุณากรอกรายละเอียดวัตถุดิบ');
			return;
		}
		if (Number.isNaN(price) || price < 0) {
			setError('กรุณากรอกราคาที่ถูกต้อง');
			return;
		}
		if (!materialColor || materialColor === 0) {
			setError('กรุณาเลือกสี');
			return;
		}
		if (!materialSize || materialSize === 0) {
			setError('กรุณาเลือกขนาด');
			return;
		}

		setIsSubmitting(true);
		try {
			await materialModel.createMaterial({
				material_name: materialName.trim(),
				material_description: materialDescription.trim(),
				material_price: price,
				size_id: materialSize,
				color_id: materialColor,
			});

			setResultDialog({
				isOpen: true,
				status: 'success',
				message: 'เพิ่มวัตถุดิบสำเร็จ',
			});
		} catch (submitError) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				message: submitError instanceof Error ? submitError.message : 'เกิดข้อผิดพลาดในการเพิ่มวัตถุดิบ',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResultDialogClose = () => {
		const isSuccess = resultDialog.status === 'success';
		setResultDialog((prev) => ({ ...prev, isOpen: false }));
		if (isSuccess) {
			resetForm();
			onSuccess();
			onClose();
		}
	};

	const handleClose = () => {
		if (isSubmitting) {
			return;
		}
		resetForm();
		onClose();
	};

	if (!isOpen) {
		return null;
	}

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div className="absolute inset-0 bg-[var(--scrim)]" onClick={handleClose} />

				<div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--bg-surface)] shadow-xl">
					<div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-4">
						<h2 className="text-xl font-semibold text-[var(--ink)]">เพิ่มวัตถุดิบ</h2>
						<button onClick={handleClose} className="ka-btn ka-btn--ghost ka-btn--icon" type="button" aria-label="ปิดหน้าต่าง">
							<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6 p-6">
						{error && (
							<div className="rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-[var(--danger)]">
								{error}
							</div>
						)}

						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--ink)]">
								ชื่อวัตถุดิบ <span className="text-[var(--danger)]">*</span>
							</label>
							<input
								type="text"
								value={materialName}
								onChange={(e) => setMaterialName(e.target.value)}
								className="ka-input"
								placeholder="กรอกชื่อวัตถุดิบ"
								disabled={isSubmitting}
							/>
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--ink)]">
								รายละเอียดวัตถุดิบ <span className="text-[var(--danger)]">*</span>
							</label>
							<textarea
								rows={5}
								value={materialDescription}
								onChange={(e) => setMaterialDescription(e.target.value)}
								className="ka-textarea resize-none"
								placeholder="กรอกรายละเอียดวัตถุดิบ"
								disabled={isSubmitting}
							/>
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--ink)]">
								ราคา <span className="text-[var(--danger)]">*</span>
							</label>
							<input
								type="number"
								min="0"
								step="0.01"
								value={materialPrice}
								onChange={(e) => setMaterialPrice(Number(e.target.value))}
								className="ka-input"
								placeholder="0.00"
								disabled={isSubmitting}
							/>
						</div>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							
							<CustomSelect
								label="สี"
								required
								value={Number(materialColor)}
								onChange={(value) => setMaterialColor(Number(value))}
								options={colorOptions.map((color) => ({
									value: color.color_id,
									label: color.color_name,
								}))}
								placeholder="เลือกสี"
								showColor
							/>

							<CustomSelect
								label="ขนาด"
								required
								value={Number(materialSize)}
								onChange={(value) => setMaterialSize(Number(value))}
								options={sizeOptions.map((size) => ({
									value: size.size_id,
									label: size.size_name,
								}))}
								placeholder="เลือกหน่วยสินค้า"
							/>
						</div>

						<div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
							<button
								type="button"
								onClick={handleClose}
								className="ka-btn"
								disabled={isSubmitting}
							>
								ยกเลิก
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								className="ka-btn ka-btn--primary"
							>
								{isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
							</button>
						</div>
					</form>
				</div>
			</div>

			<ActionResultDialog
				isOpen={resultDialog.isOpen}
				status={resultDialog.status}
				action="insert"
				message={resultDialog.message}
				onClose={handleResultDialogClose}
			/>
		</>
	);
}

