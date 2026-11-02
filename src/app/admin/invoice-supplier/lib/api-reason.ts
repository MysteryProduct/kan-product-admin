import axios from 'axios';
import { getApiErrorMessage } from '@/lib/api-error';

/**
 * The API's own reason for a refused change. The shared helper replaces every 403 with a generic
 * "no permission" text, which hides why a paid invoice is locked (TASK-0329 review F2).
 */
export function apiReason(error: unknown): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error) && error.response?.status === 403) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message) return message;
  }
  return getApiErrorMessage(error);
}
