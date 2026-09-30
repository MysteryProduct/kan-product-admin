import { PaginationMeta } from './pagination';

// One row of GET /employee. The API never returns the password or its hash.
export interface Employee {
  employee_id: string;
  employee_username: string;
  employee_firstname: string;
  employee_lastname: string;
  employee_address: string;
  employee_phone: string;
  employee_email: string;
  license_id: string;
  license_name: string | null;
  // null while the account is active.
  employee_disabled_at: string | null;
}

export interface EmployeeResponse {
  data: Employee[];
  meta: PaginationMeta;
}

// The username never changes and the password has its own call, so neither is here.
// license_id is left out when the caller may not assign licenses.
export type UpdateEmployeeDto = Partial<
  Omit<CreateEmployeeDto, 'employee_username' | 'employee_password'>
>;

export interface CreateEmployeeDto {
  employee_username: string;
  employee_password: string;
  employee_firstname: string;
  employee_lastname: string;
  employee_address: string;
  employee_phone: string;
  employee_email: string;
  license_id: string;
}
