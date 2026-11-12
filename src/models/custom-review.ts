import axiosInstance from '@/lib/axios';
import type { ReviewDetail, ReviewQueueResponse, ReviewStatus } from '@/types/custom-review';

// TASK-0210. The review requests carry only the revision looked at (and the
// reason for needs-changes): the reviewer comes from the session, and no file
// the employee opened in the browser is ever sent.
class CustomReviewModel {
  async list(params: { status?: ReviewStatus; q?: string; page?: number; limit?: number }, signal?: AbortSignal) {
    const response = await axiosInstance.get<ReviewQueueResponse>('/custom-request', {
      params: {
        ...(params.status && { status: params.status }),
        ...(params.q && { q: params.q }),
        page: params.page ?? 1,
        limit: params.limit ?? 100,
      },
      signal,
    });
    return response.data;
  }

  async detail(id: string, signal?: AbortSignal) {
    const response = await axiosInstance.get<ReviewDetail>(`/custom-request/${id}`, { signal });
    return response.data;
  }

  async received(id: string, revision: number) {
    const response = await axiosInstance.post<ReviewDetail>(`/custom-request/${id}/review/received`, { revision });
    return response.data;
  }

  async needsChanges(id: string, revision: number, reason: string) {
    const response = await axiosInstance.post<ReviewDetail>(`/custom-request/${id}/review/needs-changes`, {
      revision,
      reason,
    });
    return response.data;
  }

  async approve(id: string, revision: number) {
    const response = await axiosInstance.post<ReviewDetail>(`/custom-request/${id}/review/approve`, { revision });
    return response.data;
  }
}

export default CustomReviewModel;
export const customReviewModel = new CustomReviewModel();
