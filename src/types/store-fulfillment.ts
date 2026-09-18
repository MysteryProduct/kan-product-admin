export type StoreParcelStatus = 'preparing' | 'held' | 'shipped';

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

export interface StoreOrderWithParcels {
  storeOrderId: string;
  status: string;
  fulfillmentMethod: 'delivery' | 'pickup';
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

export interface ParcelAddressHistoryEntry {
  historyId: string;
  actorId: string;
  reason: string;
  previousAddress: Record<string, string | null>;
  nextAddress: Record<string, string | null>;
  createdAt: string;
}
