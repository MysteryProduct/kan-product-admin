import { PaginationMeta } from "./pagination";

export interface Supplier {
    supplier_id: string;
    supplier_name: string;
    supplier_contact: string;
    supplier_address: string;
    supplier_phone: string;
    tax_id: string;
}
export interface SupplierUpdate extends Supplier {
    payments?: PaymentUpdate[];

}
export interface Payment {
    supplier_id: string;
    account_name: string;
    account_number: string;
    account_branch: string;
    bank_name: string;
}
export interface PaymentUpdate extends Payment {
    payment_id: string;
}

export interface SupplierWithPayment extends Supplier {
    payments?: PaymentUpdate[];
}

export interface ApiSupplierResponse {
    data: Supplier[];
    meta: PaginationMeta;
}

export interface ApiSupplierWithPaymentResponse {
    data: SupplierWithPayment[];
    meta: PaginationMeta;
}