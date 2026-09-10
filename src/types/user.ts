// Public employee fields returned by /auth/employee-login. Never store hashes.
export interface UserType {
  employee_id: string;
  employee_username: string;
  employee_firstname?: string;
  employee_lastname?: string;
  license_id?: string;
}
