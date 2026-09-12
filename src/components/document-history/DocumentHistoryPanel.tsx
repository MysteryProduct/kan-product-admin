'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import axiosInstance from '@/lib/axios';
import { formatThaiDateTime } from '@/lib/date-format';

type Entry = {
  document_history_id: string;
  action: string;
  actor_name: string;
  actor_id: string;
  supplier_names: Record<string, string>;
  purchase_order_codes: Record<string, string>;
  material_names: Record<string, string>;
  product_unit_names: Record<string, string>;
  reason: string | null;
  previous_value: Record<string, unknown> | null;
  next_value: Record<string, unknown> | null;
  created_at: string;
};

type HistoryItem = {
  material_id?: string;
  product_name?: string;
  product_variant_id?: string;
  sale_order_list_id?: string;
  product_unit_id?: number;
  quantity?: number;
  status?: string;
};

type HistoryResponse = {
  data: Entry[];
  meta: { page: number; last_page: number };
};

const actions: Record<string, string> = { created: 'สร้างเอกสาร', updated: 'แก้ไขเอกสาร', approved: 'อนุมัติ', rejected: 'ปฏิเสธ', cancelled: 'ยกเลิก', returned: 'คืนสินค้า', refund_created: 'สร้างรายการคืนเงิน', status_changed: 'เปลี่ยนสถานะ', deleted: 'ลบเอกสาร' };
const statuses: Record<string, string> = { pending: 'รออนุมัติ', active: 'ใช้งานอยู่', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธ', inactive: 'ยกเลิก', cancelled: 'ยกเลิก', partial: 'รับสินค้าบางส่วน', paid: 'ชำระแล้ว', refunded: 'คืนเงินแล้ว', partially_returned: 'คืนสินค้าบางส่วน', returned: 'คืนสินค้าแล้ว', in_progress: 'กำลังผลิต', completed: 'ผลิตเสร็จแล้ว' };
const labels: Record<string, string> = { purchase_order_name: 'ชื่อใบสั่งซื้อ', purchase_order_detail: 'รายละเอียด', purchase_order_status: 'สถานะใบสั่งซื้อ', purchase_receipt_detail: 'รายละเอียด', purchase_receipt_status: 'สถานะใบรับสินค้า', supplier_id: 'ผู้จัดจำหน่าย', purchase_order_id: 'ใบสั่งซื้ออ้างอิง', entry_date: 'วันที่รับสินค้า', tax_invoice_number: 'เลขที่ใบกำกับภาษี', tax_invoice_date: 'วันที่ใบกำกับภาษี', vat_type: 'รูปแบบ VAT', vat_rate: 'อัตรา VAT', sale_order_status: 'สถานะใบขาย', sale_order_type: 'ประเภทใบขาย', payment_receipt_type: 'ประเภทรายการรับชำระ', payment_status: 'สถานะการชำระ', job_order_status: 'สถานะงานผลิต', job_order_qty: 'จำนวนผลิต', job_order_defect_qty: 'จำนวนเสีย', employee_id: 'ผู้รับผิดชอบ' };

function displayValue(value: unknown, key: string, suppliers: Record<string, string>, codes: Record<string, string>) {
  if (value === null || value === undefined || value === '') return '-';
  if (key === 'supplier_id') return suppliers[String(value)] ?? String(value);
  if (key === 'purchase_order_id') return codes[String(value)] ?? String(value);
  if (key.includes('_status')) return statuses[String(value)] ?? String(value);
  if (key === 'vat_type') return ({ none: 'ไม่มี VAT', include: 'รวม VAT', exclude: 'แยก VAT' }[String(value)] ?? String(value));
  if (key === 'entry_date' || key === 'tax_invoice_date') return formatThaiDateTime(String(value));
  return String(value);
}

function changes(entry: Entry) {
  const before = entry.previous_value ?? {};
  const after = entry.next_value ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]) && labels[key])
    .map((key) => ({
      label: labels[key],
      before: displayValue(before[key], key, entry.supplier_names ?? {}, entry.purchase_order_codes ?? {}),
      after: displayValue(after[key], key, entry.supplier_names ?? {}, entry.purchase_order_codes ?? {}),
    }))
    .filter((change) => change.before !== '-' || change.after !== '-');
}

function historyItems(value: Record<string, unknown> | null): HistoryItem[] {
  return Array.isArray(value?.items) ? value.items as HistoryItem[] : [];
}

function itemText(item: HistoryItem, entry: Entry) {
  const material = item.product_name ?? entry.material_names?.[item.material_id ?? ''] ?? item.product_variant_id ?? item.material_id ?? 'ไม่ทราบรายการ';
  const unit = entry.product_unit_names?.[String(item.product_unit_id)] ?? item.product_unit_id ?? '-';
  const status = item.status ? statuses[item.status] ?? item.status : null;
  return `${material} · ${item.quantity ?? '-'} ${unit}${status ? ` · ${status}` : ''}`;
}

export default function DocumentHistoryPanel({ endpoint }: { endpoint: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const loadHistory = async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get<HistoryResponse>(endpoint, {
        params: { page: nextPage, limit: 20 },
      });
      setEntries((current) => nextPage === 1
        ? response.data.data ?? []
        : [...current, ...(response.data.data ?? [])]);
      setPage(response.data.meta?.page ?? nextPage);
      setLastPage(response.data.meta?.last_page ?? nextPage);
    } catch {
      setError('ไม่สามารถโหลดประวัติการเปลี่ยนแปลงได้');
    } finally {
      setLoading(false);
    }
  };

  const openHistory = () => {
    setOpen(true);
    void loadHistory(1);
  };

  return (
    <>
      <div className="mt-6 border-t border-[var(--color-border)] pt-6">
        <button type="button" onClick={openHistory} className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-4 text-left hover:border-[var(--color-primary)]">
          <span>
            <strong className="block text-sm font-semibold text-[var(--color-text-primary)]">ประวัติการเปลี่ยนแปลง</strong>
            <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">ดูผู้ดำเนินการ วันเวลา และรายละเอียดทั้งหมด</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-[var(--color-primary)]">ดูประวัติ</span>
        </button>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="ประวัติการเปลี่ยนแปลง" description="รายการล่าสุดแสดงก่อน และไม่แสดงราคา/ต้นทุน" size="lg" layer="elevated">
        {loading && <p role="status" className="py-10 text-center text-sm text-[var(--color-text-secondary)]">กำลังโหลดประวัติ…</p>}
        {error && <p role="alert" className="rounded-lg border border-[var(--color-error)] bg-[var(--color-bg-secondary)] p-4 text-[var(--color-error)]">{error}</p>}
        {!loading && !error && entries.length === 0 && <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">ยังไม่มีประวัติการเปลี่ยนแปลง</p>}
        <ol className="space-y-3">
          {entries.map((entry) => {
            const entryChanges = changes(entry);
            const previousItems = historyItems(entry.previous_value);
            const nextItems = historyItems(entry.next_value);
            const itemsChanged = JSON.stringify(previousItems) !== JSON.stringify(nextItems);
            return (
              <li key={entry.document_history_id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <strong className="text-sm text-[var(--color-primary)]">{actions[entry.action] ?? entry.action}</strong>
                  <time className="numeric text-sm text-[var(--color-text-secondary)]">{formatThaiDateTime(entry.created_at)}</time>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p><span className="text-[var(--color-text-secondary)]">ผู้ดำเนินการ</span><br /><strong>{entry.actor_name ?? entry.actor_id}</strong></p>
                  {entry.reason && <p><span className="text-[var(--color-text-secondary)]">เหตุผล</span><br />{entry.reason}</p>}
                </div>
                {entryChanges.length > 0 && (
                  <dl className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-3 text-sm">
                    {entryChanges.map((change) => (
                      <div key={change.label} className="grid gap-1 sm:grid-cols-[150px_1fr]">
                        <dt className="font-medium text-[var(--color-text-secondary)]">{change.label}</dt>
                        <dd className="break-words">
                          <span className="text-[var(--color-text-secondary)]">{change.before}</span>
                          <span className="mx-2 text-[var(--color-primary)]" aria-hidden="true">→</span>
                          <strong>{change.after}</strong>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {itemsChanged && (
                  <div className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-3 text-sm sm:grid-cols-2">
                    <section aria-label="รายการเดิม">
                      <strong className="text-[var(--color-text-secondary)]">รายการเดิม</strong>
                      {previousItems.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {previousItems.map((item, index) => <li key={`${item.material_id}-${index}`}>{itemText(item, entry)}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-[var(--color-text-secondary)]">ไม่มีรายการ</p>}
                    </section>
                    <section aria-label="รายการใหม่">
                      <strong className="text-[var(--color-text-primary)]">รายการใหม่</strong>
                      {nextItems.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {nextItems.map((item, index) => <li key={`${item.material_id}-${index}`}>{itemText(item, entry)}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-[var(--color-text-secondary)]">ไม่มีรายการ</p>}
                    </section>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {!error && entries.length > 0 && page < lastPage && (
          <button
            type="button"
            onClick={() => void loadHistory(page + 1)}
            disabled={loading}
            className="mt-4 w-full rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'กำลังโหลด…' : 'โหลดประวัติเพิ่มเติม'}
          </button>
        )}
      </Modal>
    </>
  );
}
