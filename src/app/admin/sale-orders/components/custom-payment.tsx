"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "@/lib/axios";
import { usePermissions } from "@/hooks/usePermissions";
import type { BankAccount } from "@/types/bank-account";

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
                  <select
                    className="ka-input w-full"
                    required
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  >
                    <option value="">เลือกบัญชีรับเงิน</option>
                    {accounts.map((a) => (
                      <option key={a.account_id} value={a.account_id}>
                        {a.bank_name} · {a.account_number} · {a.account_name}
                      </option>
                    ))}
                  </select>
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
        </>
      )}
    </section>
  );
}
