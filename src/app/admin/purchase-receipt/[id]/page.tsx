'use client';

import { useParams } from 'next/navigation';
import ReceiptDetail from '../components/receipt-detail';
import { PageLoadError, PageLoading } from '../components/page-states';
import { usePurchaseReceipt } from '../hooks/usePurchaseReceipt';

export default function PurchaseReceiptDetailPage() {
  const id = useParams<{ id: string }>()?.id;
  const { receipt, order, error, reload } = usePurchaseReceipt(id);

  if (error && !receipt) return <PageLoadError message={error} onRetry={reload} />;
  if (!receipt) return <PageLoading what="ใบรับสินค้า" />;
  return <ReceiptDetail receipt={receipt} order={order} onChanged={reload} />;
}
