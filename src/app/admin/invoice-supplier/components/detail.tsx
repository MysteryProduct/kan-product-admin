'use client';

import type { InvoiceSupplierRow } from '@/types/invoice-supplier';
import { invoiceView } from '../lib/is-display';
import InvoiceDetail from './invoice-detail';

interface InvoiceSupplierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceSupplierRow | null;
}

/**
 * The invoice detail as the dashboard opens it: the same modal as the invoice page (TASK-0327 review F10),
 * read-only, so status words, fields and payments match on both screens.
 */
export default function InvoiceSupplierDetailModal({ isOpen, onClose, invoice }: InvoiceSupplierDetailModalProps) {
  // GET /invoice-supplier/:id answers `{ data: invoice }`, which the model passes on as it is.
  const row = (invoice as (InvoiceSupplierRow & { data?: InvoiceSupplierRow }) | null)?.data ?? invoice;
  if (!isOpen || !row) {
    return null;
  }

  return (
    <InvoiceDetail
      isOpen={isOpen}
      onClose={onClose}
      view={invoiceView(row)}
      availablePayments={invoice?.availablePayments ?? row.availablePayments ?? []}
    />
  );
}
