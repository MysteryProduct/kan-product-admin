"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ActionResultDialog from "@/components/ActionResultDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import RowMenu, { type RowMenuItem } from "@/components/RowMenu";
import { useIsPhone } from "@/hooks/useMediaQuery";
import { usePermissions } from "@/hooks/usePermissions";
import { getApiErrorMessage } from "@/lib/api-error";
import PaymentReceiptModel from "@/models/payment-receipt";
import type { PaymentReceipt } from "@/types/payment-receipt";
import { formatBaht } from "@/app/admin/sale-orders/lib/so-display";
import {
  afterDelete,
  BASE,
  canDeleteReceipt,
  canEditReceipt,
  customerOf,
  lockNote,
  ORDERS,
  signedBaht,
} from "../lib/receipt-display";
import { Icon, type IconName } from "./receipt-ui";

const receiptModel = new PaymentReceiptModel();

interface Options {
  /** After a deletion, once the employee closed the result. */
  onDeleted: () => void;
}

/** The delete step the list and the detail page share: confirm, send, then say how it ended (R29, R30). */
export function useReceiptDelete({ onDeleted }: Options): {
  request: (receipt: PaymentReceipt) => void;
  dialogs: ReactNode;
} {
  const isPhone = useIsPhone();
  const [target, setTarget] = useState<PaymentReceipt | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const sending = useRef(false);

  const remove = async (receipt: PaymentReceipt) => {
    if (sending.current) return;
    sending.current = true;
    try {
      await receiptModel.deletePaymentReceipt(receipt.payment_receipt_id);
      setResult({
        ok: true,
        message: `${receipt.payment_receipt_code} · ${signedBaht(Number(receipt.amount_paid))}`,
      });
    } catch (error) {
      setResult({ ok: false, message: getApiErrorMessage(error) });
    } finally {
      sending.current = false;
    }
  };

  const facts = target ? afterDelete(target) : null;
  const order = target?.saleOrder?.sale_order_code ?? "—";
  const heading = result?.ok ? "ลบใบเสร็จแล้ว" : "ลบไม่สำเร็จ";

  return {
    request: useCallback((receipt: PaymentReceipt) => setTarget(receipt), []),
    dialogs: (
      <>
        <ConfirmDialog
          isOpen={Boolean(target)}
          title={`ลบใบเสร็จ ${target?.payment_receipt_code ?? ""}?`}
          message=""
          description={
            isPhone && facts
              ? `ยอด ${formatBaht(facts.amount)} จะถูกหักออกจาก ${order} ชำระแล้วเหลือ ${formatBaht(facts.paidAfter)} ลบแล้วกู้คืนไม่ได้`
              : "ลบแล้วกู้คืนไม่ได้ ประวัติการลบยังถูกบันทึกไว้"
          }
          confirmLabel="ลบใบเสร็จ"
          cancelLabel="ยกเลิก"
          placement={isPhone ? "sheet" : "center"}
          className={`ka-pr-dlg${isPhone ? " ka-pr-sheet" : ""}`}
          icon={<Icon name="delete" />}
          onCancel={() => setTarget(null)}
          onConfirm={() => target && void remove(target)}
        >
          {facts && !isPhone && (
            <div className="ka-pr-facts">
              <div>
                <span className="ka-pr-mut">ใบสั่งขาย</span>
                <span className="ka-pr-code">{order}</span>
              </div>
              <div>
                <span className="ka-pr-mut">ยอดที่จะถูกหักออก</span>
                <b>{formatBaht(facts.amount)}</b>
              </div>
              <div>
                <span className="ka-pr-mut">ชำระแล้วหลังลบ</span>
                <span>
                  {formatBaht(facts.paidAfter)} จาก {formatBaht(facts.total)}
                </span>
              </div>
            </div>
          )}
        </ConfirmDialog>
        <ActionResultDialog
          isOpen={Boolean(result)}
          status={result?.ok ? "success" : "error"}
          action="delete"
          title={heading}
          body={
            <>
              <span className="ka-pr-res__title">{heading}</span>
              {result?.message}
            </>
          }
          errorIcon={<Icon name="alert" size={28} />}
          confirmText={result?.ok ? "ตกลง" : "ปิด"}
          className={`ka-pr-res${result?.ok ? "" : " ka-pr-res--error"}`}
          onClose={() => {
            const ok = result?.ok;
            setResult(null);
            setTarget(null);
            if (ok) onDeleted();
          }}
        />
      </>
    ),
  };
}

export interface MenuEntry {
  label: string;
  icon: IconName;
  tone?: "danger";
  onSelect: () => void;
}

interface ReceiptMenuProps {
  receipt: PaymentReceipt;
  /** What the "⋯" button is named for a screen reader. */
  label: string;
  entries: MenuEntry[];
  note?: string;
  triggerClassName?: string;
}

/** The "⋯" menu: a panel 260 wide, or below 640px the sheet of `Sheets-sm` with the receipt on top (R9). */
export function ReceiptMenu({
  receipt,
  label,
  entries,
  note,
  triggerClassName = "ka-pr-ib ka-pr-ib--sm",
}: ReceiptMenuProps) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);

  if (!isPhone) {
    const items: RowMenuItem[] = entries.map(
      ({ label: text, icon, tone, onSelect }) => ({
        label: text,
        icon:
          icon === "documentLines" ? "document" : (icon as RowMenuItem["icon"]),
        tone,
        onSelect,
      }),
    );
    return (
      <RowMenu
        label={label}
        items={items}
        note={note}
        width={260}
        menuClassName="ka-pr-menu"
        triggerClassName={triggerClassName}
        trigger={<Icon name="dots" />}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Icon name="dots" />
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={receipt.payment_receipt_code}
        description={`${customerOf(receipt)} · ${signedBaht(Number(receipt.amount_paid))}`}
        placement="sheet"
        size="compact"
        className="ka-pr-sheet"
        footer={
          <button
            type="button"
            className="ka-pr-btn"
            onClick={() => setOpen(false)}
          >
            ปิด
          </button>
        }
      >
        <div>
          {entries.map((entry) => (
            <button
              key={entry.label}
              type="button"
              className="ka-pr-bsi"
              data-tone={entry.tone}
              onClick={() => {
                setOpen(false);
                entry.onSelect();
              }}
            >
              <Icon name={entry.icon} />
              {entry.label}
            </button>
          ))}
          {note && (
            <p className="ka-pr-bsnote">
              <Icon name="lock" small />
              {note}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

/** R9: what the menu of a row offers, by the receipt and the employee's permission. */
export function useRowEntries(onDelete: (receipt: PaymentReceipt) => void) {
  const router = useRouter();
  const { can } = usePermissions();
  const canEdit = can("payment_receipts", "edit");
  const canDelete = can("payment_receipts", "delete");

  return useCallback(
    (receipt: PaymentReceipt): { entries: MenuEntry[]; note?: string } => {
      const href = `${BASE}/${receipt.payment_receipt_id}`;
      const entries: MenuEntry[] = [
        {
          label: "ดูรายละเอียด",
          icon: "view",
          onSelect: () => router.push(href),
        },
      ];
      if (canEdit && canEditReceipt(receipt)) {
        entries.push({
          label: "แก้ไข",
          icon: "edit",
          onSelect: () => router.push(`${href}/edit`),
        });
      }
      entries.push({
        label: "พิมพ์ / PDF",
        icon: "print",
        onSelect: () => router.push(`${href}?print=1`),
      });
      if (receipt.saleOrder) {
        const order = `${ORDERS}/${receipt.saleOrder.sale_order_id}`;
        entries.push({
          label: "ไปที่ใบสั่งขาย",
          icon: "document",
          onSelect: () => router.push(order),
        });
      }
      if (canDelete && canDeleteReceipt(receipt)) {
        entries.push({
          label: "ลบใบเสร็จ",
          icon: "delete",
          tone: "danger",
          onSelect: () => onDelete(receipt),
        });
      }
      return { entries, note: lockNote(receipt) };
    },
    [router, canEdit, canDelete, onDelete],
  );
}
