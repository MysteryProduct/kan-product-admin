import axiosInstance from '@/lib/axios';
import {
  EmployeeLicense,
  EmployeeLicenseResponse,
  LicensePermissionMatrix,
  SaveLicensePermissionsDto,
} from '@/types/employee-license';

class EmployeeLicenseModel {
  async getLicenses(page = 1, limit = 10, search?: string): Promise<EmployeeLicenseResponse> {
    const response = await axiosInstance.get<EmployeeLicenseResponse>('/employee-license', {
      params: { page, limit, ...(search && { search }) },
    });
    return response.data;
  }

  async createLicense(license_name: string): Promise<EmployeeLicense> {
    const response = await axiosInstance.post<EmployeeLicense>('/employee-license', { license_name });
    return response.data;
  }

  async renameLicense(id: string, license_name: string): Promise<EmployeeLicense> {
    const response = await axiosInstance.patch<{ data: EmployeeLicense }>(`/employee-license/${id}`, {
      license_name,
    });
    return response.data.data;
  }

  async deleteLicense(id: string): Promise<void> {
    await axiosInstance.delete(`/employee-license/${id}`);
  }

  async getPermissions(licenseId: string): Promise<LicensePermissionMatrix> {
    const response = await axiosInstance.get<{ data: LicensePermissionMatrix }>(
      `/employee-permission/license/${licenseId}`,
    );
    return response.data.data;
  }

  async savePermissions(licenseId: string, body: SaveLicensePermissionsDto): Promise<LicensePermissionMatrix> {
    const response = await axiosInstance.put<{ data: LicensePermissionMatrix }>(
      `/employee-permission/license/${licenseId}`,
      body,
    );
    return response.data.data;
  }
}

export default EmployeeLicenseModel;
