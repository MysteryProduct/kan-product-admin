import { PaginationMeta } from './pagination';

export type ContactRequestStatus = 'new' | 'contacting' | 'closed';

export interface ContactRequest {
  contactRequestId: string;
  customerId: string | null;
  productId: string;
  productName: string;
  contactName: string;
  contactPhone: string;
  quantity: number;
  message: string | null;
  status: ContactRequestStatus;
  contactResult: string | null;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRequestResponse {
  data: ContactRequest[];
  meta: PaginationMeta;
}

export interface UpdateContactRequestDto {
  status?: ContactRequestStatus;
  contact_result?: string;
}
