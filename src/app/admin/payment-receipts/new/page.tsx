"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { NoPermissionNote } from "../components/page-states";
import ReceiptForm from "../components/receipt-form";

/** "สร้างใบเสร็จรับเงิน"; with `?sale_order=<id>` it starts from that order. */
function NewReceipt() {
  const saleOrder = useSearchParams()?.get("sale_order") ?? null;
  return (
    <ReceiptForm
      key={saleOrder ?? ""}
      mode="create"
      presetOrderId={saleOrder}
    />
  );
}

export default function NewReceiptPage() {
  const { can, isLoaded } = usePermissions();
  if (isLoaded && !can("payment_receipts", "add"))
    return <NoPermissionNote action="สร้างใบเสร็จรับเงิน" />;
  return (
    <Suspense fallback={null}>
      <NewReceipt />
    </Suspense>
  );
}
