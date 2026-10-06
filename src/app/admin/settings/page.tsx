'use client';

import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import BankAccountModel from '@/models/bank-account';
import SettingsModel from '@/models/settings';
import { BankAccount } from '@/types/bank-account';
import { AppSettings } from '@/types/settings';
import {
	SHOP_CONTACT_LIMITS,
	emptyShopContact,
	shopContactFrom,
	shopContactPayload,
	validateShopContact,
} from '@/lib/shop-contact';
import { usePermissions } from '@/hooks/usePermissions';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';

const settingsModel = new SettingsModel();
const bankAccountModel = new BankAccountModel();

// TASK-0038: the shop's identity for full tax invoices. Every field may stay
// blank until the shop registers for VAT; a blank field is saved as empty.
const emptyShopIdentity = {
	shop_name: '',
	shop_address: '',
	shop_tax_id: '',
	shop_branch_type: '',
	shop_branch_code: '',
};

const shopIdentityFrom = (settings: AppSettings | null) => ({
	shop_name: settings?.shop_name ?? '',
	shop_address: settings?.shop_address ?? '',
	shop_tax_id: settings?.shop_tax_id ?? '',
	shop_branch_type: settings?.shop_branch_type ?? '',
	shop_branch_code: settings?.shop_branch_code ?? '',
});

const inputClass =
	'ka-input';

export default function SettingsPage() {
	const { can } = usePermissions();
	const canEditSettings = can('settings', 'edit');
	const canAddSettings = can('settings', 'add');

	const [loading, setLoading] = useState(true);
	const [bankAccountsError, setBankAccountsError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

	const [formData, setFormData] = useState({
		setting_id: '',
		account_id: '',
		vat_rate: '7',
		...emptyShopIdentity,
		...emptyShopContact,
	});
	const [errors, setErrors] = useState<Record<string, string>>({});

	const [resultDialog, setResultDialog] = useState<{
		isOpen: boolean;
		status: 'success' | 'error';
		action: ActionResultDialogAction;
		message: string;
	}>({
		isOpen: false,
		status: 'success',
		action: 'update',
		message: '',
	});

	useEffect(() => {
		const bootstrap = async () => {
			try {
				setLoading(true);
				// The bank accounts are only choices; when they fail the settings still load and the person
				// is told which list is missing.
				setBankAccountsError(null);
				const [settingsResult, bankAccountResult] = await Promise.allSettled([
					settingsModel.getSettings(),
					bankAccountModel.getBankAccounts(1, 200),
				]);
				if (settingsResult.status === 'rejected') throw settingsResult.reason;
				const settingsData = settingsResult.value;

				setSettings(settingsData);

				if (bankAccountResult.status === 'fulfilled') {
					setBankAccounts(bankAccountResult.value.data || []);
				} else {
					console.error('Failed to load bank accounts:', bankAccountResult.reason);
					setBankAccountsError(loadErrorText('บัญชีรับเงิน', bankAccountResult.reason));
				}
				setFormData({
					setting_id: settingsData?.setting_id || '',
					account_id: settingsData?.account_id || '',
					vat_rate: String(settingsData?.vat_rate ?? 7),
					...shopIdentityFrom(settingsData),
					...shopContactFrom(settingsData),
				});
			} catch (error) {
				setResultDialog({
					isOpen: true,
					status: 'error',
					action: 'update',
					message: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลตั้งค่าได้',
				});
			} finally {
				setLoading(false);
			}
		};

		void bootstrap();
	}, []);

	// With no settings row the person is creating the first one, which needs the add permission.
	const hasSettingsRow = Boolean(settings?.setting_id);
	const canSave = hasSettingsRow ? canEditSettings : canAddSettings;

	const selectedBankLabel = useMemo(() => {
		const selected = bankAccounts.find((item) => item.account_id === formData.account_id);
		if (!selected) {
			return '-';
		}
		return `${selected.bank_name} - ${selected.account_number}`;
	}, [bankAccounts, formData.account_id]);

	const validate = () => {
		const nextErrors: Record<string, string> = {};
		const vatRate = Number(formData.vat_rate);

		if (!formData.account_id) {
			nextErrors.account_id = 'กรุณาเลือกบัญชีรับเงินเริ่มต้น';
		}

		if (Number.isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
			nextErrors.vat_rate = 'อัตรา VAT ต้องอยู่ระหว่าง 0 - 100';
		}

		const shopTaxId = formData.shop_tax_id.replace(/[\s-]/g, '');
		if (shopTaxId && !/^\d{13}$/.test(shopTaxId)) {
			nextErrors.shop_tax_id = 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก';
		}

		Object.assign(nextErrors, validateShopContact(formData));

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!validate()) {
			return;
		}

		try {
			setSaving(true);
			const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;

			const fields = {
				account_id: formData.account_id,
				vat_rate: Number(formData.vat_rate),
				shop_name: formData.shop_name.trim() || null,
				shop_address: formData.shop_address.trim() || null,
				shop_tax_id: formData.shop_tax_id.replace(/[\s-]/g, '') || null,
				shop_branch_type:
					(formData.shop_branch_type as 'head_office' | 'branch' | '') || null,
				shop_branch_code:
					formData.shop_branch_type === 'branch'
						? formData.shop_branch_code.trim() || null
						: null,
				...shopContactPayload(formData),
			};
			// With no row yet there is nothing to edit: the first save creates it.
			const updated = settings?.setting_id
				? await settingsModel.updateSettings({ ...fields, setting_id: settings.setting_id })
				: await settingsModel.createSettings(fields);

			setSettings(updated);
			setResultDialog({
				isOpen: true,
				status: 'success',
				action: 'update',
				message: settings?.setting_id
					? 'บันทึกการตั้งค่าพื้นฐานสำเร็จ'
					: 'สร้างการตั้งค่าพื้นฐานสำเร็จ',
			});
		} catch (error) {
			setResultDialog({
				isOpen: true,
				status: 'error',
				action: 'update',
				message: error instanceof Error ? error.message : 'ไม่สามารถบันทึกการตั้งค่าได้',
			});
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
				<LoadingSkeletonProps />
			</div>
		);
	}

	return (
		<div className="bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
			<section className="rounded-2xl bg-[var(--bg-surface)] shadow-sm">
				<div className="border-b border-[var(--border)] p-4">
					<h2 className="text-lg font-semibold text-[var(--ink)]">ตั้งค่าพื้นฐานระบบ</h2>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
					<LoadErrorBanner message={bankAccountsError} />
					{!hasSettingsRow && (
						<p className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-sm text-[var(--ink-muted)]">
							{canAddSettings
								? 'ยังไม่มีการตั้งค่าพื้นฐานในระบบ เลือกบัญชีรับเงินและอัตรา VAT แล้วกดบันทึกเพื่อสร้างการตั้งค่า'
								: 'ยังไม่มีการตั้งค่าพื้นฐานในระบบ และบัญชีนี้ไม่มีสิทธิ์สร้าง กรุณาติดต่อผู้ดูแลระบบ'}
						</p>
					)}
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--ink)]">บัญชีรับเงินเริ่มต้น</label>
							<select
								value={formData.account_id}
								onChange={(event) => setFormData((prev) => ({ ...prev, account_id: event.target.value }))}
								className="ka-input"
								disabled={!canSave || saving}
							>
								<option value="">เลือกบัญชี</option>
								{bankAccounts.map((account) => (
									<option key={account.account_id} value={account.account_id}>
										{account.bank_name} - {account.account_number} ({account.account_name})
									</option>
								))}
							</select>
							{errors.account_id && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.account_id}</p>}
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-[var(--ink)]">อัตรา VAT (%)</label>
							<input
								type="number"
								min={0}
								max={100}
								step="0.01"
								value={formData.vat_rate}
								onChange={(event) => setFormData((prev) => ({ ...prev, vat_rate: event.target.value }))}
								className="ka-input"
								disabled={!canSave || saving}
							/>
							{errors.vat_rate && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.vat_rate}</p>}
						</div>
					</div>

					<fieldset className="space-y-4">
						<legend className="text-sm font-semibold text-[var(--ink)]">ข้อมูลร้านสำหรับใบกำกับภาษี</legend>
						<p className="text-[13px] text-[var(--ink-muted)]">
							เว้นว่างได้จนกว่าร้านจะจดทะเบียน VAT
						</p>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="md:col-span-2">
								<label htmlFor="shop_name" className="mb-2 block text-sm font-medium text-[var(--ink)]">ชื่อร้านหรือบริษัท</label>
								<input
									id="shop_name"
									type="text"
									maxLength={200}
									value={formData.shop_name}
									onChange={(event) => setFormData((prev) => ({ ...prev, shop_name: event.target.value }))}
									className={inputClass}
									disabled={!canSave || saving}
								/>
							</div>
							<div className="md:col-span-2">
								<label htmlFor="shop_address" className="mb-2 block text-sm font-medium text-[var(--ink)]">ที่อยู่</label>
								<textarea
									id="shop_address"
									rows={3}
									maxLength={500}
									value={formData.shop_address}
									onChange={(event) => setFormData((prev) => ({ ...prev, shop_address: event.target.value }))}
									className={`${inputClass} h-auto py-2`}
									disabled={!canSave || saving}
								/>
							</div>
							<div>
								<label htmlFor="shop_tax_id" className="mb-2 block text-sm font-medium text-[var(--ink)]">เลขประจำตัวผู้เสียภาษี</label>
								<input
									id="shop_tax_id"
									type="text"
									inputMode="numeric"
									maxLength={17}
									value={formData.shop_tax_id}
									onChange={(event) => setFormData((prev) => ({ ...prev, shop_tax_id: event.target.value }))}
									className={inputClass}
									aria-invalid={Boolean(errors.shop_tax_id)}
									aria-describedby={errors.shop_tax_id ? 'shop_tax_id_error' : undefined}
									disabled={!canSave || saving}
								/>
								{errors.shop_tax_id && <p id="shop_tax_id_error" className="mt-1 text-[13px] text-[var(--danger)]">{errors.shop_tax_id}</p>}
							</div>
							<div>
								<label htmlFor="shop_branch_type" className="mb-2 block text-sm font-medium text-[var(--ink)]">สำนักงานใหญ่/สาขา</label>
								<select
									id="shop_branch_type"
									value={formData.shop_branch_type}
									onChange={(event) => setFormData((prev) => ({ ...prev, shop_branch_type: event.target.value }))}
									className={inputClass}
									disabled={!canSave || saving}
								>
									<option value="">ยังไม่ระบุ</option>
									<option value="head_office">สำนักงานใหญ่</option>
									<option value="branch">สาขา</option>
								</select>
							</div>
							{formData.shop_branch_type === 'branch' && (
								<div>
									<label htmlFor="shop_branch_code" className="mb-2 block text-sm font-medium text-[var(--ink)]">ชื่อหรือเลขที่สาขา</label>
									<input
										id="shop_branch_code"
										type="text"
										maxLength={50}
										value={formData.shop_branch_code}
										onChange={(event) => setFormData((prev) => ({ ...prev, shop_branch_code: event.target.value }))}
										className={inputClass}
										disabled={!canSave || saving}
									/>
								</div>
							)}
						</div>
					</fieldset>

					<fieldset className="space-y-4">
						<legend className="text-sm font-semibold text-[var(--ink)]">ช่องทางติดต่อร้าน (แสดงบนหน้าร้าน)</legend>
						<p className="text-[13px] text-[var(--ink-muted)]">
							เว้นว่างช่องไหน หน้าร้านจะไม่แสดงช่องนั้น
						</p>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							{(
								[
									{ name: 'shop_phone', label: 'เบอร์โทร', inputMode: 'tel', placeholder: 'เช่น 0812345678' },
									{ name: 'shop_email', label: 'อีเมล', inputMode: 'email', placeholder: 'เช่น shop@example.com' },
									{ name: 'shop_line', label: 'LINE (ไอดีที่ขึ้นต้นด้วย @ หรือลิงก์ line.me / lin.ee)', inputMode: 'text', placeholder: 'เช่น @shopname' },
									{ name: 'shop_hours', label: 'เวลาทำการ', inputMode: 'text', placeholder: 'เช่น 09.00-17.30 น.' },
								] as const
							).map((field) => (
								<div key={field.name}>
									<label htmlFor={field.name} className="mb-2 block text-sm font-medium text-[var(--ink)]">{field.label}</label>
									<input
										id={field.name}
										type="text"
										inputMode={field.inputMode}
										maxLength={SHOP_CONTACT_LIMITS[field.name]}
										placeholder={field.placeholder}
										value={formData[field.name]}
										onChange={(event) => setFormData((prev) => ({ ...prev, [field.name]: event.target.value }))}
										className={inputClass}
										aria-invalid={Boolean(errors[field.name])}
										aria-describedby={errors[field.name] ? `${field.name}_error` : undefined}
										disabled={!canSave || saving}
									/>
									{errors[field.name] && <p id={`${field.name}_error`} className="mt-1 text-[13px] text-[var(--danger)]">{errors[field.name]}</p>}
								</div>
							))}
						</div>
					</fieldset>

					<div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
						<h3 className="text-sm font-semibold text-[var(--ink)]">ข้อมูลตั้งค่าปัจจุบัน</h3>
						<div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[var(--ink-muted)] md:grid-cols-2">
							<p>
								บัญชีที่ใช้งาน: <span className="font-medium text-[var(--ink)]">{selectedBankLabel}</span>
							</p>
							<p>
								VAT ปัจจุบัน: <span className="font-medium text-[var(--ink)]">{settings?.vat_rate ?? Number(formData.vat_rate)}%</span>
							</p>
						</div>
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={!canSave || saving}
							className="ka-btn ka-btn--primary"
						>
							{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
						</button>
					</div>
				</form>
			</section>

			<ActionResultDialog
				isOpen={resultDialog.isOpen}
				status={resultDialog.status}
				action={resultDialog.action}
				message={resultDialog.message}
				onClose={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
			/>
		</div>
	);
}
