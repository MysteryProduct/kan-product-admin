import Cookies from 'js-cookie';
import type { UserType } from '@/types/user';
import type { AuthStatus } from '@/types/auth';

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';
export const PERMISSIONS_REFRESH_EVENT = 'auth:refresh-permissions';

export function publicEmployee(value: unknown): UserType | null {
  if (!value || typeof value !== 'object') return null;
  const employee = value as Record<string, unknown>;
  if (
    typeof employee.employee_id !== 'string' ||
    !employee.employee_id ||
    typeof employee.employee_username !== 'string' ||
    !employee.employee_username
  )
    return null;
  return {
    employee_id: employee.employee_id,
    employee_username: employee.employee_username,
    ...(typeof employee.employee_firstname === 'string'
      ? { employee_firstname: employee.employee_firstname }
      : {}),
    ...(typeof employee.employee_lastname === 'string'
      ? { employee_lastname: employee.employee_lastname }
      : {}),
    ...(typeof employee.license_id === 'string'
      ? { license_id: employee.license_id }
      : {}),
  };
}

export function readCachedEmployee(): UserType | null {
  try {
    const value = Cookies.get('user');
    return value ? publicEmployee(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

export function employeeFromStatus(
  status: AuthStatus,
  cached: UserType | null,
): UserType | null {
  const principal = status.user;
  if (
    status.status !== 'ok' ||
    principal?.login_type !== 'employee' ||
    !principal.sub ||
    !principal.username
  )
    return null;
  return publicEmployee({
    ...(cached?.employee_id === principal.sub ? cached : {}),
    employee_id: principal.sub,
    employee_username: principal.username,
    license_id: principal.license_id,
  });
}

export function storeEmployee(user: UserType): void {
  Cookies.set('user', JSON.stringify(publicEmployee(user)), {
    expires: 7,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  // Permissions now live in AuthContext and are refreshed from the API.
  if (typeof window !== 'undefined') localStorage.removeItem('permissions');
}

export function storeSession(token: string, user: UserType): void {
  Cookies.set('token', token, {
    expires: 7,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  storeEmployee(user);
}

export function clearStoredSession(): void {
  Cookies.remove('user');
  Cookies.remove('token');
  if (typeof window !== 'undefined') localStorage.removeItem('permissions');
}
