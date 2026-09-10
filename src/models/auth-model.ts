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

  async getStatus(): Promise<AuthStatus> {
    const response = await axiosInstance.get<AuthStatus>('/auth/status');
    return response.data;
  }
}
