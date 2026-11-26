"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "@/lib/axios";
import { usePermissions } from "@/hooks/usePermissions";
import StatusBadge from "@/components/StatusBadge";
import type { CustomCancellationQueue } from "@/types/custom-cancellation";

const SHOWN = 5;

/**
 * TASK-0217: Custom cancellation work that waits for staff - a request to
 * decide, or an approved one whose transfer is not recorded. Drawn only when
 * there is some; a failed load leaves the list page as it was.
 */
export default function CustomCancellationStrip({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const { can } = usePermissions();
  // The queue carries customers' bank accounts: the API gives it only to
  // someone who may cancel a sale order (owner decision D7).
  const canView = can("sale_orders", "reject");
  const [queue, setQueue] = useState<CustomCancellationQueue | null>(null);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    axios
      .get<CustomCancellationQueue>("/custom-cancellation", {
        params: { queue: "open", limit: SHOWN },
      })
      .then((response) => {
        if (active) setQueue(response.data);
      })
      .catch(() => {
        if (active) setQueue(null);
      });
    return () => {
      active = false;
    };
  }, [canView, refreshKey]);

  const rows = queue?.data ?? [];
  if (!canView || rows.length === 0) return null;
  const shown = rows.slice(0, SHOWN);
  const total = Math.max(queue?.meta?.total ?? rows.length, rows.length);
  const more = total - shown.length;

  return (
    <section
      className="ka-so-card ka-so-cp flex flex-col gap-2"
      aria-label="คำขอยกเลิก Custom ที่ค้าง"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="warning">
          คำขอยกเลิก Custom ค้าง {total.toLocaleString("th-TH")} รายการ
        </StatusBadge>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {shown.map((item) => (
          <li key={item.id} className="break-words">
            <Link
              className="inline-flex min-h-6 items-center underline tabular-nums max-sm:min-h-11"
              href={`/admin/sale-orders/${encodeURIComponent(item.saleOrderId)}`}
            >
              {item.customRequestCode} · {item.saleOrderCode}
            </Link>{" "}
            —{" "}
            {item.status === "pending"
              ? "รอพิจารณา"
              : `รอโอนคืน ${(item.refundAmount ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`}
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="ka-so-cap">
          และอีก {more.toLocaleString("th-TH")} รายการ
        </p>
      )}
    </section>
  );
}
