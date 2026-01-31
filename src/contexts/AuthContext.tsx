'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import AuthModel from '@/models/auth-model';
import { UserType } from '@/types/user';


interface AuthContextType {
  user: UserType | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ตรวจสอบ Cookies เมื่อ mount component
  useEffect(() => {
    const storedUser = Cookies.get('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        Cookies.remove('user');
        Cookies.remove('token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    // Simulate API call
    if (username && password.length >= 6) {
      const authModel = new AuthModel();
      const response = await authModel.getLogin({ username, password });
      setUser(response.data);
      console.log('User logged in:', response.data);
      
      // เก็บข้อมูลใน Cookies (expires ใน 7 วัน)
      // หมายเหตุ: httpOnly ไม่สามารถตั้งค่าได้จาก client-side (ต้องตั้งจาก server)
      const cookieOptions = {
        expires: 7,
        secure: process.env.NODE_ENV === 'production', // ใช้ secure ใน production (HTTPS)
        sameSite: 'strict' as const, // ป้องกัน CSRF attacks
      };
      
      Cookies.set('user', JSON.stringify(response.data), cookieOptions);
      Cookies.set('token', response.access_token, cookieOptions);
    } else {
      throw new Error('Invalid username or password');
    }
  };

  const logout = () => {
    setUser(null);
    Cookies.remove('user');
    Cookies.remove('token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
