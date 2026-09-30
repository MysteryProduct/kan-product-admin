import axiosInstance from '@/lib/axios';
import type { CreateEmployeeDto, EmployeeResponse } from '@/types/employee';

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

  async createEmployee(body: CreateEmployeeDto): Promise<void> {
    await axiosInstance.post('/employee', body);
  }
}

export default EmployeeModel;
