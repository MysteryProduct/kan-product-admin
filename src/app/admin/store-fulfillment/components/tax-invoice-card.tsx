'use client';
import { StoreTaxInvoiceRequest } from '@/types/store-fulfillment';
import { formatThaiDate } from '@/lib/date-format';

const stageLabels: Record<StoreTaxInvoiceRequest['requestedStage'], string> = {
  checkout: 'ขอพร้อมคำสั่งซื้อ',
  after_payment: 'ขอย้อนหลังหลังชำระเงิน',
};

// 13 digits as the Revenue Department writes them: 1-2345-67890-12-3.
function formatTaxId(taxId: string): string {
  return /^\d{13}$/.test(taxId)
    ? `${taxId[0]}-${taxId.slice(1, 5)}-${taxId.slice(5, 10)}-${taxId.slice(10, 12)}-${taxId[12]}`
    : taxId;
}

export function branchLabel(request: StoreTaxInvoiceRequest): string {
  return request.branchType === 'head_office'
    ? 'สำนักงานใหญ่'
    : `สาขา ${request.branchCode ?? ''}`.trim();
}

/**
 * TASK-0038: what the customer asked to be printed on a full tax invoice.
 * Staff issue the document themselves in the MVP; this card is the source
 * they copy from, so every field is shown in full and can be selected.
 */
export default function TaxInvoiceCard({
  request,
}: {
  request: StoreTaxInvoiceRequest;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">คำขอใบกำกับภาษีเต็มรูป</h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
          {stageLabels[request.requestedStage]}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[var(--color-text-secondary)]">ชื่อบุคคลหรือบริษัท</dt>
          <dd className="break-words font-medium">{request.buyerName}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--color-text-secondary)]">ที่อยู่</dt>
          <dd className="whitespace-pre-line break-words">
            {request.buyerAddress ?? '-'}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">เลขประจำตัวผู้เสียภาษี</dt>
          <dd className="font-mono">{formatTaxId(request.buyerTaxId)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">สำนักงานใหญ่/สาขา</dt>
          <dd>{branchLabel(request)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">วันที่ขอ</dt>
          <dd>{formatThaiDate(request.requestedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}
