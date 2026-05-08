import axiosInstance from '@/lib/axios';
import {
  BankAccount,
  BankAccountResponse,
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from '@/types/bank-account';

interface SingleBankAccountResponse {
  data: BankAccount;
  message?: string;
}

const unwrapBankAccount = (payload: BankAccount | SingleBankAccountResponse): BankAccount => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload as BankAccount;
};

class BankAccountModel {
  async getBankAccounts(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortField?: 'account_name' | 'bank_name' | null,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<BankAccountResponse> {
    try {
      const response = await axiosInstance.get<BankAccountResponse>('/bank-account', {
        params: {
          page,
          limit,
          ...(search && { search }),
          ...(sortField && { sortField }),
          ...(sortOrder && { sortOrder }),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      throw error;
    }
  }

  async getBankAccountById(id: string): Promise<BankAccount> {
    try {
      const response = await axiosInstance.get<BankAccount | SingleBankAccountResponse>(`/bank-account/${id}`);
      return unwrapBankAccount(response.data);
    } catch (error) {
      throw error;
    }
  }

  async createBankAccount(data: CreateBankAccountDto): Promise<BankAccount> {
    try {
      const response = await axiosInstance.post<BankAccount | SingleBankAccountResponse>('/bank-account', data);
      return unwrapBankAccount(response.data);
    } catch (error) {
      throw error;
    }
  }

  async updateBankAccount(data: UpdateBankAccountDto): Promise<BankAccount> {
    try {
      const response = await axiosInstance.patch<BankAccount | SingleBankAccountResponse>(
        `/bank-account/${data.account_id}`,
        data,
      );
      return unwrapBankAccount(response.data);
    } catch (error) {
      throw error;
    }
  }

  async deleteBankAccount(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/bank-account/${id}`);
    } catch (error) {
      throw error;
    }
  }
}

export default BankAccountModel;
