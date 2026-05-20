import { BankAccount } from './bank-account';

export interface AppSettings {
  setting_id: string;
  account_id: string;
  vat_rate: number;
  account?: BankAccount;
}

export interface UpdateSettingsDto {
  setting_id: string;
  account_id: string;
  vat_rate: number;
  update_by?: string;
}
