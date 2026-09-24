import { BankAccount } from './bank-account';

// The shop's identity as printed on a full tax invoice (TASK-0038); empty
// until the shop registers for VAT.
export interface ShopTaxIdentity {
  shop_name?: string | null;
  shop_address?: string | null;
  shop_tax_id?: string | null;
  shop_branch_type?: 'head_office' | 'branch' | null;
  shop_branch_code?: string | null;
}

export interface AppSettings extends ShopTaxIdentity {
  setting_id: string;
  account_id: string;
  vat_rate: number;
  account?: BankAccount;
}

export interface UpdateSettingsDto extends ShopTaxIdentity {
  setting_id: string;
  account_id: string;
  vat_rate: number;
  update_by?: string;
}
