import { PaginationMeta } from './pagination';
import type { PermissionAction } from './permission';

export interface EmployeeLicense {
  license_id: string;
  license_name: string;
  // Present in the list only: employees assigned to this license.
  employee_count?: number;
}

export interface EmployeeLicenseResponse {
  data: EmployeeLicense[];
  meta: PaginationMeta;
}

export type PermissionFlags = Record<`permission_${PermissionAction}`, boolean>;

// One row per menu in employee_menu, including menus with no page URL.
export interface MenuPermissionRow extends PermissionFlags {
  menu_id: string;
  menu_group: string;
  menu_name: string;
  menu_number: number;
  menu_url: string;
}

export interface LicensePermissionMatrix {
  license_id: string;
  license_name: string;
  menus: MenuPermissionRow[];
}

// The whole set: a menu left out has no permission after the save.
export interface SaveLicensePermissionsDto {
  permissions: ({ menu_id: string } & PermissionFlags)[];
}
