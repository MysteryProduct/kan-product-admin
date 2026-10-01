"use client";

import { useEffect, useState } from "react";
import ContactRequestModel from "@/models/contact-request";
import InvoiceSupplierModel from "@/models/invoice-supplier";
import PurchaseOrderModel from "@/models/purchase-order";
import SaleOrderModel from "@/models/sale-order";
import SupplierModel from "@/models/supplier";
import ContactRequestDetailModal from "@/app/admin/contact-requests/components/detail";
import InvoiceSupplierDetailModal from "@/app/admin/invoice-supplier/components/detail";
import JobOrderDetailModal from "@/app/admin/job-orders/components/detail";
import MaterialDetailModal from "@/app/admin/materials/components/detail";
import ProductDetailModal from "@/app/admin/products/components/detail";
import PurchaseOrderDetailModal from "@/app/admin/purchase-orders/components/detail";
import SaleOrderDetailModal from "@/app/admin/sale-orders/components/detail";
import StoreOrderModal from "@/app/admin/store-fulfillment/components/store-order-modal";
import { getApiErrorMessage } from "@/lib/api-error";
import axiosInstance from "@/lib/axios";
import type { ContactRequest } from "@/types/contact-request";
import type { InvoiceSupplierRow } from "@/types/invoice-supplier";
import type { JobOrder } from "@/types/job-order";
import type { Material } from "@/types/material";
import type { Product } from "@/types/product";
import type { PurchaseOrder } from "@/types/purchase-order";
import type { SaleOrder } from "@/types/sale-order";
import type { DashboardListKind } from "@/types/dashboard";

const saleOrderModel = new SaleOrderModel();
const purchaseOrderModel = new PurchaseOrderModel();
const contactRequestModel = new ContactRequestModel();
const invoiceSupplierModel = new InvoiceSupplierModel();
const supplierModel = new SupplierModel();

/**
 * The record at `path`. Some endpoints answer with the record itself and some
 * wrap it as { data }; the models' getById methods only read the wrapped form,
 * so a record fetched here is unwrapped when needed.
 */
async function getRecord<T extends object>(
  path: string,
  idField: string,
): Promise<T> {
  const { data } = await axiosInstance.get<T | { data: T }>(path);
  if (!(idField in data) && "data" in data && data.data) return data.data;
  return data as T;
}

/** Kinds of row that an existing detail view can open from here. */
export const OPENABLE_KINDS: DashboardListKind[] = [
  "sale_order",
  "purchase_order",
  "contact_request",
  "product_variant",
  "material",
  "job_order",
  "invoice_supplier",
  "store_order",
];

type Loaded =
  | { kind: "sale_order"; record: SaleOrder }
  | { kind: "purchase_order"; record: PurchaseOrder }
  | { kind: "contact_request"; record: ContactRequest }
  | { kind: "product_variant"; record: Product }
  | { kind: "material"; record: Material }
  | { kind: "job_order"; record: JobOrder }
  | { kind: "invoice_supplier"; record: InvoiceSupplierRow };

interface RecordDetailProps {
  kind: DashboardListKind;
  /** The id of the record to open (the row's ref_id). */
  id: string;
  onClose: () => void;
  /** The record was changed from its detail view (approved, cancelled, ...). */
  onChanged: () => void;
  onError: (message: string) => void;
}

/**
 * Opens the record's own detail view, the same one its page uses, on top of
 * the list. The record is fetched by id when it is opened, so what is shown is
 * what the page would show.
 */
export default function RecordDetail({
  kind,
  id,
  onClose,
  onChanged,
  onError,
}: RecordDetailProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    // A store order opens in its own modal, which fetches the order itself.
    if (kind === "store_order") return;
    let cancelled = false;
    const load = async (): Promise<Loaded> => {
      if (kind === "sale_order")
        return { kind, record: await saleOrderModel.getSaleOrderById(id) };
      if (kind === "purchase_order")
        return {
          kind,
          record: await purchaseOrderModel.getPurchaseOrderById(id),
        };
      if (kind === "contact_request")
        return {
          kind,
          record: await contactRequestModel.getContactRequestById(id),
        };
      if (kind === "product_variant")
        return {
          kind,
          record: await getRecord<Product>(`/product/${id}`, "product_id"),
        };
      if (kind === "material")
        return {
          kind,
          record: await getRecord<Material>(`/materials/${id}`, "material_id"),
        };
      if (kind === "job_order")
        return {
          kind,
          record: await getRecord<JobOrder>(`/job-order/${id}`, "job_order_id"),
        };
      if (kind === "invoice_supplier") {
        // The page adds the supplier's payment accounts before opening an invoice.
        const invoice = await invoiceSupplierModel.getInvoiceSupplierById(id);
        const supplierId = invoice.supplier?.supplier_id || invoice.supplier_id;
        const supplier = supplierId
          ? await supplierModel
              .getSupplierWithPaymentsById(supplierId)
              .catch(() => null)
          : null;
        const availablePayments = (supplier?.payments ?? []).map((payment) => ({
          payment_id: payment.payment_id,
          account_name: payment.account_name,
          account_number: payment.account_number,
          account_branch: payment.account_branch,
          bank_name: payment.bank_name,
        }));
        return {
          kind,
          record: supplierId ? { ...invoice, availablePayments } : invoice,
        };
      }
      throw new Error("ยังเปิดรายละเอียดของรายการนี้จากหน้านี้ไม่ได้");
    };
    load()
      .then((value) => {
        if (!cancelled) setLoaded(value);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onError(`เปิดรายละเอียดไม่สำเร็จ: ${getApiErrorMessage(error)}`);
        onClose();
      });
    return () => {
      cancelled = true;
    };
    // The record is fetched once per row that is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  if (kind === "store_order")
    return (
      <StoreOrderModal
        storeOrderId={id}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  if (!loaded) return null;

  const changed = () => {
    onChanged();
  };

  if (loaded.kind === "sale_order") {
    return (
      <SaleOrderDetailModal
        isOpen
        onClose={onClose}
        onSuccess={changed}
        saleOrder={loaded.record}
      />
    );
  }
  if (loaded.kind === "purchase_order") {
    return (
      <PurchaseOrderDetailModal
        isOpen
        onClose={onClose}
        onSuccess={changed}
        purchaseOrder={loaded.record}
      />
    );
  }
  if (loaded.kind === "contact_request") {
    return (
      <ContactRequestDetailModal
        isOpen
        onClose={onClose}
        onSuccess={changed}
        contactRequest={loaded.record}
      />
    );
  }
  if (loaded.kind === "product_variant") {
    return (
      <ProductDetailModal isOpen onClose={onClose} product={loaded.record} />
    );
  }
  if (loaded.kind === "material") {
    return (
      <MaterialDetailModal isOpen onClose={onClose} material={loaded.record} />
    );
  }
  if (loaded.kind === "job_order") {
    return (
      <JobOrderDetailModal
        isOpen
        onClose={onClose}
        jobOrder={loaded.record}
        mode="view"
      />
    );
  }
  return (
    <InvoiceSupplierDetailModal
      isOpen
      onClose={onClose}
      invoice={loaded.record}
    />
  );
}
