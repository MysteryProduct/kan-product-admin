import axiosInstance from '@/lib/axios';
import {
  CreateParcelDto,
  EditParcelAddressDto,
  ParcelAddressHistoryEntry,
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

  async getAddressHistory(parcelId: string): Promise<ParcelAddressHistoryEntry[]> {
    const response = await axiosInstance.get<ParcelAddressHistoryEntry[]>(
      `/fulfillment/parcels/${parcelId}/address-history`,
    );
    return response.data;
  }
}

export default StoreFulfillmentModel;
