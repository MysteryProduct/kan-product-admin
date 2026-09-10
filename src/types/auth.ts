import type { PermissionItem } from './permission';
import type { UserType } from './user';

export interface AuthResponse {
  data: UserType;
  access_token: string;
  permissions: PermissionItem[];
}

export interface AuthStatus {
  status: string;
  user: {
    sub: string;
    username?: string;
    login_type: string;
    license_id?: string;
    permissions?: Record<string, PermissionItem>;
  };
}
