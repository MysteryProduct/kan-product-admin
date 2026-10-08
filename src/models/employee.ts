import axiosInstance from '@/lib/axios';
import { pickDefined } from '@/lib/pick-defined';
import type { CreateEmployeeDto, EmployeeResponse, UpdateEmployeeDto } from '@/types/employee';

// The API rejects unknown body fields; these lists are checked against its DTOs
// by tests/api-write-contract.test.mjs.
const CREATE_FIELDS = [
  'employee_username',
  'employee_password',
  'employee_firstname',
  'employee_lastname',
  'employee_address',
  'employee_phone',
  'employee_email',
  'license_id',
] as const;
const UPDATE_FIELDS = [
  'employee_firstname',
  'employee_lastname',
  'employee_address',
  'employee_phone',
  'employee_email',
  'license_id',
] as const;

class EmployeeModel {
  async getEmployees(page = 1, limit = 10, search?: string): Promise<EmployeeResponse> {
    const response = await axiosInstance.get<EmployeeResponse>('/employee', {
      params: { page, limit, ...(search && { search }) },
    });
    return response.data;
  }

  async setDisabled(id: string, disabled: boolean): Promise<void> {
    await axiosInstance.post(`/employee/${id}/${disabled ? 'disable' : 'enable'}`);
  }

  async updateEmployee(id: string, body: UpdateEmployeeDto): Promise<void> {
    await axiosInstance.patch(`/employee/${id}`, pickDefined(body, UPDATE_FIELDS));
  }

  // Ends every session the employee has, on every device.
  async setPassword(id: string, employee_password: string): Promise<void> {
    await axiosInstance.post(`/employee/${id}/password`, { employee_password });
  }

  async createEmployee(body: CreateEmployeeDto): Promise<void> {
    await axiosInstance.post('/employee', pickDefined(body, CREATE_FIELDS));
  }
}

export default EmployeeModel;
