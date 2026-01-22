import axiosInstance from '@/lib/axios';
import { UserType } from '@/types/user';

// Interface สำหรับ User
interface AuthResponse {
    data : UserType;
    access_token: string;
}  

interface LoginDto {
    username: string;
    password: string;
}
export default class AuthModel {
    getLogin = async (loginDto: LoginDto): Promise<AuthResponse> => {
        try {
            const response = await axiosInstance.post<AuthResponse>('/auth/login', loginDto);
            return response.data;
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    };

    
}