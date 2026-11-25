"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import axios from "@/lib/axios";
import { refreshPendingWork } from "@/hooks/usePendingWork";
import { usePermissions } from "@/hooks/usePermissions";
import type { BankAccount } from "@/types/bank-account";
import CustomSelect from '@/components/CustomSelect';

type Info = {
  code: string;
  status: string;
  depositRequired: number;
  depositPaid: boolean;
  outstanding: number;
  jobOrderId: string | null;
  storeOrderId: string | null;
  receivingAccount: BankAccount | null;
};

// The request statuses that come before production is finished.
const BEFORE_PRODUCED = [
  "awaiting_deposit",
  "awaiting_line_files",
  "reviewing",
  "needs_changes",
  "approved_for_production",
  "in_production",
];
const PRODUCED = ["produced", "awaiting_balance"];

export default function CustomPayment({
  orderId,
  status,
  onSuccess,
}: {
  orderId: string;
  status: string;
  onSuccess?: () => void;
}) {
  const { can } = usePermissions();
  const allowed =
    can("sale_orders", "approve") && can("payment_receipts", "add");
  const canSend = can("store_fulfillment", "add");
  const [info, setInfo] = useState<Info | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);
  // Retried submissions keep their reference, including a timeout after commit.
  const attempt = useRef<{ payload: string; reference: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  // A second click lands before the disabled button is drawn.
  const sendingNow = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setError("");
        const response = await axios.get<Info>(`/sale-order/${orderId}/custom`);
        if (!active) return;
        setInfo(response.data);
        setAccounts(
          response.data.receivingAccount
            ? [response.data.receivingAccount]
            : [],
        );
        setAccount(response.data.receivingAccount?.account_id ?? "");
        setAmount(
          String(
            response.data.depositPaid
              ? response.data.outstanding
              : response.data.depositRequired,
          ),
        );
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "โหลดข้อมูล Custom ไม่สำเร็จ",
          );
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [orderId, allowed, reload]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!info || pending) return;
    const payload = {
      kind: info.depositPaid ? "balance" : "deposit",
      amount: Number(amount),
      account_id: account,
    };
    const canonical = JSON.stringify(payload);
    if (!attempt.current || attempt.current.payload !== canonical) {
      attempt.current = { payload: canonical, reference: crypto.randomUUID() };
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await axios.post<Info>(
        `/sale-order/${orderId}/custom-payments`,
        {
          ...payload,
          reference: attempt.current.reference,
        },
      );
      setInfo(response.data);
      setAmount(String(response.data.outstanding));
      setMessage("บันทึกรับชำระแล้ว ใบเสร็จอยู่ในหน้าใบเสร็จรับเงิน");
      attempt.current = null;
      onSuccess?.();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "บันทึกไม่สำเร็จ กรุณาลองใหม่ด้วยรายการเดิม",
      );
    } finally {
      setPending(false);
    }
  }

  // Opens the order in the parcel page. The API answers the same for a repeat.
  async function sendToFulfillment() {
    if (!info || sendingNow.current) return;
    sendingNow.current = true;
    setSending(true);
    setSendError("");
    try {
      const response = await axios.post<{ storeOrderId: string }>(
        `/fulfillment/custom/${orderId}/ready`,
      );
      const { storeOrderId } = response.data;
      setInfo((current) => (current ? { ...current, storeOrderId } : current));
      // The request's status changed with it; the order joined the to-ship queue.
      setReload((n) => n + 1);
      refreshPendingWork();
      onSuccess?.();
    } catch (e) {
      const refused =
        isAxiosError<{ message?: unknown }>(e) &&
        !!e.response &&
        (e.response.status === 401 ||
          e.response.status === 403 ||
          !!e.response.data?.message);
      setSendError(
        refused && e.message
          ? e.message
          : "ส่งเข้าหน้าจัดส่งไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      sendingNow.current = false;
      setSending(false);
    }
  }

  const sent = !!info?.storeOrderId;
  const produced = !!info && PRODUCED.includes(info.status);
  const open = !!info && !sent && status !== "cancelled";
  const readyToSend = open && produced && info.outstanding <= 0;

  return (
    <section
      className="mb-6 space-y-4"
      aria-labelledby="custom-payment-heading"
    >
      <h2 id="custom-payment-heading" className="text-lg font-semibold">
        คำขอผลิต Custom
      </h2>
      {!info && !error && <p role="status">กำลังโหลดข้อมูลคำขอ…</p>}
      {error && (
        <div role="alert">
          <p className="text-[var(--danger)]">{error}</p>
          {!info && (
            <button
              type="button"
              className="ka-btn"
              onClick={() => setReload((n) => n + 1)}
            >
              โหลดใหม่
            </button>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {info && (
        <>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt>รหัสคำขอ</dt>
              <dd className="font-semibold break-words">{info.code}</dd>
            </div>
            <div>
              <dt>มัดจำ 20%</dt>
              <dd>
                {info.depositRequired.toFixed(2)} บาท ·{" "}
                {info.depositPaid ? "รับแล้ว" : "รอมัดจำ"}
              </dd>
            </div>
            <div>
              <dt>ยอดคงเหลือ</dt>
              <dd>{info.outstanding.toFixed(2)} บาท</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-4">
            {info.jobOrderId && (
              <Link
                className="underline"
                href={`/admin/job-orders?jobId=${encodeURIComponent(info.jobOrderId)}`}
              >
                ดูงานผลิต
              </Link>
            )}
            {info.storeOrderId && (
              <Link
                className="underline"
                href={`/admin/store-fulfillment?orderId=${encodeURIComponent(info.storeOrderId)}`}
              >
                ดูพัสดุ
              </Link>
            )}
            <Link className="underline" href="/admin/payment-receipts">
              ดูใบเสร็จรับเงิน
            </Link>
          </div>
          {info.depositPaid &&
            info.outstanding > 0 &&
            !["produced", "awaiting_balance"].includes(info.status) && (
              <p>บันทึกรับยอดคงเหลือได้หลังผลิตเสร็จแล้ว</p>
            )}
          {open && BEFORE_PRODUCED.includes(info.status) && (
            <p className="text-sm text-[var(--ink-muted)]">
              ส่งเข้าหน้าจัดส่งได้เมื่อผลิตเสร็จและชำระครบแล้ว
            </p>
          )}
          {allowed &&
            info.outstanding > 0 &&
            status !== "cancelled" &&
            (!info.depositPaid ||
              ["produced", "awaiting_balance"].includes(info.status)) && (
              <form className="space-y-3" onSubmit={submit}>
                {!accounts.length && (
                  <p role="status">
                    ร้านยังไม่ได้ตั้งบัญชีรับเงิน กรุณาตรวจการตั้งค่าก่อนบันทึก
                  </p>
                )}
                <p>
                  ตรวจสอบเงินโอนเข้าบัญชีก่อนบันทึก
                  {info.depositPaid ? "ยอดคงเหลือ" : "มัดจำ"}
                </p>
                <label className="block">
                  ยอดรับชำระ (บาท)
                  <input
                    className="ka-input w-full"
                    type="number"
                    min="0.01"
                    max={info.outstanding}
                    step="0.01"
                    required
                    value={amount}
                    readOnly={!info.depositPaid}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="block">
                  บัญชีรับเงิน
                  <CustomSelect
                    value={account}
                    onChange={(value) => setAccount(value)}
                    options={accounts.map((a) => ({ value: a.account_id, label: `${a.bank_name}· ${a.account_number}· ${a.account_name}` }))}
                    placeholder="เลือกบัญชีรับเงิน"
                    required
                  />
                </label>
                <button
                  className="ka-btn ka-btn--primary"
                  type="submit"
                  disabled={pending || accounts.length === 0}
                >
                  {pending
                    ? "กำลังบันทึก…"
                    : info.depositPaid
                      ? "บันทึกรับยอดคงเหลือ"
                      : "บันทึกรับมัดจำ 20%"}
                </button>
              </form>
            )}
          {open && produced && info.outstanding > 0 && (
            <p className="text-sm text-[var(--ink-muted)]">
              ชำระยอดคงเหลือให้ครบก่อน จึงส่งเข้าหน้าจัดส่งได้
            </p>
          )}
          {readyToSend && <p role="status">ชำระครบและผลิตเสร็จแล้ว</p>}
          {readyToSend && canSend && (
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                className="ka-btn ka-btn--primary"
                disabled={sending}
                aria-busy={sending || undefined}
                onClick={() => void sendToFulfillment()}
              >
                {sending ? "กำลังส่งเข้าหน้าจัดส่ง…" : "ส่งเข้าหน้าจัดส่ง"}
              </button>
              {sendError ? (
                <p role="alert" className="text-[var(--danger)]">
                  {sendError}
                </p>
              ) : (
                <p className="text-sm text-[var(--ink-muted)]">
                  ระบบจะเปิดคำสั่งซื้อนี้ในหน้าจัดส่งพัสดุ โดยใช้ชื่อ ที่อยู่
                  และเบอร์ผู้รับจากคำขอ
                </p>
              )}
            </div>
          )}
          {readyToSend && !canSend && (
            <p className="text-sm text-[var(--ink-muted)]">
              ต้องมีสิทธิ์เพิ่มในเมนูจัดส่งพัสดุจึงจะส่งเข้าหน้าจัดส่งได้
            </p>
          )}
          {sent && (
            <p className="ka-so-ok" role="status">
              ส่งเข้าหน้าจัดส่งแล้ว
            </p>
          )}
        </>
      )}
    </section>
  );
}
