import axios from 'axios';
import { getApiErrorMessage } from '@/lib/api-error';

// The paid-lock refusals of the invoice API all start with this (invoice-supplier.service.ts).
const PAID_LOCK_PREFIX = 'ใบชำระหนี้นี้ชำระครบแล้ว';

/**
 * The API's own reason when a paid invoice is locked. The shared helper replaces every 403 with a
 * generic "no permission" text, which hides why (TASK-0329 review F2); other 403s, such as the
 * permission guard's English messages, keep that generic Thai text (review F5).
 */
export function apiReason(error: unknown): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error) && error.response?.status === 403) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.startsWith(PAID_LOCK_PREFIX)) return message;
  }
  return getApiErrorMessage(error);
}
