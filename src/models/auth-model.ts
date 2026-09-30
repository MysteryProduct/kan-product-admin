import axiosInstance from '@/lib/axios';
import type { AuthResponse, AuthStatus } from '@/types/auth';

interface LoginDto {
  username: string;
  password: string;
}

export default class AuthModel {
  async getLogin(loginDto: LoginDto): Promise<AuthResponse> {
    const response = await axiosInstance.post<AuthResponse>(
      '/auth/employee-login',
      loginDto,
    );
    return response.data;
  }

  // Changes the signed-in employee's own password. The answer carries a new token: the old one,
  // like every other session the employee has, stops working at once.
  async changePassword(
    current_password: string,
    new_password: string,
  ): Promise<{ access_token: string }> {
    const response = await axiosInstance.post<{ access_token: string }>(
      '/auth/change-password',
      { current_password, new_password },
    );
    return response.data;
  }

  async getStatus(): Promise<AuthStatus> {
    const response = await axiosInstance.get<AuthStatus>('/auth/status');
    return response.data;
  }
}
