import type {
  StoreOrderListFilters,
  StoreOrderListStatus,
} from '@/types/store-fulfillment';

// TASK-0088. One Thai word for each status the API can send, in the order the
// status filter lists them. The order's own page shows the same words.
export const STORE_ORDER_STATUS_LABELS: Record<StoreOrderListStatus, string> = {
  awaiting_payment: 'รอชำระเงิน',
  paid: 'ชำระเงินแล้ว',
  expired: 'หมดเวลา',
  awaiting_review: 'กำลังตรวจสอบ',
  cancelled: 'ยกเลิกแล้ว',
};

export const STORE_ORDER_METHOD_LABELS = {
  delivery: 'จัดส่ง',
  pickup: 'รับที่ร้าน',
} as const;

export const STORE_CUSTOMER_TYPE_LABELS = {
  member: 'สมาชิก',
  guest: 'Guest',
} as const;

// The API refuses a longer search; the box stops at the same length.
export const STORE_ORDER_SEARCH_MAX_LENGTH = 100;

/**
 * The query of one page of the list. A filter staff left empty is not sent: an
 * empty `status` is a malformed value to the API, not "any status".
 */
export function storeOrderListParams(
  filters: StoreOrderListFilters,
  page: number,
  limit: number,
): Record<string, string | number> {
  const params: Record<string, string | number> = { page, limit };
  const search = filters.search.trim();
  if (search) params.search = search;
  if (filters.status) params.status = filters.status;
  if (filters.fulfillmentMethod) {
    params.fulfillment_method = filters.fulfillmentMethod;
  }
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  return params;
}
