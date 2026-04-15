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
				<div className="absolute inset-0 bg-gray-300/40 dark:bg-gray-900/60" onClick={handleClose} />

				<div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
					<div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
						<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">เพิ่มวัตถุดิบ</h2>
						<button onClick={handleClose} className="text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" type="button">
							<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6 p-6">
						{error && (
							<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
								{error}
							</div>
						)}

						<div>
							<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
								ชื่อวัตถุดิบ <span className="text-red-500">*</span>
							</label>
							<input
								type="text"
								value={materialName}
								onChange={(e) => setMaterialName(e.target.value)}
								className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
								placeholder="กรอกชื่อวัตถุดิบ"
								disabled={isSubmitting}
							/>
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
								รายละเอียดวัตถุดิบ <span className="text-red-500">*</span>
							</label>
							<textarea
								rows={5}
								value={materialDescription}
								onChange={(e) => setMaterialDescription(e.target.value)}
								className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
								placeholder="กรอกรายละเอียดวัตถุดิบ"
								disabled={isSubmitting}
							/>
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
								ราคา <span className="text-red-500">*</span>
							</label>
							<input
								type="number"
								min="0"
								step="0.01"
								value={materialPrice}
								onChange={(e) => setMaterialPrice(Number(e.target.value))}
								className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
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

						<div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
							<button
								type="button"
								onClick={handleClose}
								className="rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
								disabled={isSubmitting}
							>
								ยกเลิก
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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

