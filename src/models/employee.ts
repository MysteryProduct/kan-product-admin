import axiosInstance from '@/lib/axios';
import type { CreateEmployeeDto, EmployeeResponse, UpdateEmployeeDto } from '@/types/employee';

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
    await axiosInstance.patch(`/employee/${id}`, body);
  }

  // Ends every session the employee has, on every device.
  async setPassword(id: string, employee_password: string): Promise<void> {
    await axiosInstance.post(`/employee/${id}/password`, { employee_password });
  }

  async createEmployee(body: CreateEmployeeDto): Promise<void> {
    await axiosInstance.post('/employee', body);
  }
}

export default EmployeeModel;
