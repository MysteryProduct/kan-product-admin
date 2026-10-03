import type { BadgeTone } from '@/components/StatusBadge';
import type { ContactRequestStatus } from '@/types/contact-request';
import type { InvoiceSupplierStatus } from '@/types/invoice-supplier';
import type {
  StoreCancellationStatus,
  StoreOrderListStatus,
  StoreParcel,
  StorePickupStatus,
} from '@/types/store-fulfillment';

// One tone per status, shared by every screen that shows it (Kan Product Admin design system, Badge).
// warning = waiting or partly done, info = in progress, success = done, danger = cancelled or failed.

export const SALE_ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  approved: 'info',
  partial: 'warning',
  paid: 'success',
  completed: 'success',
  cancelled: 'danger',
  rejected: 'danger',
  partially_returned: 'warning',
  returned: 'neutral',
};

export const PURCHASE_ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  active: 'info',
  partial: 'warning',
  completed: 'success',
  inactive: 'neutral',
};

export const PAYMENT_RECEIPT_STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'danger',
};

export const INVOICE_SUPPLIER_STATUS_TONE: Record<InvoiceSupplierStatus, BadgeTone> = {
  pending: 'warning',
  partial: 'warning',
  paid: 'success',
  cancelled: 'danger',
};

export const CONTACT_REQUEST_STATUS_TONE: Record<ContactRequestStatus, BadgeTone> = {
  new: 'brand',
  contacting: 'warning',
  closed: 'neutral',
};

export const STORE_ORDER_STATUS_TONE: Record<StoreOrderListStatus, BadgeTone> = {
  awaiting_payment: 'warning',
  paid: 'success',
  expired: 'neutral',
  awaiting_review: 'warning',
  cancelled: 'danger',
};

export const STORE_CANCELLATION_STATUS_TONE: Record<StoreCancellationStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
};

export const STORE_PARCEL_STATUS_TONE: Record<StoreParcel['status'], BadgeTone> = {
  preparing: 'info',
  held: 'warning',
  shipped: 'success',
  voided: 'neutral',
  returned: 'danger',
};

export const STORE_PICKUP_STATUS_TONE: Record<StorePickupStatus, BadgeTone> = {
  awaiting_ready: 'neutral',
  ready: 'info',
  rescheduled: 'info',
  overdue: 'warning',
  pending_review: 'danger',
  picked_up: 'success',
};
