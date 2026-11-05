"use client";

import { useParams } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import {
  LockedNote,
  NoPermissionNote,
  PageLoadError,
  PageLoading,
  useReceipt,
} from "../../components/page-states";
import ReceiptForm from "../../components/receipt-form";
import { BASE, canEditReceipt, editLock } from "../../lib/receipt-display";

export default function EditReceiptPage() {
  const id = useParams<{ id: string }>()?.id;
  const { can, isLoaded } = usePermissions();
  const { receipt, error, reload } = useReceipt(id);

  if (isLoaded && !can("payment_receipts", "edit"))
    return <NoPermissionNote action="แก้ไขใบเสร็จรับเงิน" />;
  if (error && !receipt)
    return <PageLoadError message={error} onRetry={reload} />;
  if (!receipt) return <PageLoading what="ใบเสร็จรับเงิน" />;
  if (!canEditReceipt(receipt)) {
    return (
      <LockedNote
        text={editLock(receipt)}
        href={`${BASE}/${receipt.payment_receipt_id}`}
      />
    );
  }
  return <ReceiptForm mode="edit" receipt={receipt} />;
}
