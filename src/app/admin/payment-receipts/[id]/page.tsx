"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  PageLoadError,
  PageLoading,
  useReceipt,
} from "../components/page-states";
import ReceiptDetail from "../components/receipt-detail";

function ReceiptDetailPage() {
  const id = useParams<{ id: string }>()?.id;
  const autoPrint = useSearchParams()?.get("print") === "1";
  const { receipt, error, reload } = useReceipt(id);

  if (error && !receipt)
    return <PageLoadError message={error} onRetry={reload} />;
  if (!receipt) return <PageLoading what="ใบเสร็จรับเงิน" />;
  return <ReceiptDetail receipt={receipt} autoPrint={autoPrint} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReceiptDetailPage />
    </Suspense>
  );
}
