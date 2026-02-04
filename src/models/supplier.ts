import axiosInstance from '@/lib/axios';
import { 
    Supplier,
    SupplierUpdate,
    SupplierWithPayment, 
    ApiSupplierResponse, 
    ApiSupplierWithPaymentResponse, 
    Payment 
} from '@/types/supplier';

export interface CreateSupplierDto {
    supplier_name: string;
    supplier_contact: string;
    supplier_address: string;
    supplier_phone: string;
    tax_id: string;
    payments: {
        account_name: string;
        account_number: string;
        account_branch: string;
        bank_name: string;
    }[];
}

export interface UpdateSupplierDto {
    supplier_id: string;
    supplier_name: string;
    supplier_contact: string;
    supplier_address: string;
    supplier_phone: string;
    tax_id: string;
    payments: {
        payment_id: string;
        account_name: string;
        account_number: string;
        account_branch: string;
        bank_name: string;
    }[];
}

export default class SupplierModel {
    /**
     * Get all suppliers with pagination and search
     */
    getSuppliers = async (
        page: number = 1,
        limit: number = 10,
        search?: string
    ): Promise<ApiSupplierResponse> => {
        try {
            const response = await axiosInstance.get<ApiSupplierResponse>('/supplier/', {
                params: {
                    page,
                    limit,
                    ...(search && { search }),
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            throw error;
        }
    };

    /**
     * Get all suppliers with their payment information
     */
    getSuppliersWithPayments = async (
        page: number = 1,
        limit: number = 10,
        search?: string
    ): Promise<ApiSupplierWithPaymentResponse> => {
        try {
            const response = await axiosInstance.get<ApiSupplierWithPaymentResponse>('/supplier/with-payments/', {
                params: {
                    page,
                    limit,
                    ...(search && { search }),
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching suppliers with payments:', error);
            throw error;
        }
    };

    /**
     * Get a specific supplier by ID
     */
    getSupplierById = async (supplier_id: string): Promise<SupplierUpdate> => {
        try {
            const response = await axiosInstance.get<SupplierUpdate>(`/supplier/${supplier_id}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching supplier:', error);
            throw error;
        }
    };

    /**
     * Get a specific supplier with payment information by ID
     */
    getSupplierWithPaymentsById = async (supplier_id: string): Promise<SupplierWithPayment> => {
        try {
            const response = await axiosInstance.get<SupplierWithPayment>(`/supplier/${supplier_id}/with-payments`);
            return response.data;
        } catch (error) {
            console.error('Error fetching supplier with payments:', error);
            throw error;
        }
    };

    /**
     * Create a new supplier
     */
    createSupplier = async (supplierData: CreateSupplierDto): Promise<Supplier> => {
        try {
            const response = await axiosInstance.post<Supplier>('/supplier/', supplierData);
            return response.data;
        } catch (error) {
            console.error('Error creating supplier:', error);
            throw error;
        }
    };

    /**
     * Update an existing supplier
     */
    updateSupplier = async (supplierData: UpdateSupplierDto): Promise<Supplier> => {
        try {
            const response = await axiosInstance.patch<Supplier>(
                `/supplier/${supplierData.supplier_id}`, 
                supplierData
            );
            return response.data;
        } catch (error) {
            console.error('Error updating supplier:', error);
            throw error;
        }
    };

    /**
     * Delete a supplier
     */
    deleteSupplier = async (supplier_id: string): Promise<void> => {
        try {
            await axiosInstance.delete(`/supplier/${supplier_id}`);
        } catch (error) {
            console.error('Error deleting supplier:', error);
            throw error;
        }
    };

    /**
     * Get payment information for a specific supplier
     */
    getSupplierPayments = async (supplier_id: string): Promise<Payment[]> => {
        try {
            const response = await axiosInstance.get<Payment[]>(`/supplier/${supplier_id}/payments`);
            return response.data;
        } catch (error) {
            console.error('Error fetching supplier payments:', error);
            throw error;
        }
    };

    /**
     * Add payment information to a supplier
     */
    addSupplierPayment = async (supplier_id: string, paymentData: Omit<Payment, 'supplier_id'>): Promise<Payment> => {
        try {
            const response = await axiosInstance.post<Payment>(
                `/supplier/${supplier_id}/payments`, 
                paymentData
            );
            return response.data;
        } catch (error) {
            console.error('Error adding supplier payment:', error);
            throw error;
        }
    };

    /**
     * Update payment information for a supplier
     */
    updateSupplierPayment = async (supplier_id: string, payment_id: string, paymentData: Partial<Payment>): Promise<Payment> => {
        try {
            const response = await axiosInstance.patch<Payment>(
                `/supplier/${supplier_id}/payments/${payment_id}`, 
                paymentData
            );
            return response.data;
        } catch (error) {
            console.error('Error updating supplier payment:', error);
            throw error;
        }
    };

    /**
     * Delete payment information for a supplier
     */
    deleteSupplierPayment = async (supplier_id: string, payment_id: string): Promise<void> => {
        try {
            await axiosInstance.delete(`/supplier/${supplier_id}/payments/${payment_id}`);
        } catch (error) {
            console.error('Error deleting supplier payment:', error);
            throw error;
        }
    };
}