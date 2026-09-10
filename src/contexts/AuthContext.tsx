'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import Cookies from 'js-cookie';
import AuthModel from '@/models/auth-model';
import type { UserType } from '@/types/user';
import type { PermissionItem } from '@/types/permission';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  clearStoredSession,
  employeeFromStatus,
  publicEmployee,
  readCachedEmployee,
  storeEmployee,
  storeSession,
  SESSION_EXPIRED_EVENT,
  PERMISSIONS_REFRESH_EVENT,
} from '@/lib/auth-storage';

interface AuthContextType {
  user: UserType | null;
  permissions: PermissionItem[];
  isLoading: boolean;
  sessionError: string | null;
  refreshSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const authModel = new AuthModel();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const loginPending = useRef(false);

  const logout = useCallback(() => {
    requestVersion.current += 1;
    clearStoredSession();
    setUser(null);
    setPermissions([]);
    setSessionError(null);
    setIsLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    if (loginPending.current) return;
    const version = ++requestVersion.current;
    const token = Cookies.get('token');
    if (!token) {
      logout();
      return;
    }
    try {
      const status = await authModel.getStatus();
      if (version !== requestVersion.current || Cookies.get('token') !== token)
        return;
      const employee = employeeFromStatus(status, readCachedEmployee());
      if (!employee) {
        logout();
        return;
      }
      storeEmployee(employee);
      setUser(employee);
      setPermissions(Object.values(status.user.permissions ?? {}));
      setSessionError(null);
    } catch (error) {
      if (version === requestVersion.current)
        setSessionError(getApiErrorMessage(error));
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    // Background refresh does not toggle loading or unmount a form draft.
    void Promise.resolve().then(refreshSession);
    const refresh = () => {
      void refreshSession();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener(PERMISSIONS_REFRESH_EVENT, refresh);
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener('focus', refresh);
      window.removeEventListener(PERMISSIONS_REFRESH_EVENT, refresh);
      window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
    };
  }, [refreshSession, logout]);

  const login = async (username: string, password: string) => {
    if (!username || !password)
      throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    if (loginPending.current)
      throw new Error('กำลังเข้าสู่ระบบ กรุณารอสักครู่');
    loginPending.current = true;
    const version = ++requestVersion.current;
    try {
      const response = await authModel.getLogin({ username, password });
      if (version !== requestVersion.current)
        throw new Error('สถานะการเข้าสู่ระบบเปลี่ยนแล้ว กรุณาลองใหม่');
      const employee = publicEmployee(response.data);
      if (
        !employee ||
        !response.access_token ||
        !Array.isArray(response.permissions)
      )
        throw new Error('ข้อมูลบัญชีพนักงานจาก API ไม่ถูกต้อง');
      storeSession(response.access_token, employee);
      setUser(employee);
      setPermissions(response.permissions);
      setSessionError(null);
      setIsLoading(false);
    } finally {
      loginPending.current = false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        sessionError,
        refreshSession,
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
  if (context === undefined)
    throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
