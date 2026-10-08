import axiosInstance from '@/lib/axios';
import { pickDefined } from '@/lib/pick-defined';
import { storeOrderListParams } from '@/lib/store-order-list';
import {
  ConvertToDeliveryDto,
  CreateParcelDto,
  CreateStoreReturnDto,
  DecideCancellationDto,
  RecordManualRefundDto,
  StoreRefund,
  EditParcelAddressDto,
  HandoverDto,
  ParcelAddressHistoryEntry,
  PickupContactLogDto,
  RecordParcelReturnDto,
  SecondAppointmentDto,
  StoreOrderList,
  StoreOrderListFilters,
  StoreOrderWithParcels,
  StoreTaxInvoiceRequestList,
} from '@/types/store-fulfillment';

// The API rejects unknown body fields, so each request carries only these.
// Top-level lists are checked against its DTOs by tests/api-write-contract.test.mjs;
// the nested item lists are checked there by their own test.
const ADDRESS_FIELDS = [
  'recipient_name',
  'recipient_phone',
  'address_line1',
  'address_line2',
  'district',
  'province',
  'postal_code',
] as const;
const PARCEL_FIELDS = ['carrier_name', 'tracking_number', ...ADDRESS_FIELDS] as const;
const EDIT_ADDRESS_FIELDS = [...ADDRESS_FIELDS, 'reason'] as const;
const CONVERT_FIELDS = [...ADDRESS_FIELDS, 'note'] as const;
const PARCEL_RETURN_FIELDS = ['reason', 'contact_outcome', 'contact_note'] as const;
const DECISION_FIELDS = ['decision', 'note'] as const;
const MANUAL_REFUND_FIELDS = ['reference', 'amount', 'transferred_at'] as const;
const RETURN_FIELDS = ['return_reference', 'reason', 'note'] as const;
const APPOINTMENT_FIELDS = ['scheduled_at', 'note'] as const;
const CONTACT_LOG_FIELDS = ['channel', 'outcome', 'note'] as const;
const HANDOVER_FIELDS = ['phone', 'recipient_name'] as const;

class StoreFulfillmentModel {
  // TASK-0038: newest first, for staff to find orders waiting on a document.
  async listTaxInvoiceRequests(
    page = 1,
    limit = 10,
  ): Promise<StoreTaxInvoiceRequestList> {
    const response = await axiosInstance.get<StoreTaxInvoiceRequestList>(
      '/fulfillment/tax-invoices',
      { params: { page, limit } },
    );
    return response.data;
  }

  // TASK-0088: find an order by phone, name, member email, sale order code or
  // id, and filter by status, method and day. Newest first.
  async listOrders(
    filters: StoreOrderListFilters,
    page = 1,
    limit = 20,
  ): Promise<StoreOrderList> {
    const response = await axiosInstance.get<StoreOrderList>(
      '/fulfillment/orders',
      { params: storeOrderListParams(filters, page, limit) },
    );
    return response.data;
  }

  async getOrder(storeOrderId: string): Promise<StoreOrderWithParcels> {
    const response = await axiosInstance.get<StoreOrderWithParcels>(
      `/fulfillment/orders/${storeOrderId}`,
    );
    return response.data;
  }

  async createParcel(
    storeOrderId: string,
    dto: CreateParcelDto,
  ): Promise<{ parcelId: string }> {
    const response = await axiosInstance.post<{ parcelId: string }>(
      `/fulfillment/orders/${storeOrderId}/parcels`,
      {
        ...pickDefined(dto, PARCEL_FIELDS),
        items: dto.items.map((item) => pickDefined(item, ['sale_order_list_id', 'quantity'] as const)),
      },
    );
    return response.data;
  }

  async holdParcel(parcelId: string, reason?: string): Promise<void> {
    await axiosInstance.post(`/fulfillment/parcels/${parcelId}/hold`, { reason });
  }

  async editParcelAddress(
    parcelId: string,
    dto: EditParcelAddressDto,
  ): Promise<void> {
    await axiosInstance.patch(
      `/fulfillment/parcels/${parcelId}/address`,
      pickDefined(dto, EDIT_ADDRESS_FIELDS),
    );
  }

  async shipParcel(parcelId: string): Promise<void> {
    await axiosInstance.post(`/fulfillment/parcels/${parcelId}/ship`);
  }

  // Gives the parcel's quantities back to the order so they can be recorded
  // again correctly. The API refuses this once the parcel has shipped.
  async voidParcel(parcelId: string, reason: string): Promise<void> {
    await axiosInstance.post(`/fulfillment/parcels/${parcelId}/void`, {
      reason,
    });
  }

  // TASK-0037: only after the second pickup appointment was missed. The API
  // decides whether shipping is owed; the answer says how much.
  async convertToDelivery(
    storeOrderId: string,
    dto: ConvertToDeliveryDto,
  ): Promise<{ shippingFee: number }> {
    const response = await axiosInstance.post<{ shippingFee: number }>(
      `/fulfillment/orders/${storeOrderId}/convert-to-delivery`,
      pickDefined(dto, CONVERT_FIELDS),
    );
    return response.data;
  }

  // A shipped parcel that came back. The API gives its quantities back and
  // issues the shipping charge the resend must wait for.
  async recordParcelReturn(
    parcelId: string,
    dto: RecordParcelReturnDto,
  ): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/parcels/${parcelId}/return`,
      pickDefined(dto, PARCEL_RETURN_FIELDS),
    );
  }

  async getAddressHistory(parcelId: string): Promise<ParcelAddressHistoryEntry[]> {
    const response = await axiosInstance.get<ParcelAddressHistoryEntry[]>(
      `/fulfillment/parcels/${parcelId}/address-history`,
    );
    return response.data;
  }

  // Approving also starts the refund, so the API answers with whatever the
  // gateway said about it - that result is what staff act on next.
  async decideCancellation(
    requestId: string,
    dto: DecideCancellationDto,
  ): Promise<{ status: string; refund?: StoreRefund }> {
    const response = await axiosInstance.post<{
      status: string;
      refund?: StoreRefund;
    }>(`/fulfillment/cancellations/${requestId}/decision`, pickDefined(dto, DECISION_FIELDS));
    return response.data;
  }

  // Retry for a refund that failed or is still pending at the gateway. Safe
  // to press again: the API never asks for the same money twice.
  async retryRefund(refundId: string): Promise<StoreRefund> {
    const response = await axiosInstance.post<StoreRefund>(
      `/fulfillment/cancellations/refunds/${refundId}/attempt`,
    );
    return response.data;
  }

  // Records a refund the shop transferred itself, for money the gateway
  // cannot return. The evidence is required by the API, not just by the form.
  async recordManualRefund(
    refundId: string,
    dto: RecordManualRefundDto,
  ): Promise<StoreRefund> {
    const response = await axiosInstance.post<StoreRefund>(
      `/fulfillment/cancellations/refunds/${refundId}/manual`,
      pickDefined(dto, MANUAL_REFUND_FIELDS),
    );
    return response.data;
  }

  // A shipping payment the shop was not owed (TASK-0037). A card payment is
  // refunded through the gateway at once; PromptPay waits for the transfer
  // to be recorded through recordManualRefund().
  async refundExcessShipping(gatewayChargeId: string): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/cancellations/shipping-payments/${encodeURIComponent(gatewayChargeId)}/refund`,
    );
  }

  // TASK-0109: goods the customer returned after receipt. A card refund is
  // started at once; PromptPay waits for the transfer to be recorded through
  // recordManualRefund(), like any other transfer refund.
  async createReturn(
    storeOrderId: string,
    dto: CreateStoreReturnDto,
  ): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/returns/orders/${storeOrderId}`,
      {
        ...pickDefined(dto, RETURN_FIELDS),
        items: dto.items.map((item) =>
          pickDefined(item, ['sale_order_list_id', 'quantity', 'restock'] as const),
        ),
      },
    );
  }

  async markPickupReady(storeOrderId: string): Promise<void> {
    await axiosInstance.post(`/fulfillment/pickup/orders/${storeOrderId}/ready`);
  }

  async scheduleSecondAppointment(
    storeOrderId: string,
    dto: SecondAppointmentDto,
  ): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/pickup/orders/${storeOrderId}/second-appointment`,
      pickDefined(dto, APPOINTMENT_FIELDS),
    );
  }

  async logPickupContact(
    storeOrderId: string,
    dto: PickupContactLogDto,
  ): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/pickup/orders/${storeOrderId}/contact-log`,
      pickDefined(dto, CONTACT_LOG_FIELDS),
    );
  }

  async handoverPickup(
    storeOrderId: string,
    dto: HandoverDto,
  ): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/pickup/orders/${storeOrderId}/handover`,
      pickDefined(dto, HANDOVER_FIELDS),
    );
  }
}

export default StoreFulfillmentModel;
