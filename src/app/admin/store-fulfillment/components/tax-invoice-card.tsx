'use client';
import { StoreTaxInvoiceRequest } from '@/types/store-fulfillment';
import { formatThaiDate } from '@/lib/date-format';
import StatusBadge from '@/components/StatusBadge';

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
    <section className="ka-sf-card ka-sf-card__pad">
      <div className="ka-sf-row ka-sf-row--wrap ka-sf-row--between">
        <h3>คำขอใบกำกับภาษีเต็มรูป</h3>
        <StatusBadge tone="info">{stageLabels[request.requestedStage]}</StatusBadge>
      </div>
      <dl className="ka-sf-dl ka-sf-dl--one">
        <div>
          <dt>ชื่อบุคคลหรือบริษัท</dt>
          <dd>{request.buyerName}</dd>
        </div>
        <div>
          <dt>ที่อยู่</dt>
          <dd className="whitespace-pre-line">
            {request.buyerAddress ?? '-'}
          </dd>
        </div>
        <div>
          <dt>เลขประจำตัวผู้เสียภาษี</dt>
          <dd className="ka-sf-code-text">{formatTaxId(request.buyerTaxId)}</dd>
        </div>
        <div>
          <dt>สำนักงานใหญ่/สาขา</dt>
          <dd>{branchLabel(request)}</dd>
        </div>
        <div>
          <dt>วันที่ขอ</dt>
          <dd>{formatThaiDate(request.requestedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
