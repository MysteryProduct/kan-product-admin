"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LoadErrorBanner, { loadErrorText } from "@/components/LoadErrorBanner";
import PaymentReceiptModel from "@/models/payment-receipt";
import type { PaymentReceipt } from "@/types/payment-receipt";
import { BASE } from "../lib/receipt-display";
import { Icon } from "./receipt-ui";

const receiptModel = new PaymentReceiptModel();

/** In place of a page the employee may not use; the layout only checks `view` (R1). */
export function NoPermissionNote({ action }: { action: string }) {
  return (
    <div className="ka-pr">
      <div
        role="note"
        className="ka-pr-note ka-pr-tone"
        style={{ display: "flex" }}
        data-tone="neutral"
      >
        <Icon name="lock" small />
        <span>
          คุณไม่มีสิทธิ์{action} ดูรายการได้ที่{" "}
          <Link href={BASE} className="ka-pr-link">
            ใบเสร็จรับเงิน
          </Link>
        </span>
      </div>
    </div>
  );
}

export function PageLoading({ what }: { what: string }) {
  return (
    <div className="ka-pr" aria-busy="true">
      <span
        className="ka-pr-sk"
        style={{ display: "block", width: 320, height: 36 }}
      />
      <p className="sr-only">กำลังโหลด{what}</p>
    </div>
  );
}

export function PageLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ka-pr">
      <LoadErrorBanner message={message} onRetry={onRetry} />
      <Link href={BASE} className="ka-pr-link">
        ← กลับไปรายการใบเสร็จรับเงิน
      </Link>
    </div>
  );
}

/** What the edit page shows in place of the form when the receipt cannot be edited (R24). */
export function LockedNote({ text, href }: { text: string; href: string }) {
  return (
    <div className="ka-pr">
      <div
        role="note"
        className="ka-pr-note ka-pr-tone"
        style={{ display: "flex" }}
        data-tone="neutral"
      >
        <Icon name="lock" small />
        <span>{text}</span>
      </div>
      <Link href={href} className="ka-pr-link">
        ← กลับไปใบเสร็จ
      </Link>
    </div>
  );
}

/** Loads one receipt; `reload` refetches it in place. */
export function useReceipt(id: string | undefined) {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    receiptModel
      .getPaymentReceiptById(id)
      .then((loaded) => {
        if (!active) return;
        if (loaded?.payment_receipt_id) setReceipt(loaded);
        else setError("ไม่พบใบเสร็จนี้ อาจถูกลบไปแล้ว");
      })
      .catch((failure: unknown) => {
        if (!active) return;
        const status = (failure as { response?: { status?: number } })?.response
          ?.status;
        setError(
          status === 404 || status === 400
            ? "ไม่พบใบเสร็จนี้ อาจถูกลบไปแล้ว"
            : loadErrorText("ใบเสร็จรับเงิน", failure),
        );
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const reload = useCallback(() => {
    setError(null);
    setAttempt((count) => count + 1);
  }, []);
  return { receipt, error, reload };
}
