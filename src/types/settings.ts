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

// How a shopper reaches the shop (TASK-0046); null = not shown on the Store.
export interface ShopContactChannels {
  shop_phone?: string | null;
  shop_email?: string | null;
  shop_line?: string | null;
  shop_hours?: string | null;
}

export interface AppSettings extends ShopTaxIdentity, ShopContactChannels {
  setting_id: string;
  account_id: string;
  vat_rate: number;
  account?: BankAccount;
}

export interface UpdateSettingsDto extends ShopTaxIdentity, ShopContactChannels {
  setting_id: string;
  account_id: string;
  vat_rate: number;
  update_by?: string;
}

// The first row of settings: it needs a bank account and a VAT rate.
export type CreateSettingsDto = Omit<UpdateSettingsDto, 'setting_id' | 'update_by'>;
