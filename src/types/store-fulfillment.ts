export type StoreParcelStatus =
  | 'preparing'
  | 'held'
  | 'shipped'
  // Recorded by mistake and undone before it shipped. Staff see it so the
  // correction stays visible; customers never do.
  | 'voided'
  // Shipped, then came back to the shop (TASK-0037). Its quantities were
  // given back, so the resend is a new parcel.
  | 'returned';

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
  returnedAt: string | null;
  // Staff-only notes recorded with a return.
  returnReason?: string | null;
  returnContactOutcome?: 'reached' | 'unreachable' | 'other' | null;
  returnContactNote?: string | null;
  items: StoreParcelItem[];
}

// Shipping owed after a pickup order became a delivery or a parcel came back
// (TASK-0037). pending_review is derived by the API once the one-month hold
// has run out; nothing happens to the order by itself.
export type StoreShippingChargeStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'pending_review'
  // No longer owed: the order's cancellation was approved.
  | 'void';

// One shipping payment the gateway confirmed. `excess` means it is not the
// payment that settled its charge (paid twice, or after the charge was
// voided); staff may refund those on their own.
export interface StoreShippingPayment {
  gatewayChargeId: string;
  paymentMethod: 'promptpay' | 'card';
  amount: string;
  paidAt: string | null;
  excess: boolean;
  refund: StoreRefund | null;
}

export interface StoreShippingCharge {
  shippingChargeId: string;
  reason: 'conversion' | 'return';
  amount: string;
  status: StoreShippingChargeStatus;
  issuedAt: string;
  paidAt: string | null;
  parcelId: string | null;
  issuedBy: string;
  holdUntil: string;
  paidBy: string | null;
}

export interface StoreDeliveryConversion {
  convertedAt: string;
  convertedBy: string;
  note: string | null;
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
  // 'shipping': a shipping payment returned through its own charge.
  kind?: 'order' | 'shipping';
  // True when the provider has returned the money but the order has not been
  // reversed locally yet, so staff can finish that step. Derived by the API
  // from the refund and the order, never stored.
  reversalPending?: boolean;
  // Whether another attempt would actually do something now. The API owns
  // this rule because it is the same one its claim applies: an attempt in
  // flight holds a short lease, and an attempt that died leaves a lease that
  // has aged out and must be pickable up again.
  retryAvailable?: boolean;
  // How this refund is meant to be paid back. 'manual_transfer' means the
  // gateway cannot return this money (PromptPay) and the shop transfers it.
  refundChannel?: 'gateway' | 'manual_transfer';
  manualRefundRequired?: boolean;
  // Where a transfer goes: stated for this refund on the tracking page, or
  // with the cancellation request. Staff-only.
  refundAccount?: StoreRefundAccount | null;
  // A transfer is due but the customer has not stated an account yet; it
  // cannot be recorded until they do (TASK-0037).
  accountRequired?: boolean;
  manualReference?: string | null;
  manualTransferredAt?: string | null;
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
  // TASK-0037: each shipping payment the cancellation returns.
  shippingRefunds?: StoreRefund[];
  refundAccount?: StoreRefundAccount | null;
}

export interface DecideCancellationDto {
  decision: 'approve' | 'reject';
  note?: string;
}

export interface RecordManualRefundDto {
  reference: string;
  amount: number;
  transferred_at: string;
}

// Where the shop must transfer a refund it cannot make through the gateway,
// as the customer stated it. Staff-only; never part of a customer projection.
export interface StoreRefundAccount {
  name: string | null;
  bank: string | null;
  number: string | null;
}

export interface StoreOrderWithParcels {
  storeOrderId: string;
  status: string;
  fulfillmentMethod: 'delivery' | 'pickup';
  // Present for pickup orders, and kept for one converted to delivery.
  pickup: StorePickup | null;
  conversion: StoreDeliveryConversion | null;
  shippingCharges: StoreShippingCharge[];
  shippingPayments?: StoreShippingPayment[];
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

export interface ConvertToDeliveryDto {
  recipient_name: string;
  recipient_phone: string;
  address_line1: string;
  address_line2?: string;
  district: string;
  province: string;
  postal_code: string;
  note?: string;
}

export interface RecordParcelReturnDto {
  reason: string;
  contact_outcome: 'reached' | 'unreachable' | 'other';
  contact_note?: string;
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
