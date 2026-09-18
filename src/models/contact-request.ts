import axiosInstance from '@/lib/axios';
import {
  ContactRequest,
  ContactRequestResponse,
  ContactRequestStatus,
  UpdateContactRequestDto,
} from '@/types/contact-request';

class ContactRequestModel {
  async getContactRequests(
    page: number = 1,
    limit: number = 20,
    status?: ContactRequestStatus,
  ): Promise<ContactRequestResponse> {
    const response = await axiosInstance.get<ContactRequestResponse>(
      '/contact-requests',
      { params: { page, limit, ...(status && { status }) } },
    );
    return response.data;
  }

  async getContactRequestById(id: string): Promise<ContactRequest> {
    const response = await axiosInstance.get<ContactRequest>(
      `/contact-requests/${id}`,
    );
    return response.data;
  }

  async updateContactRequest(
    id: string,
    dto: UpdateContactRequestDto,
  ): Promise<ContactRequest> {
    const response = await axiosInstance.patch<ContactRequest>(
      `/contact-requests/${id}`,
      dto,
    );
    return response.data;
  }
}

export default ContactRequestModel;
