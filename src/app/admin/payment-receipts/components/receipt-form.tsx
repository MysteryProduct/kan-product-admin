"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import ActionResultDialog from "@/components/ActionResultDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import CustomSelect from "@/components/CustomSelect";
import LoadErrorBanner from "@/components/LoadErrorBanner";
import { usePageCrumb } from "@/lib/page-crumb";
import type { PaymentReceipt } from "@/types/payment-receipt";
import type { SaleOrder } from "@/types/sale-order";
import { useLeaveGuard } from "../../purchase-orders/hooks/useLeaveGuard";
import {
  formatBaht,
  paymentState,
  payable,
} from "@/app/admin/sale-orders/lib/so-display";
import {
  useReceiptForm,
  type FormType,
  type OrderRefusal,
} from "../hooks/useReceiptForm";
import {
  BASE,
  ORDERS,
  customerOf,
  receiptStatus,
} from "../lib/receipt-display";
import { Badge, Icon, OrderBadge } from "./receipt-ui";

interface RadioOption<T extends string> {
  value: T;
  label: string;
  hint: string;
}

const TYPE_OPTIONS: RadioOption<FormType>[] = [
  { value: "full", label: "ชำระเต็มจำนวน", hint: "รับยอดค้างทั้งหมด" },
  { value: "partial", label: "ชำระบางส่วน", hint: "ใส่ยอดเอง" },
  { value: "deposit", label: "วางมัดจำ", hint: "ก่อนเริ่มผลิต" },
];

const METHOD_OPTIONS: RadioOption<"bank" | "cash">[] = [
  { value: "bank", label: "โอนผ่านธนาคาร", hint: "เลือกบัญชีที่รับเงิน" },
  { value: "cash", label: "เงินสด", hint: "รับที่ร้าน" },
];

/** Radio cards: Tab enters the group at the chosen card, the arrow keys move and choose (G9). */
function RadioCards<T extends string>({
  labelledBy,
  value,
  options,
  onChange,
  two = false,
}: {
  labelledBy: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
  two?: boolean;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const at = options.findIndex((option) => option.value === value);
    const next = (at + step + options.length) % options.length;
    onChange(options[next].value);
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  };
  return (
    <div
      ref={groupRef}
      className={`ka-pr-seg${two ? " ka-pr-seg--two" : ""}`}
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          className="ka-pr-opt"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
        >
          <span className="ka-pr-opt__dot" />
          <span>
            <span className="ka-pr-ot">{option.label}</span>
            <span className="ka-pr-cap">{option.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function OrderSummaryBox({
  order,
  line,
}: {
  order: SaleOrder;
  line: ReactNode;
}) {
  return (
    <div className="ka-pr-sosum">
      <span className="ka-pr-sosum__ic">
        <Icon name="documentLines" />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="ka-pr-row ka-pr-row--8 ka-pr-row--wrap">
          <span className="ka-pr-code ka-pr-code--600">
            {order.sale_order_code}
          </span>
          <OrderBadge status={order.sale_order_status} />
        </div>
        <div className="ka-pr-sosum__name">{order.sale_order_name}</div>
      </div>
      <Link
        className="ka-pr-btn ka-pr-btn--gh ka-pr-btn--sm ka-pr-btn--brand ka-pr-sosum__open"
        href={`${ORDERS}/${order.sale_order_id}`}
      >
        ดูใบสั่งขาย
      </Link>
      <div className="ka-pr-cap ka-pr-cap--14 ka-pr-sosum__line">{line}</div>
    </div>
  );
}

function RefusalBanner({ refusal }: { refusal: OrderRefusal }) {
  return (
    <div className="ka-pr-banner" data-tone="warning" role="alert">
      <Icon name="warning" />
      <div>
        <b>ใบสั่งขายนี้รับชำระไม่ได้</b>{" "}
        {refusal.kind === "missing" ? (
          "ไม่พบใบสั่งขายตามลิงก์ เลือกใบสั่งขายอื่นด้านล่าง"
        ) : (
          <>
            <span className="ka-pr-code">{refusal.code}</span>{" "}
            {refusal.kind === "cancelled" &&
              "ถูกยกเลิกแล้ว เลือกใบสั่งขายอื่นด้านล่าง"}
            {refusal.kind === "status" &&
              "ไม่อยู่ในสถานะที่รับชำระได้ เลือกใบสั่งขายอื่นด้านล่าง"}
            {refusal.kind === "custom" && (
              <>
                รับชำระที่ใบสั่งขาย Custom{" "}
                <Link href={refusal.href as string} className="ka-pr-link">
                  ไปที่ใบสั่งขาย
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ReceiptFormProps {
  mode: "create" | "edit";
  receipt?: PaymentReceipt;
  presetOrderId?: string | null;
}

/** The form of `/new` and `/[id]/edit`: one component and one hook, differing as `Edit` draws it (R21). */
export default function ReceiptForm({
  mode,
  receipt,
  presetOrderId,
}: ReceiptFormProps) {
  const form = useReceiptForm({ mode, receipt, presetOrderId });
  const editing = mode === "edit";
  const guard = useLeaveGuard(editing && form.dirty && !form.saving);
  const [saved, setSaved] = useState<PaymentReceipt | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const order = form.order;
  const code = receipt?.payment_receipt_code;

  usePageCrumb({
    back: { label: "ใบเสร็จรับเงิน", href: BASE },
    current: editing ? `${code ?? ""} / แก้ไข` : "สร้างใบเสร็จรับเงิน",
  });

  const blocked =
    form.saving ||
    form.over ||
    Boolean(form.amountError) ||
    form.fixes.length > 0;
  const noOrders =
    !editing &&
    form.optionsLoaded &&
    form.options.length === 0 &&
    !order &&
    !form.refusal;

  const save = async () => {
    const result = await form.submit();
    if (result) setSaved(result);
    else
      window.setTimeout(
        () => bannerRef.current?.scrollIntoView({ block: "center" }),
        0,
      );
  };

  const leaveHref =
    editing && receipt ? `${BASE}/${receipt.payment_receipt_id}` : BASE;
  const total = form.pay?.total ?? 0;
  const paid = editing ? form.paidElsewhere : (form.pay?.paid ?? 0);
  const percent = (value: number) =>
    total > 0 ? Math.min(100, Math.round((value / total) * 1000) / 10) : 0;
  const paidPercent = percent(paid);
  const thisPercent = Math.min(
    100 - paidPercent,
    percent(Math.min(form.amount, form.maximum)),
  );

  const preview = (() => {
    if (form.fixes.length > 0 && editing)
      return {
        tone: "danger",
        text: `แก้ ${form.fixes.length} ช่องก่อนบันทึก: ${form.fixes.join(" และ ")}`,
      };
    if (form.over)
      return { tone: "danger", text: "ยอดรับเกินยอดค้าง แก้ก่อนบันทึก" };
    if (!form.amount)
      return { tone: "neutral", text: "ยังไม่ได้ใส่ยอดรับชำระ" };
    if (form.after === 0)
      return {
        tone: "success",
        text: "หลังบันทึก ใบสั่งขายจะเป็น “ชำระครบแล้ว”",
      };
    return {
      tone: "warning",
      text: `หลังบันทึก ใบสั่งขายจะเป็น “ชำระบางส่วน” คงค้าง ${formatBaht(form.after ?? 0)}`,
    };
  })();

  const saveLabel = editing ? "บันทึกการแก้ไข" : "บันทึกใบเสร็จรับเงิน";
  const saveButton = (label: string, extra = "") => (
    <button
      type="button"
      className={`ka-pr-btn ka-pr-btn--a ${extra}`}
      aria-busy={form.saving || undefined}
      disabled={blocked}
      onClick={() => void save()}
    >
      {form.saving ? (
        <>
          <span className="ka-pr-spin" aria-hidden="true" />
          กำลังบันทึก…
        </>
      ) : (
        label
      )}
    </button>
  );

  const state = receipt ? receiptStatus(receipt) : null;
  const orderLine = order ? (
    editing ? (
      <>
        {receipt ? customerOf(receipt) : order.sale_order_name} · ยอดรวม{" "}
        {formatBaht(payable(order))} · ชำระแล้วจากใบอื่น{" "}
        {formatBaht(form.paidElsewhere)}
      </>
    ) : (
      <>
        {order.shipping_address_name || order.sale_order_name} · ยอดรวม{" "}
        {formatBaht(payable(order))} · ชำระแล้ว{" "}
        {formatBaht(paymentState(order).paid)}
      </>
    )
  ) : null;

  return (
    <form
      className="ka-pr"
      noValidate
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="ka-pr-ph">
        <div>
          {editing && (
            <div
              className="ka-pr-row ka-pr-row--8 ka-pr-row--wrap"
              style={{ marginBottom: 4 }}
            >
              <span className="ka-pr-code ka-pr-mut">{code}</span>
              {state && <Badge tone={state.tone}>{state.label}</Badge>}
              {form.dirty && (
                <span className="ka-pr-chg">มีการแก้ไขที่ยังไม่บันทึก</span>
              )}
            </div>
          )}
          <h1>{editing ? "แก้ไขใบเสร็จรับเงิน" : "สร้างใบเสร็จรับเงิน"}</h1>
          <p className="ka-pr-cap ka-pr-cap--14 ka-pr-p">
            {editing
              ? "เลขที่ใบเสร็จและใบสั่งขายเปลี่ยนไม่ได้"
              : "เลขที่ใบเสร็จออกให้อัตโนมัติเมื่อบันทึก"}
          </p>
        </div>
      </div>

      {form.saveError && (
        <div
          ref={bannerRef}
          className="ka-pr-banner"
          data-tone="danger"
          role="alert"
        >
          <Icon name="alert" />
          <div>
            <b>บันทึกไม่สำเร็จ</b> {form.saveError} ข้อมูลที่กรอกยังอยู่
            แก้ช่องที่มีเครื่องหมายแล้วบันทึกอีกครั้ง
          </div>
        </div>
      )}
      <LoadErrorBanner message={form.loadError} />

      <div className="ka-pr-grid">
        <div className="ka-pr-stack">
          <section className="ka-pr-card" aria-labelledby="ka-pr-f1">
            <div className="ka-pr-chd">
              <div>
                <h2 id="ka-pr-f1">ใบสั่งขาย</h2>
                {!editing && (
                  <div className="ka-pr-cap">
                    เลือกได้เฉพาะใบที่อนุมัติแล้วและยังค้างชำระ
                    ใบที่ยกเลิกไม่อยู่ในรายการ
                  </div>
                )}
              </div>
              {editing && (
                <span className="ka-pr-lock">
                  <Icon name="lock" small />
                  ย้ายไปใบสั่งขายอื่นไม่ได้
                </span>
              )}
            </div>
            {noOrders ? (
              <div className="ka-pr-empty ka-pr-empty--tight">
                <span className="ka-pr-tone ka-pr-etile" data-tone="info">
                  <Icon name="documentLines" size={26} />
                </span>
                <b>ไม่มีใบสั่งขายที่รับชำระได้</b>
                <span className="ka-pr-cap ka-pr-cap--14">
                  รับชำระได้เฉพาะใบที่อนุมัติแล้วและยังค้างชำระ
                </span>
                <Link className="ka-pr-btn" href={ORDERS}>
                  ไปที่ใบสั่งขาย
                </Link>
              </div>
            ) : (
              <div
                className="ka-pr-cp"
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {form.refusal && <RefusalBanner refusal={form.refusal} />}
                {!editing && (
                  <div className="ka-pr-f">
                    <label htmlFor="ka-pr-so">ใบสั่งขายที่รับชำระ</label>
                    <CustomSelect
                      id="ka-pr-so"
                      className="ka-pr-select"
                      placeholder="เลือกใบสั่งขาย"
                      value={order?.sale_order_id ?? ""}
                      disabled={form.saving}
                      fetchData={(term) => void form.search(term)}
                      aria-invalid={Boolean(form.orderError)}
                      aria-describedby={
                        form.orderError ? "ka-pr-so-e" : undefined
                      }
                      options={form.options.map((item) => ({
                        value: item.sale_order_id,
                        label: `${item.sale_order_code} · ${item.shipping_address_name || item.sale_order_name} · ค้าง ${formatBaht(paymentState(item).due)}`,
                      }))}
                      onChange={(id) => {
                        const next = form.options.find(
                          (item) => item.sale_order_id === id,
                        );
                        if (next) form.pick(next);
                      }}
                    />
                    {form.orderError && (
                      <span className="ka-pr-ferr" id="ka-pr-so-e">
                        {form.orderError}
                      </span>
                    )}
                  </div>
                )}
                {order && <OrderSummaryBox order={order} line={orderLine} />}
              </div>
            )}
          </section>

          <fieldset className="ka-pr-fieldset" disabled={form.saving}>
            <section className="ka-pr-card" aria-labelledby="ka-pr-f2">
              <div className="ka-pr-chd">
                <h2 id="ka-pr-f2">การรับชำระ</h2>
              </div>
              <div
                className="ka-pr-cp"
                style={{ display: "flex", flexDirection: "column", gap: 18 }}
              >
                <div className="ka-pr-f">
                  <span className="ka-pr-lbl" id="ka-pr-tyl">
                    ประเภทการชำระ
                  </span>
                  <RadioCards
                    labelledBy="ka-pr-tyl"
                    value={form.values.type}
                    options={TYPE_OPTIONS}
                    onChange={form.setType}
                  />
                </div>
                <div className="ka-pr-f">
                  <label htmlFor="ka-pr-amt">
                    ยอดรับชำระ {editing && <span className="ka-pr-req">*</span>}
                  </label>
                  <div
                    className="ka-pr-amt"
                    data-error={form.amountError ? "" : undefined}
                  >
                    <span>฿</span>
                    <input
                      id="ka-pr-amt"
                      inputMode="decimal"
                      autoComplete="off"
                      value={form.shownAmount}
                      readOnly={form.locked}
                      aria-invalid={Boolean(form.amountError)}
                      aria-describedby="ka-pr-amt-m"
                      onChange={(event) =>
                        form.set("amount", event.target.value)
                      }
                    />
                  </div>
                  <div className="ka-pr-row ka-pr-row--8 ka-pr-row--between">
                    {form.amountError ? (
                      <span className="ka-pr-ferr" id="ka-pr-amt-m">
                        {form.amountError}
                      </span>
                    ) : (
                      <span className="ka-pr-cap" id="ka-pr-amt-m">
                        {editing
                          ? `รับได้สูงสุด ${formatBaht(form.maximum)}`
                          : `ค้างชำระ ${formatBaht(form.pay?.due ?? 0)}`}
                      </span>
                    )}
                    <button
                      type="button"
                      className="ka-pr-fill"
                      disabled={!order || form.locked}
                      onClick={form.fill}
                    >
                      {editing ? "ใส่ยอดสูงสุด" : "ใส่ยอดค้างทั้งหมด"}
                    </button>
                  </div>
                </div>
                <div className="ka-pr-f">
                  <span className="ka-pr-lbl" id="ka-pr-mtl">
                    วิธีชำระ
                  </span>
                  <RadioCards
                    labelledBy="ka-pr-mtl"
                    two
                    value={form.values.method}
                    options={METHOD_OPTIONS}
                    onChange={form.setMethod}
                  />
                </div>
                <div className="ka-pr-g2">
                  {form.values.method === "bank" && (
                    <div className="ka-pr-f">
                      <label htmlFor="ka-pr-acc">
                        บัญชีที่รับเงิน{" "}
                        {editing && <span className="ka-pr-req">*</span>}
                      </label>
                      <CustomSelect
                        id="ka-pr-acc"
                        className="ka-pr-select"
                        placeholder="เลือกบัญชี"
                        value={form.values.account}
                        aria-invalid={Boolean(form.accountError)}
                        aria-describedby={
                          form.accountError ? "ka-pr-acc-e" : undefined
                        }
                        options={form.accounts.map((account) => ({
                          value: account.account_id,
                          label: `${account.bank_name} ·· ${String(account.account_number).replace(/\D/g, "").slice(-4)} · ${account.account_name}`,
                        }))}
                        onChange={(value) => form.set("account", value)}
                      />
                      {form.accountError && (
                        <span className="ka-pr-ferr" id="ka-pr-acc-e">
                          {form.accountError}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="ka-pr-f">
                    <label htmlFor="ka-pr-pd">
                      วันที่รับชำระ{" "}
                      {editing && <span className="ka-pr-req">*</span>}
                    </label>
                    <input
                      id="ka-pr-pd"
                      type="date"
                      className="ka-pr-in"
                      value={form.values.date}
                      aria-invalid={Boolean(form.dateError)}
                      aria-describedby="ka-pr-pd-m"
                      onChange={(event) => form.set("date", event.target.value)}
                    />
                    <span
                      className={form.dateError ? "ka-pr-ferr" : "ka-pr-cap"}
                      id="ka-pr-pd-m"
                    >
                      {form.dateError ??
                        (editing ? "ค่าเดิมของใบนี้" : "ค่าเริ่มต้นเป็นวันนี้")}
                    </span>
                  </div>
                </div>
                <div className="ka-pr-f">
                  <label htmlFor="ka-pr-rm">หมายเหตุ</label>
                  <textarea
                    id="ka-pr-rm"
                    className="ka-pr-in"
                    placeholder="เช่น เลขอ้างอิงการโอน (ไม่บังคับ)"
                    value={form.values.remark}
                    onChange={(event) => form.set("remark", event.target.value)}
                  />
                </div>
              </div>
            </section>
          </fieldset>
        </div>

        <div className="ka-pr-aside">
          <section className="ka-pr-card ka-pr-cp" aria-labelledby="ka-pr-fs">
            <h2 id="ka-pr-fs" style={{ marginBottom: 8 }}>
              {editing ? "สรุปการแก้ไข" : "สรุปการรับชำระ"}
            </h2>
            <div className="ka-pr-sumc__l">
              <span>ยอดใบสั่งขาย</span>
              <span className="ka-pr-num">{formatBaht(total)}</span>
            </div>
            {editing ? (
              <>
                <div className="ka-pr-sumc__l">
                  <span>ยอดเดิมของใบนี้</span>
                  <span
                    className="ka-pr-num ka-pr-mut"
                    style={{ textDecoration: "line-through" }}
                  >
                    {formatBaht(form.original)}
                  </span>
                </div>
                <div className="ka-pr-sumc__l">
                  <span>ยอดใหม่</span>
                  <span
                    className={`ka-pr-num${form.over ? " ka-pr-neg" : ""}`}
                    style={{ fontWeight: 600 }}
                  >
                    {formatBaht(form.amount)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="ka-pr-sumc__l">
                  <span>ชำระแล้ว</span>
                  <span className="ka-pr-num">{formatBaht(paid)}</span>
                </div>
                <div className="ka-pr-sumc__l">
                  <span>รับครั้งนี้</span>
                  <span
                    className="ka-pr-num ka-pr-link"
                    style={{ fontWeight: 600 }}
                  >
                    {formatBaht(form.amount)}
                  </span>
                </div>
              </>
            )}
            <div style={{ margin: "10px 0 2px" }}>
              <div
                className="ka-pr-meter"
                role="img"
                aria-label={`ชำระแล้วรวมครั้งนี้ ${Math.round(paidPercent + thisPercent)}%`}
              >
                <i style={{ width: `${paidPercent}%` }} />
                <i data-kind="new" style={{ width: `${thisPercent}%` }} />
              </div>
              {!editing && (
                <div className="ka-pr-legend">
                  <span>
                    <i style={{ background: "var(--success)" }} />
                    ชำระแล้ว
                  </span>
                  <span>
                    <i style={{ background: "var(--brand)" }} />
                    ครั้งนี้
                  </span>
                </div>
              )}
            </div>
            <div className="ka-pr-sumc__g">
              <span style={{ fontWeight: 600 }}>คงค้างหลังบันทึก</span>
              <span className="ka-pr-big">
                {form.after === null ? "—" : formatBaht(form.after)}
              </span>
            </div>
            <div
              className="ka-pr-prev ka-pr-tone"
              style={{ display: "flex" }}
              data-tone={preview.tone}
            >
              <Icon name="info" small />
              <span>{preview.text}</span>
            </div>
            <div className="ka-pr-fsave">
              {saveButton(saveLabel, "ka-pr-w100")}
              <button
                type="button"
                className="ka-pr-btn ka-pr-w100"
                disabled={form.saving}
                onClick={() => guard.leave(leaveHref)}
              >
                ยกเลิก
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="ka-pr-savebar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className={
              form.fixes.length > 0 && editing
                ? "ka-pr-cap ka-pr-neg"
                : "ka-pr-cap"
            }
          >
            {form.fixes.length > 0 && editing
              ? `แก้ ${form.fixes.length} ช่องก่อนบันทึก`
              : `คงค้างหลังบันทึก ${form.after === null ? "—" : formatBaht(form.after)}`}
          </div>
          <div className="ka-pr-num" style={{ fontWeight: 700, fontSize: 18 }}>
            {formatBaht(form.amount)}
          </div>
        </div>
        {saveButton(editing ? "บันทึกการแก้ไข" : "บันทึกใบเสร็จ")}
      </div>

      <ConfirmDialog
        isOpen={guard.asking}
        title="ออกจากหน้านี้?"
        message="เมื่อกดยกเลิกหรือย้อนกลับขณะมีการแก้ไข ระบบถามก่อนทิ้งข้อมูล"
        confirmLabel="ทิ้งการแก้ไข"
        cancelLabel="แก้ไขต่อ"
        onCancel={guard.stay}
        onConfirm={guard.confirm}
      />
      <ActionResultDialog
        isOpen={Boolean(saved)}
        status="success"
        action={editing ? "update" : "insert"}
        title={editing ? "บันทึกการแก้ไขแล้ว" : "บันทึกใบเสร็จแล้ว"}
        confirmText="ดูใบเสร็จ"
        className="ka-pr-res"
        body={
          <>
            <span className="ka-pr-res__title">
              {editing ? "บันทึกการแก้ไขแล้ว" : "บันทึกใบเสร็จแล้ว"}
            </span>
            <span className="ka-pr-code">{saved?.payment_receipt_code}</span> ·{" "}
            {formatBaht(Number(saved?.amount_paid ?? form.amount))}
            {"\n"}ใบสั่งขายเป็น “
            {form.after === 0 ? "ชำระครบแล้ว" : "ชำระบางส่วน"}”
          </>
        }
        onClose={() =>
          guard.replaceWith(`${BASE}/${saved?.payment_receipt_id}`)
        }
      />
    </form>
  );
}
