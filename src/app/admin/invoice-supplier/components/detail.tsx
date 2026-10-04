'use client';

import Modal from '@/components/Modal';
import { formatThaiDate } from '@/lib/date-format';
import { VAT_TYPE_LABELS } from '@/lib/vat';
import {
  InvoiceSupplierRow,
  INVOICE_PAYMENT_METHOD_LABELS,
  INVOICE_STATUS_LABELS,
} from '@/types/invoice-supplier';
import { INVOICE_SUPPLIER_STATUS_TONE } from '@/lib/status-tones';
import StatusBadge from '@/components/StatusBadge';

interface InvoiceSupplierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceSupplierRow | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (value?: Date | string) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return formatThaiDate(date);
};

export default function InvoiceSupplierDetailModal({ isOpen, onClose, invoice }: InvoiceSupplierDetailModalProps) {
  if (!isOpen || !invoice) {
    return null;
  }

  const invoicePayments = invoice.invoicePayments || [];
  const availablePayments = invoice.availablePayments || [];
  const purchaseReceiptCode =
    invoice.purchase_receipt_code || invoice.purchaseReceipt?.purchase_receipt_code || '-';
  const supplierName = invoice.supplier_name || invoice.supplier?.supplier_name || '-';
  const vatType = invoice.vat_type || 'none';
  const paidTotal = invoicePayments.reduce((sum, item) => sum + Number(item.invoice_payment_price || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="รายละเอียดใบชำระหนี้ผู้จัดจำหน่าย"
      description="แสดงข้อมูลตามโครง invoice_supplier และ invoice_payment"
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="ka-btn h-11">
            ปิด
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">เลขที่ใบชำระหนี้</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              {invoice.invoice_supplier_code}
            </div>
          </div>
          {invoice.legacy_code && (
            <div>
              <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">เลขเดิม</p>
              <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
                {invoice.legacy_code}
              </div>
            </div>
          )}
          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">ชื่อเอกสาร</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              {invoice.invoice_supplier_name}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">สถานะ</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              <StatusBadge tone={INVOICE_SUPPLIER_STATUS_TONE[invoice.invoice_supplier_status]}>{INVOICE_STATUS_LABELS[invoice.invoice_supplier_status]}</StatusBadge>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">วันที่เอกสาร</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              {formatDate(invoice.invoice_supplier_date)}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">ครบกำหนด</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              {formatDate(invoice.invoice_supplier_due_date)}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">VAT</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              {VAT_TYPE_LABELS[vatType]}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">ใบรับสินค้าอ้างอิง</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              {purchaseReceiptCode}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Supplier</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              {supplierName}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">ยอดใบชำระหนี้</p>
            <div className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm leading-[44px] text-[var(--ink)]">
              ฿{formatCurrency(invoice.invoice_supplier_total)}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">รายละเอียดเพิ่มเติม</p>
          <div className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--ink)]">
            {invoice.invoice_supplier_detail || '-'}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h3 className="mb-3 text-base font-semibold text-[var(--ink)]">รายการชำระเงิน (invoice_payment)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                  <th className="px-3 py-2 text-left font-semibold text-[var(--ink)]">วิธีชำระ</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--ink)]">ธนาคาร/บัญชี</th>
                  <th className="px-3 py-2 text-right font-semibold text-[var(--ink)]">ยอดชำระ</th>
                </tr>
              </thead>
              <tbody>
                {invoicePayments.map((item) => {
                  const bank = availablePayments.find((payment) => payment.payment_id === item.payment_id);
                  return (
                    <tr key={item.invoice_payment_id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2 text-[var(--ink)]">{INVOICE_PAYMENT_METHOD_LABELS[item.payment_method]}</td>
                      <td className="px-3 py-2 text-[var(--ink)]">
                        {item.payment_method === 'cash'
                          ? 'เงินสด'
                          : bank
                            ? `${bank.bank_name} - ${bank.account_number} (${bank.account_name})`
                            : 'ไม่พบบัญชีธนาคาร'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[var(--success)]">฿{formatCurrency(item.invoice_payment_price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 text-[var(--color-text-primary)]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[13px] text-[var(--color-text-secondary)]">ยอดเอกสาร</p>
              <p className="text-lg font-semibold">฿{formatCurrency(invoice.invoice_supplier_total)}</p>
            </div>
            <div>
              <p className="text-[13px] text-[var(--color-text-secondary)]">ชำระแล้ว</p>
              <p className="text-lg font-semibold">฿{formatCurrency(paidTotal)}</p>
            </div>
            <div>
              <p className="text-[13px] text-[var(--color-text-secondary)]">คงเหลือ</p>
              <p className="text-xl font-bold">฿{formatCurrency(Math.max(invoice.invoice_supplier_total - paidTotal, 0))}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
