import { PaginationMeta } from './pagination';

export interface BankAccount {
  account_id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  branch_name?: string;
  create_date?: Date;
  update_date?: Date;
  create_by?: string;
  update_by?: string;
}

export interface BankAccountResponse {
  data: BankAccount[];
  meta: PaginationMeta;
}

export interface CreateBankAccountDto {
  account_number: string;
  account_name: string;
  bank_name: string;
  branch_name?: string;
  create_by?: string;
}

export interface UpdateBankAccountDto extends CreateBankAccountDto {
  account_id: string;
  update_by?: string;
}
