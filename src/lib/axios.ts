import axios from 'axios';
import Cookies from 'js-cookie';
import { getApiErrorMessage, isLoginRequest } from './api-error';
import {
  clearStoredSession,
  PERMISSIONS_REFRESH_EVENT,
  SESSION_EXPIRED_EVENT,
} from './auth-storage';

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003/',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use((config) => {
  if (typeof window !== 'undefined' && !isLoginRequest(config.url)) {
    const token = Cookies.get('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      error.message = getApiErrorMessage(error);
      if (typeof window !== 'undefined' && !isLoginRequest(error.config?.url)) {
        const token = Cookies.get('token');
        const requestToken = error.config?.headers?.Authorization;
        // A late response from an older session must not log out a new login.
        const isCurrentSession = token && requestToken === `Bearer ${token}`;
        if (error.response?.status === 401 && isCurrentSession) {
          clearStoredSession();
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
          if (window.location.pathname !== '/login')
            window.location.assign('/login');
        } else if (
          error.response?.status === 403 &&
          isCurrentSession &&
          !/(?:^|\/)auth\/status(?:[?#]|$)/.test(error.config?.url || '')
        ) {
          window.dispatchEvent(new Event(PERMISSIONS_REFRESH_EVENT));
        }
      }
    }
    // Preserve AxiosError.response, status, code and validation details.
    return Promise.reject(error);
  },
);

export default axiosInstance;
