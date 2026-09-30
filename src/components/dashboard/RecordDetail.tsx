'use client';

import { useEffect, useState } from 'react';
import ContactRequestModel from '@/models/contact-request';
import PurchaseOrderModel from '@/models/purchase-order';
import SaleOrderModel from '@/models/sale-order';
import ContactRequestDetailModal from '@/app/admin/contact-requests/components/detail';
import PurchaseOrderDetailModal from '@/app/admin/purchase-orders/components/detail';
import SaleOrderDetailModal from '@/app/admin/sale-orders/components/detail';
import { getApiErrorMessage } from '@/lib/api-error';
import type { ContactRequest } from '@/types/contact-request';
import type { PurchaseOrder } from '@/types/purchase-order';
import type { SaleOrder } from '@/types/sale-order';
import type { DashboardListKind } from '@/types/dashboard';

const saleOrderModel = new SaleOrderModel();
const purchaseOrderModel = new PurchaseOrderModel();
const contactRequestModel = new ContactRequestModel();

/** Kinds of row that an existing detail view can open from here. */
export const OPENABLE_KINDS: DashboardListKind[] = ['sale_order', 'purchase_order', 'contact_request'];

type Loaded =
  | { kind: 'sale_order'; record: SaleOrder }
  | { kind: 'purchase_order'; record: PurchaseOrder }
  | { kind: 'contact_request'; record: ContactRequest };

interface RecordDetailProps {
  kind: DashboardListKind;
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
export default function RecordDetail({ kind, id, onClose, onChanged, onError }: RecordDetailProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<Loaded> => {
      if (kind === 'sale_order') return { kind, record: await saleOrderModel.getSaleOrderById(id) };
      if (kind === 'purchase_order') return { kind, record: await purchaseOrderModel.getPurchaseOrderById(id) };
      if (kind === 'contact_request') return { kind, record: await contactRequestModel.getContactRequestById(id) };
      throw new Error('ยังเปิดรายละเอียดของรายการนี้จากหน้านี้ไม่ได้');
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

  if (!loaded) return null;

  const changed = () => {
    onChanged();
  };

  if (loaded.kind === 'sale_order') {
    return <SaleOrderDetailModal isOpen onClose={onClose} onSuccess={changed} saleOrder={loaded.record} />;
  }
  if (loaded.kind === 'purchase_order') {
    return <PurchaseOrderDetailModal isOpen onClose={onClose} onSuccess={changed} purchaseOrder={loaded.record} />;
  }
  return <ContactRequestDetailModal isOpen onClose={onClose} onSuccess={changed} contactRequest={loaded.record} />;
}
