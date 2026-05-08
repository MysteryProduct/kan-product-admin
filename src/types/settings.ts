import { BankAccount } from './bank-account';

export interface AppSettings {
  account_id: string;
  vat_rate: number;
  account?: BankAccount;
}

export interface UpdateSettingsDto {
  account_id: string;
  vat_rate: number;
  update_by?: string;
}
