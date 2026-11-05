"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cookies from "js-cookie";
import { loadErrorText } from "@/components/LoadErrorBanner";
import { getApiErrorMessage } from "@/lib/api-error";
import { todayLocalIso, toDateInputValue } from "@/lib/date-format";
import BankAccountModel from "@/models/bank-account";
import PaymentReceiptModel from "@/models/payment-receipt";
import SaleOrderModel from "@/models/sale-order";
import type { BankAccount } from "@/types/bank-account";
import type {
  PaymentMethod,
  PaymentReceipt,
  PaymentReceiptType,
} from "@/types/payment-receipt";
import type { SaleOrder } from "@/types/sale-order";
import {
  formatBaht,
  formatMoney,
  paymentState,
} from "@/app/admin/sale-orders/lib/so-display";
import { orderOf, sumMoney } from "../lib/receipt-display";

const receiptModel = new PaymentReceiptModel();
const saleOrderModel = new SaleOrderModel();
const bankModel = new BankAccountModel();
const OPTIONS_PER_REQUEST = 20;

export type FormType = Exclude<PaymentReceiptType, "refund">;

export interface ReceiptFormValues {
  type: FormType;
  method: PaymentMethod;
  amount: string;
  date: string;
  remark: string;
  account: string;
}

export type OrderRefusal =
  | { kind: "cancelled" | "status" | "custom"; code: string; href?: string }
  | { kind: "missing" };

const receivable = (order: SaleOrder) =>
  (order.sale_order_status === "approved" ||
    order.sale_order_status === "partial") &&
  order.sale_order_type !== "custom" &&
  paymentState(order).due > 0;

/** One order with what it has received; `GET /sale-order/:id` carries no `amount_paid` of its own. */
export async function loadOrder(id: string): Promise<SaleOrder> {
  const [order, receipts] = await Promise.all([
    saleOrderModel.getSaleOrderById(id),
    receiptModel.getPaymentReceiptsBySaleOrder(id, 200),
  ]);
  return {
    ...order,
    amount_paid: sumMoney(
      (receipts.data ?? []).map((receipt) => Number(receipt.amount_paid)),
    ),
  };
}

/** Money as typed: `12500.50` or `12,500.50`, up to two decimals. Anything else is refused, never reshaped. */
export function parseAmount(text: string): number | null {
  const clean = text.trim();
  return /^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/.test(clean)
    ? Number(clean.replace(/,/g, ""))
    : null;
}

const plain = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

interface Options {
  mode: "create" | "edit";
  receipt?: PaymentReceipt;
  /** `?sale_order=` of the create page. */
  presetOrderId?: string | null;
}

/** State, rules and sending of the one receipt form (create and edit, R21). */
export function useReceiptForm({ mode, receipt, presetOrderId }: Options) {
  const editing = mode === "edit";
  const initial = useMemo<ReceiptFormValues>(
    () =>
      receipt
        ? {
            type:
              receipt.payment_receipt_type === "online_gateway" ||
              receipt.payment_receipt_type === "refund"
                ? "full"
                : receipt.payment_receipt_type,
            method: receipt.payment_method === "cash" ? "cash" : "bank",
            amount: plain(Number(receipt.amount_paid)),
            date: toDateInputValue(receipt.payment_date),
            remark: receipt.payment_receipt_remark ?? "",
            account: receipt.account_id ?? "",
          }
        : {
            type: "partial",
            method: "bank",
            amount: "",
            date: todayLocalIso(),
            remark: "",
            account: "",
          },
    [receipt],
  );

  const [values, setValues] = useState(initial);
  const [order, setOrder] = useState<SaleOrder | null>(
    receipt ? orderOf(receipt) : null,
  );
  const [options, setOptions] = useState<SaleOrder[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(editing);
  const [refusal, setRefusal] = useState<OrderRefusal | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    let active = true;
    bankModel
      .getBankAccounts(1, 200)
      .then((response) => {
        if (active) setAccounts(response.data ?? []);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(loadErrorText("บัญชีรับเงิน", error));
      });
    return () => {
      active = false;
    };
  }, []);

  const search = useCallback((term?: string) => {
    return saleOrderModel
      .getSaleOrders(
        1,
        OPTIONS_PER_REQUEST,
        term,
        "create_date",
        "ASC",
        undefined,
        { statuses: ["approved", "partial"] },
      )
      .then((response) => {
        const found = (response.data ?? []).filter(receivable);
        setOptions((current) => {
          const known = new Set(current.map((item) => item.sale_order_id));
          return [
            ...current,
            ...found.filter((item) => !known.has(item.sale_order_id)),
          ];
        });
      })
      .catch((error: unknown) =>
        setLoadError(loadErrorText("รายการใบสั่งขาย", error)),
      );
  }, []);

  useEffect(() => {
    if (editing) return;
    void search().finally(() => setOptionsLoaded(true));
  }, [editing, search]);

  const pick = useCallback((next: SaleOrder) => {
    setOrder(next);
    setRefusal(null);
    setAttempted(false);
    setValues((current) => ({
      ...current,
      amount: plain(paymentState(next).due),
    }));
  }, []);

  // A link from another page: take the order when it can be paid, otherwise say why and leave the picker empty.
  useEffect(() => {
    if (editing || !presetOrderId) return;
    let active = true;
    loadOrder(presetOrderId)
      .then((loaded) => {
        if (!active) return;
        if (!loaded?.sale_order_id) setRefusal({ kind: "missing" });
        else if (loaded.sale_order_status === "cancelled")
          setRefusal({ kind: "cancelled", code: loaded.sale_order_code ?? "" });
        else if (loaded.sale_order_type === "custom")
          setRefusal({
            kind: "custom",
            code: loaded.sale_order_code ?? "",
            href: `/admin/sale-orders/${loaded.sale_order_id}`,
          });
        else if (!receivable(loaded))
          setRefusal({ kind: "status", code: loaded.sale_order_code ?? "" });
        else {
          setOptions((current) =>
            current.some((item) => item.sale_order_id === loaded.sale_order_id)
              ? current
              : [loaded, ...current],
          );
          pick(loaded);
        }
      })
      .catch(() => {
        if (active) setRefusal({ kind: "missing" });
      });
    return () => {
      active = false;
    };
  }, [editing, presetOrderId, pick]);

  // Editing: read the order itself when allowed, so returned goods count in what is still owed.
  const receiptOrderId = receipt?.sale_order_id;
  useEffect(() => {
    if (!editing || !receiptOrderId) return;
    let active = true;
    loadOrder(receiptOrderId)
      .then((loaded) => {
        if (active && loaded?.sale_order_id) setOrder(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [editing, receiptOrderId]);

  const pay = order ? paymentState(order) : null;
  const original = receipt ? Number(receipt.amount_paid) : 0;
  /** What this receipt may hold: all that is owed, plus what it already holds when editing (R22). */
  const maximum = pay ? sumMoney([pay.due, original]) : 0;
  const paidElsewhere = pay ? sumMoney([pay.paid, -original]) : 0;
  const locked = values.type === "full";
  const parsed = locked ? maximum : parseAmount(values.amount);
  const amount = parsed ?? 0;
  const over = Boolean(order) && parsed !== null && parsed > maximum;
  const overBy = over ? sumMoney([amount, -maximum]) : 0;
  const after = over ? null : Math.max(0, sumMoney([maximum, -amount]));

  const amountError = (() => {
    if (over) {
      return editing
        ? `เกินยอดที่รับได้ ${formatBaht(overBy)} ใบนี้รับได้สูงสุด ${formatBaht(maximum)} (รวมยอดเดิม ${formatBaht(original)})`
        : `เกินยอดค้างชำระ ${formatBaht(overBy)} ลดยอดลงหรือเลือกใบสั่งขายอื่น`;
    }
    if (parsed === null && values.amount.trim())
      return "ใส่เป็นตัวเลข ทศนิยมได้ไม่เกิน 2 ตำแหน่ง";
    if (attempted && (parsed === null || parsed <= 0))
      return "ยอดรับชำระต้องมากกว่า 0";
    return null;
  })();
  const accountError =
    attempted && values.method === "bank" && !values.account
      ? "เลือกบัญชีที่รับเงินเมื่อชำระด้วยการโอน"
      : null;
  const dateError =
    attempted && !values.date ? "กรุณาเลือกวันที่รับชำระ" : null;
  const orderError = attempted && !order ? "เลือกใบสั่งขายที่รับชำระ" : null;

  const fixes = [
    amountError && "ยอดรับชำระ",
    accountError && "บัญชีที่รับเงิน",
    dateError && "วันที่รับชำระ",
    orderError && "ใบสั่งขาย",
  ].filter((item): item is string => Boolean(item));

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const set = useCallback(
    <K extends keyof ReceiptFormValues>(
      key: K,
      value: ReceiptFormValues[K],
    ) => {
      setValues((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const setMethod = useCallback((method: PaymentMethod) => {
    setValues((current) => ({
      ...current,
      method,
      account: method === "cash" ? "" : current.account,
    }));
  }, []);

  const fill = useCallback(() => set("amount", plain(maximum)), [set, maximum]);

  const setType = useCallback(
    (type: FormType) => {
      setValues((current) => ({
        ...current,
        type,
        amount: type === "full" ? plain(maximum) : current.amount,
      }));
    },
    [maximum],
  );

  const orderId = order?.sale_order_id;
  /** Sends the form once, however often the button is pressed; returns the saved receipt or null. */
  const submit = useCallback(async (): Promise<PaymentReceipt | null> => {
    setAttempted(true);
    const valid =
      parsed !== null &&
      parsed > 0 &&
      !over &&
      Boolean(values.date) &&
      (values.method === "cash" || Boolean(values.account)) &&
      Boolean(orderId);
    if (!valid || sending.current) return null;
    sending.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const user = Cookies.get("user")
        ? JSON.parse(Cookies.get("user") as string)
        : null;
      const shared = {
        payment_receipt_type: values.type,
        payment_method: values.method,
        amount_paid: parsed,
        payment_date: values.date,
        payment_receipt_remark: values.remark,
        account_id: values.method === "bank" ? values.account : undefined,
      };
      if (editing && receipt) {
        return await receiptModel.updatePaymentReceipt({
          payment_receipt_id: receipt.payment_receipt_id,
          payment_receipt_code: receipt.payment_receipt_code,
          ...shared,
          payment_status: receipt.payment_status,
          update_by: user?.employee_id,
        });
      }
      return await receiptModel.createPaymentReceipt({
        sale_order_id: orderId as string,
        ...shared,
        payment_status: "paid",
        create_by: user?.employee_id,
      });
    } catch (error) {
      setSaveError(getApiErrorMessage(error));
      return null;
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }, [parsed, over, values, orderId, editing, receipt]);

  return {
    values,
    set,
    setMethod,
    setType,
    fill,
    order,
    pick,
    options,
    optionsLoaded,
    search,
    refusal,
    accounts,
    loadError,
    pay,
    original,
    maximum,
    paidElsewhere,
    locked,
    amount,
    shownAmount: locked ? formatMoney(maximum) : values.amount,
    over,
    after,
    amountError,
    accountError,
    dateError,
    orderError,
    fixes,
    dirty,
    saving,
    saveError,
    submit,
  };
}
