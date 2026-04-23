import axiosInstance from '@/lib/axios';
import {
    InvoicePaymentItem,
    InvoicePaymentMethod,
    InvoiceSupplierListResponse,
    InvoiceSupplierRow,
    InvoiceSupplierStatus,
} from '@/types/invoice-supplier';

export interface CreateInvoiceSupplierDto {
    purchase_receipt_id: string;
    invoice_supplier_code?: string;
    invoice_supplier_name: string;
    invoice_supplier_date: string;
    invoice_supplier_due_date: string;
    invoice_supplier_status: InvoiceSupplierStatus;
    invoice_supplier_detail?: string;
    supplier_id: string;
    invoice_supplier_total: number;
    invoice_payments: Array<{
        payment_method: InvoicePaymentMethod;
        payment_id?: string;
        invoice_payment_price: number;
    }>;
}

export interface UpdateInvoiceSupplierDto {
    invoice_supplier_code: string;
    invoice_supplier_name: string;
    invoice_supplier_date: string;
    invoice_supplier_due_date: string;
    invoice_supplier_status: InvoiceSupplierStatus;
    invoice_supplier_detail?: string;
    invoice_supplier_total: number;
    invoice_payments: Array<{
        invoice_payment_id?: string;
        payment_method: InvoicePaymentMethod;
        payment_id?: string;
        invoice_payment_price: number;
    }>;
}

export default class InvoiceSupplierModel {
    getInvoiceSuppliers = async (
        page: number = 1,
        limit: number = 10,
        search?: string,
        sortField?: 'invoice_supplier_date' | 'invoice_supplier_due_date' | 'invoice_supplier_total' | null,
        sortOrder?: 'ASC' | 'DESC',
    ): Promise<InvoiceSupplierListResponse> => {
        const response = await axiosInstance.get<InvoiceSupplierListResponse>('/invoice-supplier/', {
            params: {
                page,
                limit,
                ...(search && { search }),
                ...(sortField && { sortField }),
                ...(sortOrder && { sortOrder }),
            },
        });
        return response.data;
    };

    getInvoiceSupplierById = async (invoice_supplier_id: string): Promise<InvoiceSupplierRow> => {
        const response = await axiosInstance.get<InvoiceSupplierRow>(`/invoice-supplier/${invoice_supplier_id}`);
        return response.data;
    };

    createInvoiceSupplier = async (dto: CreateInvoiceSupplierDto): Promise<InvoiceSupplierRow> => {
        const response = await axiosInstance.post<InvoiceSupplierRow>('/invoice-supplier/', dto);
        return response.data;
    };

    updateInvoiceSupplier = async (invoice_supplier_id: string, dto: UpdateInvoiceSupplierDto): Promise<InvoiceSupplierRow> => {
        const response = await axiosInstance.patch<InvoiceSupplierRow>(`/invoice-supplier/${invoice_supplier_id}`, dto);
        return response.data;
    };

    deleteInvoiceSupplier = async (invoice_supplier_id: string): Promise<void> => {
        await axiosInstance.delete(`/invoice-supplier/${invoice_supplier_id}`);
    };
}

export function buildCreateDto(
    purchase_receipt_id: string,
    payload: {
        invoice_supplier_code?: string;
        invoice_supplier_name: string;
        invoice_supplier_date: string;
        invoice_supplier_due_date: string;
        invoice_supplier_status: InvoiceSupplierStatus;
        invoice_supplier_detail?: string;
        invoicePayments: InvoicePaymentItem[];
        supplier_id: string;
        invoice_supplier_total: number;
    },
): CreateInvoiceSupplierDto {
    return {
        purchase_receipt_id,
        ...(payload.invoice_supplier_code ? { invoice_supplier_code: payload.invoice_supplier_code } : {}),
        invoice_supplier_name: payload.invoice_supplier_name,
        invoice_supplier_date: payload.invoice_supplier_date,
        invoice_supplier_due_date: payload.invoice_supplier_due_date,
        invoice_supplier_status: payload.invoice_supplier_status,
        invoice_supplier_detail: payload.invoice_supplier_detail,
        supplier_id: payload.supplier_id,
        invoice_payments: payload.invoicePayments.map((p) => ({
            payment_method: p.payment_method,
            payment_id: p.payment_id,
            invoice_payment_price: p.invoice_payment_price,
        })),
        invoice_supplier_total: payload.invoice_supplier_total,
    };
}

export function buildUpdateDto(payload: {
    invoice_supplier_code?: string;
    invoice_supplier_name: string;
    invoice_supplier_date: string;
    invoice_supplier_due_date: string;
    invoice_supplier_status: InvoiceSupplierStatus;
    invoice_supplier_detail?: string;
    invoicePayments: InvoicePaymentItem[];
}): UpdateInvoiceSupplierDto {
    return {
        invoice_supplier_code: payload.invoice_supplier_code || '',
        invoice_supplier_name: payload.invoice_supplier_name,
        invoice_supplier_date: payload.invoice_supplier_date,
        invoice_supplier_due_date: payload.invoice_supplier_due_date,
        invoice_supplier_status: payload.invoice_supplier_status,
        invoice_supplier_detail: payload.invoice_supplier_detail,
        invoice_payments: payload.invoicePayments.map((p) => ({
            invoice_payment_id: p.invoice_payment_id,
            payment_method: p.payment_method,
            payment_id: p.payment_id,
            invoice_payment_price: p.invoice_payment_price,
        })),
        invoice_supplier_total: payload.invoicePayments.reduce((total, p) => total + p.invoice_payment_price, 0),
    };
}
