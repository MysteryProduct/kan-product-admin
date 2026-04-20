'use client';

import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import CustomSelect from '@/components/CustomSelect';
import MaterialModel from '@/models/material';
import ProductModel from '@/models/product';
import JobOrderModel from '@/models/job-order';
import ColorModel from '@/models/color';
import SizeModel from '@/models/size';
import { Material } from '@/types/material';
import { CreateJobOrderDto, JobOrderType } from '@/types/job-order';
import { Product } from '@/types/product';
import { Color } from '@/types/color';
import { Size } from '@/types/size';

interface InsertJobOrderFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	initialData?: Partial<CreateJobOrderDto> | null;
}

interface MaterialRow {
	id: string;
	material_id: string;
	material_qty: number;
	material_name?: string;
}

interface ProductVariantOption {
	value: string;
	label: string;
	productName: string;
	sizeId?: number;
	colorId?: number;
	productPrice?: number;
	materials: Array<{
		material_id: string;
		material_qty: number;
		material_name?: string;
	}>;
}

const materialModel = new MaterialModel();
const productModel = new ProductModel();
const jobOrderModel = new JobOrderModel();
const colorModel = new ColorModel();
const sizeModel = new SizeModel();

const JOB_ORDER_TYPES: Array<{ value: JobOrderType; label: string }> = [
	{ value: 'website', label: 'ผลิตเพื่อขายบน website' },
	{ value: 'purchase', label: 'ผลิตจากการสั่งซื้อ' },
];

const getDefaultTargetDate = () => {
	return new Date().toISOString().slice(0, 10);
};

const getUserFromCookie = () => {
	try {
		const raw = Cookies.get('user');
		if (!raw) {
			return null;
		}
		return JSON.parse(raw) as {
			employee_id?: string;
			employee_firstname?: string;
			employee_lastname?: string;
			employee_fullname?: string;
			firstName?: string;
			lastName?: string;
		};
	} catch (error) {
		console.error('Cannot parse user cookie:', error);
		return null;
	}
};

const buildInitialMaterials = (materials?: CreateJobOrderDto['jobOrderMaterials']): MaterialRow[] => {
	if (!materials || materials.length === 0) {
		return [{ id: crypto.randomUUID(), material_id: '', material_qty: 1 }];
	}

	return materials.map((item) => ({
		id: crypto.randomUUID(),
		material_id: item.material_id,
		material_qty: Number(item.material_qty) || 1,
		material_name: item.material_name,
	}));
};

export default function InsertJobOrderForm({
	isOpen,
	onClose,
	onSuccess,
	initialData,
}: InsertJobOrderFormProps) {
	const [jobOrderType, setJobOrderType] = useState<JobOrderType>('website');
	const [productVariantId, setProductVariantId] = useState('');
	const [jobOrderName, setJobOrderName] = useState('');
	const [jobOrderDescription, setJobOrderDescription] = useState('');
	const [jobOrderQty, setJobOrderQty] = useState('0');
	const [jobOrderPrice, setJobOrderPrice] = useState('0');
	const [targetDate, setTargetDate] = useState(getDefaultTargetDate());
	const [sizeId, setSizeId] = useState('');
	const [colorId, setColorId] = useState('');
	const [materials, setMaterials] = useState<MaterialRow[]>([{ id: crypto.randomUUID(), material_id: '', material_qty: 1 }]);
	const [materialOptions, setMaterialOptions] = useState<Material[]>([]);
	const [sizeOptions, setSizeOptions] = useState<Size[]>([]);
	const [colorOptions, setColorOptions] = useState<Color[]>([]);
	const [products, setProducts] = useState<Product[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		action: ActionResultDialogAction;
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		action: 'insert',
		message: '',
	});

	const user = useMemo(() => getUserFromCookie(), []);
	const assigneeName =
		user?.employee_fullname ||
		`${user?.employee_firstname || user?.firstName || ''} ${user?.employee_lastname || user?.lastName || ''}`.trim() ||
		'-';

	const variantOptions = useMemo(() => {
		const options: ProductVariantOption[] = [];

		products.forEach((product) => {
			const variants = product.product_variants || product.productVariants || [];
			variants.forEach((variant, index) => {
				if (!variant.product_variant_id) {
					return;
				}

				const materialsFromVariant = variant.product_materials || variant.productMaterials || [];
				const sizeName = variant.size?.size_name || '-';
				const colorName = variant.color?.color_name || '-';
				options.push({
					value: String(variant.product_variant_id),
					label: `${product.product_name} | ${sizeName} | ${colorName}`,
					productName: product.product_name,
					sizeId: variant.size_id,
					colorId: variant.color_id,
					productPrice: variant.product_variant_price,
					materials: materialsFromVariant.map((item) => ({
						material_id: item.material_id,
						material_qty: Number(item.material_qty) || 1,
						material_name: item.material?.material_name,
					})),
				});
			});
		});

		return options;
	}, [products]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const loadData = async () => {
			try {
				const [materialResponse, productResponse, colorResponse, sizeResponse] = await Promise.all([
					materialModel.getMaterials(1, 300),
					productModel.getProducts(1, 200),
					colorModel.getColors(1, 200),
					sizeModel.getSizes(1, 200),
				]);
				setMaterialOptions(materialResponse.data || []);
				setProducts(productResponse.data || []);
				setColorOptions(colorResponse.data || []);
				setSizeOptions(sizeResponse.data || []);
			} catch (error) {
				console.error('Failed to load insert form data:', error);
			}
		};

		void loadData();
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const nextType = (initialData?.job_order_type as JobOrderType) || 'website';
		setJobOrderType(nextType);
		setProductVariantId(initialData?.product_variant_id ? String(initialData.product_variant_id) : '');
		setJobOrderName(initialData?.job_order_name || '');
		setJobOrderDescription(initialData?.job_order_description || '');
		setJobOrderQty(typeof initialData?.job_order_qty === 'number' ? String(initialData.job_order_qty) : '0');
		setJobOrderPrice(typeof initialData?.job_order_price === 'number' ? String(initialData.job_order_price) : '0');
		setTargetDate(initialData?.target_date ? String(initialData.target_date).slice(0, 10) : getDefaultTargetDate());
		setSizeId(initialData?.size_id ? String(initialData.size_id) : '');
		setColorId(initialData?.color_id ? String(initialData.color_id) : '');
		setMaterials(buildInitialMaterials(initialData?.jobOrderMaterials));
		setErrors({});
	}, [isOpen, initialData]);

	const syncDefaultsFromVariant = (nextVariantId: string) => {
		const selected = variantOptions.find((option) => option.value === nextVariantId);
		if (!selected) {
			return;
		}
		
		setJobOrderName(selected.productName+" Size:"+ (sizeOptions.find(s => s.size_id === selected.sizeId)?.size_name || '-') +" Color:"+ (colorOptions.find(c => c.color_id === selected.colorId)?.color_name || '-'));
		setSizeId(selected.sizeId ? String(selected.sizeId) : '');
		setColorId(selected.colorId ? String(selected.colorId) : '');
		setJobOrderPrice(selected.productPrice ? String(selected.productPrice) : '0');

		if (selected.materials.length > 0) {
			setMaterials(
				selected.materials.map((item) => ({
					id: crypto.randomUUID(),
					material_id: item.material_id,
					material_qty: item.material_qty,
					material_name: item.material_name,
				})),
			);
		}
	};

	const handleTypeChange = (value: string) => {
		const nextType = value as JobOrderType;
		setJobOrderType(nextType);

		if (nextType !== 'website') {
			setProductVariantId('');
			setMaterials([{ id: crypto.randomUUID(), material_id: '', material_qty: 1 }]);
		}
	};

	const addMaterialRow = () => {
		setMaterials((prev) => [...prev, { id: crypto.randomUUID(), material_id: '', material_qty: 1 }]);
	};

	const removeMaterialRow = (id: string) => {
		setMaterials((prev) => {
			if (prev.length <= 1) {
				return prev;
			}
			return prev.filter((item) => item.id !== id);
		});
	};

	const updateMaterialRow = (id: string, field: keyof MaterialRow, value: string | number) => {
		setMaterials((prev) =>
			prev.map((item) => {
				if (item.id !== id) {
					return item;
				}

				return {
					...item,
					[field]: field === 'material_qty' ? Math.max(0, Number(value)) : value,
				};
			}),
		);
	};

	const handleMaterialSelect = (id: string, materialId: string) => {
		const selectedMaterial = materialOptions.find((material) => material.material_id === materialId);
		setMaterials((prev) =>
			prev.map((item) => {
				if (item.id !== id) {
					return item;
				}

				return {
					...item,
					material_id: materialId,
					material_name: selectedMaterial?.material_name,
				};
			}),
		);
	};

	const validate = () => {
		const nextErrors: Record<string, string> = {};

		if (!jobOrderName.trim()) {
			nextErrors.job_order_name = 'กรุณากรอกชื่องานผลิต';
		}

		if (!targetDate) {
			nextErrors.target_date = 'กรุณาเลือกวันที่เป้าหมาย';
		}

		if (Number(jobOrderQty) < 0 || Number.isNaN(Number(jobOrderQty))) {
			nextErrors.job_order_qty = 'จำนวนที่ผลิตต้องเป็นตัวเลขและต้องไม่ติดลบ';
		}

		if (!sizeId) {
			nextErrors.size_id = 'กรุณาเลือกขนาด';
		}

		if (!colorId) {
			nextErrors.color_id = 'กรุณาเลือกสี';
		}

		if (jobOrderType === 'website' && !productVariantId) {
			nextErrors.product_variant_id = 'กรุณาเลือก Product Variant สำหรับงานประเภท website';
		}

		const hasValidMaterial = materials.some((item) => item.material_id && item.material_qty > 0);
		if (!hasValidMaterial) {
			nextErrors.materials = 'กรุณาเพิ่มวัตถุดิบอย่างน้อย 1 รายการ';
		}

		materials.forEach((item, index) => {
			if (item.material_id && item.material_qty <= 0) {
				nextErrors[`material_${index}_qty`] = 'จำนวนวัตถุดิบต้องมากกว่า 0';
			}
		});

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!validate()) {
			return;
		}

		setIsSubmitting(true);
		try {
			const payload: CreateJobOrderDto = {
				job_order_name: jobOrderName.trim(),
				job_order_description: jobOrderDescription.trim(),
				job_order_qty: Number(jobOrderQty) || 0,			job_order_price: Number(jobOrderPrice) || 0,				job_order_type: jobOrderType,
				job_order_status: 'pending',
				product_variant_id: jobOrderType === 'website' ? productVariantId : null,
				size_id: sizeId ? Number(sizeId) : null,
				color_id: colorId ? Number(colorId) : null,
				target_date: targetDate,
				employee_id: user?.employee_id,
				create_by: user?.employee_id,
				jobOrderMaterials: materials
					.filter((item) => item.material_id && item.material_qty > 0)
					.map((item) => ({
						material_id: item.material_id,
						material_qty: item.material_qty,
						material_name: item.material_name || materialOptions.find((material) => material.material_id === item.material_id)?.material_name,
					})),
			};

			await jobOrderModel.createJobOrder(payload);
			setResultDialog({
				isOpen: true,
				status: 'success',
				action: 'insert',
				message: 'สร้างงานผลิตสำเร็จ (สถานะเริ่มต้น: รอดำเนินการ)',
			});
		} catch (error) {
			console.error('Failed to create job order:', error);
			setResultDialog({
				isOpen: true,
				status: 'error',
				action: 'insert',
				message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างงานผลิต',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResultDialogClose = () => {
		const isSuccess = resultDialog.status === 'success';
		setResultDialog((prev) => ({ ...prev, isOpen: false }));

		if (isSuccess) {
			onSuccess();
			onClose();
		}
	};

	if (!isOpen) {
		return null;
	}

	return (
		<>
			<div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
				<div className="mx-auto mt-3 sm:mt-8 max-w-4xl rounded-3xl border border-sky-100/70 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
					<div className="bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 px-5 sm:px-8 py-5 sm:py-6">
						<div className="flex items-center justify-between gap-4">
							<div>
								<h2 className="text-xl sm:text-2xl font-black text-white">สร้างงานผลิตสินค้า</h2>
							</div>
							<button
								type="button"
								onClick={onClose}
								disabled={isSubmitting}
								className="rounded-xl bg-white/20 text-white p-2 hover:bg-white/30 transition-colors"
								aria-label="close"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>

					<form onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 max-h-[calc(100vh-100px)] overflow-y-auto">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
							<CustomSelect
								label="ประเภทงานผลิต"
								required
								value={jobOrderType}
								onChange={handleTypeChange}
								options={JOB_ORDER_TYPES}
								placeholder="เลือกประเภทงาน"
							/>

							<div>
								<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">สถานะเริ่มต้น</label>
								<div className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 font-semibold">
									รอดำเนินการ
								</div>
							</div>

							<div className="md:col-span-2">
								<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
									ชื่องานผลิต <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									value={jobOrderName}
									onChange={(e) => setJobOrderName(e.target.value)}
									disabled={isSubmitting}
									placeholder="ระบุชื่องานผลิต"
									className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
								/>
								{errors.job_order_name && <p className="text-red-500 text-sm mt-1">{errors.job_order_name}</p>}
							</div>

							{jobOrderType === 'website' && (
								<div className="md:col-span-2">
									<CustomSelect
										label="Product Variant"
										required
										value={productVariantId}
										onChange={(value) => {
											setProductVariantId(value);
											syncDefaultsFromVariant(value);
										}}
										options={variantOptions.map((item) => ({ value: item.value, label: item.label }))}
										placeholder="เลือก product"
									/>
									{errors.product_variant_id && <p className="text-red-500 text-sm mt-1">{errors.product_variant_id}</p>}
								</div>
							)}

							<div>
								<CustomSelect
									label="ขนาด"
									required
									value={sizeId}
									onChange={setSizeId}
									options={sizeOptions.map((item) => ({ value: item.size_id, label: item.size_name }))}
									placeholder="เลือกขนาด"
								/>
								{errors.size_id && <p className="text-red-500 text-sm mt-1">{errors.size_id}</p>}
							</div>

							<div>
								<CustomSelect
									label="สี"
									required
									value={colorId}
									onChange={setColorId}
									options={colorOptions.map((item) => ({ value: item.color_id, label: item.color_name, color: item.color_hex }))}
									placeholder="เลือกสี"
									showColor
								/>
								{errors.color_id && <p className="text-red-500 text-sm mt-1">{errors.color_id}</p>}
							</div>

							<div>
								<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
									ผู้รับผิดชอบ
								</label>
								<div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
									{assigneeName}
								</div>
							</div>

							<div>
								<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
									วันที่เป้าหมาย <span className="text-red-500">*</span>
								</label>
								<input
									type="date"
									value={targetDate}
									onChange={(e) => setTargetDate(e.target.value)}
									disabled={isSubmitting}
									className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
								/>
								{errors.target_date && <p className="text-red-500 text-sm mt-1">{errors.target_date}</p>}
							</div>

							<div>
								<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">จำนวนที่ผลิต</label>
								<input
									type="number"
									min={0}
									step="1"
									value={jobOrderQty}
									onChange={(e) => setJobOrderQty(e.target.value)}
									disabled={isSubmitting}
									className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
								/>
								{errors.job_order_qty && <p className="text-red-500 text-sm mt-1">{errors.job_order_qty}</p>}
							</div>

								<div>
									<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">ราคาสินค้า (บาท)</label>
									<input
										type="number"
										min={0}
										step="0.01"
										value={jobOrderPrice}
										onChange={(e) => setJobOrderPrice(e.target.value)}
										disabled={isSubmitting}
										className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
									/>
									{errors.job_order_price && <p className="text-red-500 text-sm mt-1">{errors.job_order_price}</p>}
								</div>							</div>
						<div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-4 sm:p-5">
							<div className="flex items-center justify-between mb-4 gap-3">
								<div>
									<h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">วัตถุดิบ/ชิ้น</h3>
									<p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400"></p>
								</div>
								<button
									type="button"
									onClick={addMaterialRow}
									disabled={isSubmitting}
									className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
									</svg>
									เพิ่มวัตถุดิบ
								</button>
							</div>

							<div className="space-y-3">
								{materials.map((item, index) => {
									const selectedInOtherRows = new Set(
										materials
											.filter((row) => row.id !== item.id && row.material_id)
											.map((row) => row.material_id),
									);

									const options = materialOptions
										.filter((material) => !selectedInOtherRows.has(material.material_id))
										.map((material) => ({
											value: material.material_id,
											label: material.material_name,
										}));

									return (
										<div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
											<div className="md:col-span-7">
												<CustomSelect
													label={`วัตถุดิบ #${index + 1}`}
													value={item.material_id}
													onChange={(value) => handleMaterialSelect(item.id, value)}
													options={options}
													placeholder="เลือกวัตถุดิบ"
												/>
											</div>
											<div className="md:col-span-3">
												<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">จำนวน</label>
												<input
													type="number"
													min={0}
													step="0.01"
													value={item.material_qty}
													onChange={(e) => updateMaterialRow(item.id, 'material_qty', Number(e.target.value))}
													disabled={isSubmitting}
													className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
												/>
												{errors[`material_${index}_qty`] && (
													<p className="text-red-500 text-sm mt-1">{errors[`material_${index}_qty`]}</p>
												)}
											</div>
											<div className="md:col-span-2">
												<button
													type="button"
													onClick={() => removeMaterialRow(item.id)}
													disabled={isSubmitting || materials.length === 1}
													className="w-full px-3 py-2.5 rounded-xl border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
												>
													ลบ
												</button>
											</div>
										</div>
									);
								})}
							</div>
							{errors.materials && <p className="text-red-500 text-sm mt-2">{errors.materials}</p>}
						</div>

						<div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={onClose}
								disabled={isSubmitting}
								className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
							>
								ยกเลิก
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-semibold hover:from-sky-700 hover:to-cyan-700 transition-colors disabled:opacity-60"
							>
								{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกงานผลิต'}
							</button>
						</div>
					</form>
				</div>
			</div>

			<ActionResultDialog
				isOpen={resultDialog.isOpen}
				status={resultDialog.status}
				action={resultDialog.action}
				message={resultDialog.message}
				onClose={handleResultDialogClose}
			/>
		</>
	);
}
