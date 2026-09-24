import axiosInstance from '@/lib/axios';
import {
  ConvertToDeliveryDto,
  CreateParcelDto,
  DecideCancellationDto,
  RecordManualRefundDto,
  StoreRefund,
  EditParcelAddressDto,
  HandoverDto,
  ParcelAddressHistoryEntry,
  PickupContactLogDto,
  RecordParcelReturnDto,
  SecondAppointmentDto,
  StoreOrderWithParcels,
} from '@/types/store-fulfillment';

class StoreFulfillmentModel {
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
      dto,
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
    await axiosInstance.patch(`/fulfillment/parcels/${parcelId}/address`, dto);
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
      dto,
    );
    return response.data;
  }

  // A shipped parcel that came back. The API gives its quantities back and
  // issues the shipping charge the resend must wait for.
  async recordParcelReturn(
    parcelId: string,
    dto: RecordParcelReturnDto,
  ): Promise<void> {
    await axiosInstance.post(`/fulfillment/parcels/${parcelId}/return`, dto);
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
    }>(`/fulfillment/cancellations/${requestId}/decision`, dto);
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
      dto,
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

  async markPickupReady(storeOrderId: string): Promise<void> {
    await axiosInstance.post(`/fulfillment/pickup/orders/${storeOrderId}/ready`);
  }

  async scheduleSecondAppointment(
    storeOrderId: string,
    dto: SecondAppointmentDto,
  ): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/pickup/orders/${storeOrderId}/second-appointment`,
      dto,
    );
  }

  async logPickupContact(
    storeOrderId: string,
    dto: PickupContactLogDto,
  ): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/pickup/orders/${storeOrderId}/contact-log`,
      dto,
    );
  }

  async handoverPickup(
    storeOrderId: string,
    dto: HandoverDto,
  ): Promise<void> {
    await axiosInstance.post(
      `/fulfillment/pickup/orders/${storeOrderId}/handover`,
      dto,
    );
  }
}

export default StoreFulfillmentModel;
