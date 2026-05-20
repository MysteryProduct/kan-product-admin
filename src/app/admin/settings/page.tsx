'use client';

import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import BankAccountModel from '@/models/bank-account';
import SettingsModel from '@/models/settings';
import { BankAccount } from '@/types/bank-account';
import { AppSettings } from '@/types/settings';
import { usePermissions } from '@/hooks/usePermissions';

const settingsModel = new SettingsModel();
const bankAccountModel = new BankAccountModel();

export default function SettingsPage() {
	const { can } = usePermissions();
	const canEditSettings = can('settings', 'edit');

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

	const [formData, setFormData] = useState({
		setting_id: '',
		account_id: '',
		vat_rate: '7',
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
				const [settingsData, bankAccountData] = await Promise.all([
					settingsModel.getSettings(),
					bankAccountModel.getBankAccounts(1, 200),
				]);

				setSettings(settingsData);
				
				setBankAccounts(bankAccountData.data || []);
				setFormData({
					setting_id: settingsData?.setting_id || '',
					account_id: settingsData?.account_id || '',
					vat_rate: String(settingsData?.vat_rate ?? 7),
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

			const updated = await settingsModel.updateSettings({
				setting_id: settings?.setting_id || '',
				account_id: formData.account_id,
				vat_rate: Number(formData.vat_rate),
				// update_by: user?.employee_id,
			});

			setSettings(updated);
			setResultDialog({
				isOpen: true,
				status: 'success',
				action: 'update',
				message: 'บันทึกการตั้งค่าพื้นฐานสำเร็จ',
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
			<div className="bg-gray-50 p-2 dark:bg-gray-900 sm:p-4 md:p-6 lg:p-8">
				<LoadingSkeletonProps />
			</div>
		);
	}

	return (
		<div className="bg-gray-50 p-2 dark:bg-gray-900 sm:p-4 md:p-6 lg:p-8">
			<section className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
				<div className="border-b border-gray-100 p-4 dark:border-gray-700">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ตั้งค่าพื้นฐานระบบ</h2>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						หน้านี้ใช้สำหรับแก้ไขค่าตั้งต้นของระบบเท่านั้น โดยจะแสดงข้อมูลปัจจุบันทันที
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">บัญชีรับเงินเริ่มต้น</label>
							<select
								value={formData.account_id}
								onChange={(event) => setFormData((prev) => ({ ...prev, account_id: event.target.value }))}
								className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
								disabled={!canEditSettings || saving}
							>
								<option value="">เลือกบัญชี</option>
								{bankAccounts.map((account) => (
									<option key={account.account_id} value={account.account_id}>
										{account.bank_name} - {account.account_number} ({account.account_name})
									</option>
								))}
							</select>
							{errors.account_id && <p className="mt-1 text-xs text-red-500">{errors.account_id}</p>}
						</div>

						<div>
							<label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">อัตรา VAT (%)</label>
							<input
								type="number"
								min={0}
								max={100}
								step="0.01"
								value={formData.vat_rate}
								onChange={(event) => setFormData((prev) => ({ ...prev, vat_rate: event.target.value }))}
								className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
								disabled={!canEditSettings || saving}
							/>
							{errors.vat_rate && <p className="mt-1 text-xs text-red-500">{errors.vat_rate}</p>}
						</div>
					</div>

					<div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
						<h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">ข้อมูลตั้งค่าปัจจุบัน</h3>
						<div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-2">
							<p>
								บัญชีที่ใช้งาน: <span className="font-medium text-gray-800 dark:text-gray-100">{selectedBankLabel}</span>
							</p>
							<p>
								VAT ปัจจุบัน: <span className="font-medium text-gray-800 dark:text-gray-100">{settings?.vat_rate ?? Number(formData.vat_rate)}%</span>
							</p>
						</div>
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={!canEditSettings || saving}
							className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
