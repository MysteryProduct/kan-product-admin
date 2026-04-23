'use client';

import { formatThaiDate } from '@/lib/date-format';
import { VAT_TYPE_LABELS } from '@/lib/vat';
import {
  InvoiceSupplierRow,
  INVOICE_PAYMENT_METHOD_LABELS,
  INVOICE_STATUS_BADGE,
  INVOICE_STATUS_LABELS,
} from '@/types/invoice-supplier';

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
    invoice.purchase_receipt_code || invoice.purchaseReceipt?.purchase_receipt_code || invoice.purchaseReceipt?.purchase_receipt_id || '-';
  const supplierName = invoice.supplier_name || invoice.supplier?.supplier_name || '-';
  const vatType = invoice.vat_type || 'none';
  const paidTotal = invoicePayments.reduce((sum, item) => sum + Number(item.invoice_payment_price || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">รายละเอียดใบชำระหนี้ผู้จัดจำหน่าย</h2>
              <p className="text-sm text-emerald-50">แสดงข้อมูลตามโครง invoice_supplier และ invoice_payment</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 transition hover:bg-white/20" aria-label="close">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">เลขที่ใบชำระหนี้</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {invoice.invoice_supplier_code}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">ชื่อเอกสาร</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {invoice.invoice_supplier_name}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">สถานะ</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_BADGE[invoice.invoice_supplier_status]}`}>
                  {INVOICE_STATUS_LABELS[invoice.invoice_supplier_status]}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">วันที่เอกสาร</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {formatDate(invoice.invoice_supplier_date)}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">ครบกำหนด</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {formatDate(invoice.invoice_supplier_due_date)}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">VAT</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {VAT_TYPE_LABELS[vatType]}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">ใบรับสินค้าอ้างอิง</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {purchaseReceiptCode}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Supplier</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {supplierName}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">ยอดใบชำระหนี้</p>
              <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm leading-[44px] text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                ฿{formatCurrency(invoice.invoice_supplier_total)}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">รายละเอียดเพิ่มเติม</p>
            <div className="min-h-[44px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
              {invoice.invoice_supplier_detail || '-'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">รายการชำระเงิน (invoice_payment)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700/40">
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-100">วิธีชำระ</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-100">ธนาคาร/บัญชี</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-100">ยอดชำระ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicePayments.map((item) => {
                    const bank = availablePayments.find((payment) => payment.payment_id === item.payment_id);
                    return (
                      <tr key={item.invoice_payment_id} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{INVOICE_PAYMENT_METHOD_LABELS[item.payment_method]}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                          {item.payment_method === 'cash'
                            ? 'เงินสด'
                            : bank
                              ? `${bank.bank_name} - ${bank.account_number} (${bank.account_name})`
                              : 'ไม่พบบัญชีธนาคาร'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-300">฿{formatCurrency(item.invoice_payment_price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-lg">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <p className="text-xs text-emerald-50">ยอดเอกสาร</p>
                <p className="text-lg font-semibold">฿{formatCurrency(invoice.invoice_supplier_total)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-50">ชำระแล้ว</p>
                <p className="text-lg font-semibold">฿{formatCurrency(paidTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-50">คงเหลือ</p>
                <p className="text-xl font-bold">฿{formatCurrency(Math.max(invoice.invoice_supplier_total - paidTotal, 0))}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
