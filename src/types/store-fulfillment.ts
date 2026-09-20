export type StoreParcelStatus =
  | 'preparing'
  | 'held'
  | 'shipped'
  // Recorded by mistake and undone before it shipped. Staff see it so the
  // correction stays visible; customers never do.
  | 'voided';

export interface StoreOrderLine {
  saleOrderListId: string;
  productVariantId: string | null;
  productName: string;
  purchasedQty: number;
  shippedQty: number;
  remainingUnshipped: number;
}

export interface StoreParcelItem {
  productName: string;
  quantity: number;
}

export interface StoreParcel {
  parcelId: string;
  carrierName: string;
  trackingNumber: string;
  status: StoreParcelStatus;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  createdAt: string;
  shippedAt: string | null;
  items: StoreParcelItem[];
}

export interface StoreOrderDefaultAddress {
  recipientName: string | null;
  recipientPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
}

export type StorePickupStatus =
  | 'awaiting_ready'
  | 'ready'
  | 'rescheduled'
  | 'overdue'
  | 'pending_review'
  | 'picked_up';

export interface PickupContactLogEntry {
  logId: string;
  actorId: string;
  channel: string;
  outcome: string;
  note: string | null;
  createdAt: string;
}

export interface StorePickup {
  status: StorePickupStatus;
  readyAt: string | null;
  dueAt: string | null;
  holdUntil: string | null;
  secondAppointmentAt: string | null;
  secondAppointmentNote: string | null;
  pickedUpAt: string | null;
  recipientName: string | null;
  contactLog: PickupContactLogEntry[];
}

export type StoreRefundStatus =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'failed';

export interface StoreRefund {
  refundId: string;
  status: StoreRefundStatus;
  // True when the provider has returned the money but the order has not been
  // reversed locally yet, so staff can finish that step. Derived by the API
  // from the refund and the order, never stored.
  reversalPending?: boolean;
  // Whether another attempt would actually do something now. The API owns
  // this rule because it is the same one its claim applies: an attempt in
  // flight holds a short lease, and an attempt that died leaves a lease that
  // has aged out and must be pickable up again.
  retryAvailable?: boolean;
  amount: number;
  confirmedAmount: number | null;
  confirmedAt: string | null;
  gatewayChargeId: string | null;
  gatewayRefundId: string | null;
  failureReason: string | null;
  attempts: number;
}

export type StoreCancellationStatus = 'pending' | 'approved' | 'rejected';

export interface StoreCancellation {
  requestId: string;
  status: StoreCancellationStatus;
  reason: string;
  requestedBy: 'customer' | 'guest';
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
  refund: StoreRefund | null;
}

export interface DecideCancellationDto {
  decision: 'approve' | 'reject';
  note?: string;
}

export interface StoreOrderWithParcels {
  storeOrderId: string;
  status: string;
  fulfillmentMethod: 'delivery' | 'pickup';
  // Present only for pickup orders; delivery orders carry parcels instead.
  pickup: StorePickup | null;
  // Present once the customer has asked to cancel; null until then.
  cancellation: StoreCancellation | null;
  items: StoreOrderLine[];
  parcels: StoreParcel[];
  defaultAddress: StoreOrderDefaultAddress | null;
}

export interface CreateParcelDto {
  carrier_name: string;
  tracking_number: string;
  items: { sale_order_list_id: string; quantity: number }[];
  recipient_name?: string;
  recipient_phone?: string;
  address_line1?: string;
  address_line2?: string;
  district?: string;
  province?: string;
  postal_code?: string;
}

export interface EditParcelAddressDto {
  recipient_name: string;
  recipient_phone: string;
  address_line1: string;
  address_line2?: string;
  district: string;
  province: string;
  postal_code: string;
  reason: string;
}

export interface SecondAppointmentDto {
  scheduled_at: string;
  note?: string;
}

export interface PickupContactLogDto {
  channel: 'phone' | 'sms' | 'email' | 'in_person' | 'other';
  outcome: 'reached' | 'unreachable' | 'other';
  note?: string;
}

export interface HandoverDto {
  phone: string;
  recipient_name: string;
}

export interface ParcelAddressHistoryEntry {
  historyId: string;
  actorId: string;
  reason: string;
  previousAddress: Record<string, string | null>;
  nextAddress: Record<string, string | null>;
  createdAt: string;
}
