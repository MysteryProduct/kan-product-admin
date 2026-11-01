'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import axiosInstance from '@/lib/axios';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import type { PurchaseOrder } from '@/types/purchase-order';
import { usePermissions } from '@/hooks/usePermissions';
import useVatRate from '@/hooks/useVatRate';
import { usePageCrumb } from '@/lib/page-crumb';
import { formatThaiDate } from '@/lib/date-format';
import { getApiErrorMessage } from '@/lib/api-error';
import CancellationDialog from '@/components/CancellationDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import DocumentCode from '@/components/DocumentCode';
import RowMenu, { RowMenuItem } from '@/components/RowMenu';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import DocumentHistoryPanel, { DocumentHistoryEntry } from '@/components/document-history/DocumentHistoryPanel';
import { formatBaht, formatMoney, orderLines, statusLabel } from '../../purchase-orders/lib/po-display';
import {
  orderProgress,
  Receipt,
  receiptLines,
  receiptLineTotal,
  receiptQuantityText,
  receiptStatusLabel,
  receiptStatusTone,
  receiptVatRate,
  receiptVatSummary,
  vatTypeText,
} from '../lib/pr-display';

const purchaseReceiptModel = new PurchaseReceiptModel();
const BASE = '/admin/purchase-receipt';
const NO_UNITS = new Map<number, string>();

interface Props {
  receipt: Receipt;
  /** The order it was received against, for its progress and status; null if it could not load. */
  order: PurchaseOrder | null;
  /** Reloads the receipt after it was approved or cancelled. */
  onChanged: () => void;
}

const PrintIcon = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 9V3h10v6M7 17H5v-6h14v6h-2M7 14h10v7H7z" />
  </svg>
);

export default function ReceiptDetail({ receipt, order, onChanged }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const settingsRate = useVatRate();
  const { can } = usePermissions();
  const canApprove = can('purchase_receipt', 'approve');
  const canEdit = can('purchase_receipt', 'edit');
  const canDelete = can('purchase_receipt', 'delete');
  const canReject = can('purchase_receipt', 'reject');

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'delete' | null>(null);
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [historyKey, setHistoryKey] = useState(0);

  const id = receipt.purchase_receipt_id;
  const code = receipt.purchase_receipt_code ?? '';
  const status = receipt.purchase_receipt_status;
  const poCode = receipt.purchaseOrder?.purchase_order_code ?? order?.purchase_order_code ?? '';
  usePageCrumb({ back: { label: 'ใบรับสินค้า', href: BASE }, current: code || 'ใบรับสินค้า' });

  const lines = receiptLines(receipt);
  const vatRate = receiptVatRate(receipt, settingsRate);
  const vat = receiptVatSummary(receipt, settingsRate);
  const supplierName = receipt.supplier?.supplier_name ?? order?.supplier?.supplier_name ?? '-';
  const qtyText = receiptQuantityText(receipt, NO_UNITS);
  const progress = order ? orderProgress(orderLines(order), NO_UNITS) : null;
  const cancelEntry = history.find((entry) => entry.action === 'rejected' || entry.action === 'cancelled');

  // Print on paper colours: the dark theme is lifted while the browser prints (button or Ctrl+P).
  useEffect(() => {
    const html = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = html.classList.contains('dark');
      if (wasDark) html.classList.remove('dark');
    };
    const after = () => {
      if (wasDark) html.classList.add('dark');
      wasDark = false;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  // "พิมพ์" in the list's row menu opens this page with ?print=1. The print waits for the page to settle,
  // and removing the parameter re-runs this effect, so the timer is not tied to it; it
  // prints only if the page is still open (TASK-0325 review F2).
  const printed = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (params?.get('print') !== '1' || printed.current) return;
    printed.current = true;
    window.setTimeout(() => {
      if (mounted.current) window.print();
    }, 300);
    router.replace(`${BASE}/${id}`, { scroll: false });
  }, [params, router, id]);

  const changed = () => {
    setHistoryKey((key) => key + 1);
    onChanged();
  };

  const approve = async () => {
    setConfirmApprove(false);
    setBusy('approve');
    try {
      const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      await purchaseReceiptModel.approvePurchaseReceipt(id, user.employee_id);
      toast({ message: `อนุมัติใบรับสินค้า ${code} แล้ว สต็อกเพิ่ม ${qtyText}`, tone: 'success' });
      changed();
    } catch (error) {
      toast({ message: `อนุมัติ ${code} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setBusy('delete');
    try {
      await purchaseReceiptModel.deletePurchaseReceipt(id);
      toast({ message: `ลบใบรับสินค้า ${code} แล้ว`, tone: 'success' });
      router.push(BASE);
    } catch (error) {
      toast({ message: `ลบ ${code} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
      setBusy(null);
    }
  };

  const print = () => window.print();

  const more: RowMenuItem[] = [];
  if (status === 'pending') more.push({ label: 'พิมพ์', onSelect: print });
  if (status === 'pending' && canDelete) more.push({ label: 'ลบ', icon: 'delete', tone: 'danger', onSelect: () => setConfirmDelete(true) });
  if ((status === 'pending' || status === 'approved') && canReject) {
    more.push({ label: 'ยกเลิกเอกสาร', icon: 'cancel', tone: 'danger', onSelect: () => setRejecting(true) });
  }

  const title = receipt.purchase_receipt_detail?.trim() || (poCode ? `รับจาก ${poCode}` : 'ใบรับสินค้า');
  const cancelEffect =
    status === 'approved'
      ? `คืนยอดคงเหลือ ${qtyText} ให้ใบสั่งซื้อ ${poCode} และดึงสต็อกที่เพิ่มไว้คืน`
      : `คืนยอดคงเหลือ ${qtyText} ให้ใบสั่งซื้อ ${poCode}`;

  return (
    <div className="ka-page-body ka-po ka-pr ka-po-print">
      <div className="ka-po-ph">
        <div className="ka-po-ph__main">
          <div className="ka-po-idrow">
            <span className="ka-po-code ka-po-code--muted"><DocumentCode code={code} /></span>
            {receipt.legacy_code && <span className="ka-po-cap">เลขเดิม {receipt.legacy_code}</span>}
            <StatusBadge tone={receiptStatusTone(status)}>{receiptStatusLabel(status)}</StatusBadge>
          </div>
          <h1 className="ka-ph__title ka-po-title">{title}</h1>
          <p className="ka-po-cap numeric">
            {supplierName} · รับเมื่อ {formatThaiDate(receipt.entry_date)}
          </p>
        </div>
        <div className="ka-po-ph__acts ka-po-noprint">
          {status === 'pending' && canApprove && (
            <button
              type="button"
              className="ka-btn ka-btn--primary"
              onClick={() => setConfirmApprove(true)}
              disabled={busy !== null}
              aria-busy={busy === 'approve' || undefined}
            >
              {busy === 'approve' ? 'กำลังอนุมัติ…' : 'อนุมัติ'}
            </button>
          )}
          {status === 'pending' && canEdit && (
            <Link href={`${BASE}/${id}/edit`} className="ka-btn">
              แก้ไข
            </Link>
          )}
          {status !== 'pending' && (
            <button type="button" className="ka-btn" onClick={print}>
              <PrintIcon />
              พิมพ์ / PDF
            </button>
          )}
          {more.length > 0 && <RowMenu label={`ตัวเลือกเพิ่มเติมของ ${code}`} items={more} triggerClassName="ka-btn ka-btn--icon ka-po-more" />}
        </div>
      </div>

      {status === 'rejected' && (
        <div className="ka-banner ka-pr-outcome--neutral ka-po-cancelled" role="note">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM6 6l12 12" />
          </svg>
          <span>
            <strong>ใบรับสินค้านี้ถูกยกเลิก</strong>
            {cancelEntry?.reason && <span className="ka-po-cancelled__why">เหตุผล: {cancelEntry.reason}</span>}
            {cancelEntry && (
              <span className="ka-po-cancelled__why numeric">
                {cancelEntry.actor_name ? `${cancelEntry.actor_name} · ` : ''}
                {formatThaiDate(cancelEntry.created_at)}
              </span>
            )}
          </span>
        </div>
      )}

      <div className="ka-po-grid">
        <div className="ka-po-stack">
          <section className="ka-card" aria-labelledby="pr-doc">
            <div className="ka-po-chd">
              <h2 id="pr-doc" className="ka-po-h2">ข้อมูลเอกสาร</h2>
            </div>
            <div className="ka-po-cp">
              <dl className="ka-po-dl">
                <div>
                  <dt>อ้างอิงใบสั่งซื้อ</dt>
                  <dd>
                    {poCode ? (
                      <Link href={`/admin/purchase-orders/${receipt.purchase_order_id}`} className="ka-pr-pochip">
                        {poCode} →<span className="sr-only"> เปิดใบสั่งซื้อ</span>
                      </Link>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>วันที่รับ</dt>
                  <dd className="numeric">{formatThaiDate(receipt.entry_date)}</dd>
                </div>
                <div>
                  <dt>รูปแบบ VAT</dt>
                  <dd>{vatTypeText(receipt.vat_type, vatRate)}</dd>
                </div>
                <div>
                  <dt>ผู้จำหน่าย</dt>
                  <dd className="ka-po-strong">{supplierName}</dd>
                </div>
                <div className="ka-pr-dl__wide">
                  <dt>หมายเหตุ</dt>
                  <dd className="ka-po-pre">{receipt.purchase_receipt_detail?.trim() || '-'}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="ka-card ka-po-clip" aria-labelledby="pr-items">
            <div className="ka-po-chd">
              <h2 id="pr-items" className="ka-po-h2">รายการที่รับ</h2>
              <span className="ka-po-cap numeric">{lines.length.toLocaleString('th-TH')} รายการ</span>
            </div>
            {lines.length === 0 ? (
              <p className="ka-po-cp ka-po-cap">ไม่มีรายการที่รับ</p>
            ) : (
              <div className="ka-po-tw">
                <table className="ka-po-it ka-pr-it">
                  <caption className="sr-only">รายการที่รับใน {code}</caption>
                  <thead>
                    <tr>
                      <th scope="col">วัตถุดิบ</th>
                      <th scope="col" className="ka-po-r">จำนวนรับ</th>
                      <th scope="col" className="ka-po-r ka-po-it__price">ราคา/หน่วย</th>
                      <th scope="col" className="ka-po-r">รวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const unit = line.productUnit?.product_unit_name ?? '';
                      const name = line.material?.material_name ?? line.purchaseOrderList?.material?.material_name ?? '-';
                      return (
                        <tr key={line.purchase_receipt_list_id ?? `${line.purchase_order_list_id}-${index}`}>
                          <th scope="row" className="ka-po-it__name">{name}</th>
                          <td className="ka-po-r numeric ka-po-it__qty">
                            {Number(line.purchase_receipt_list_qty).toLocaleString('th-TH')} {unit}{' '}
                            <span className="ka-po-cap">× {formatBaht(Number(line.purchase_receipt_list_price))}</span>
                          </td>
                          <td className="ka-po-r numeric ka-po-it__price">{formatMoney(Number(line.purchase_receipt_list_price))}</td>
                          <td className="ka-po-r numeric ka-po-it__sum ka-po-strong">{formatMoney(receiptLineTotal(line))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <dl className="ka-po-tot">
              <div>
                <dt>ยอดก่อน VAT</dt>
                <dd className="numeric">{formatBaht(vat.subtotal)}</dd>
              </div>
              <div>
                <dt>{receipt.vat_type === 'include' ? `VAT ${vatRate}% (รวมในราคาแล้ว)` : receipt.vat_type === 'exclude' ? `VAT ${vatRate}%` : 'VAT'}</dt>
                <dd className="numeric">{receipt.vat_type === 'include' || receipt.vat_type === 'exclude' ? formatBaht(vat.vatAmount) : 'ไม่คิด'}</dd>
              </div>
              <div className="ka-po-tot__g">
                <dt>ยอดรวมทั้งสิ้น</dt>
                <dd className="numeric">{formatBaht(vat.total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="ka-po-aside" aria-label="สรุป ผลต่อสต็อก และประวัติ">
          <section className="ka-card ka-po-cp" aria-labelledby="pr-total-label">
            <p id="pr-total-label" className="ka-po-cap ka-po-strong">ยอดรวมทั้งสิ้น</p>
            <p className="ka-po-big numeric">{formatBaht(vat.total)}</p>
            <p className="ka-po-cap numeric">ก่อน VAT {formatBaht(vat.subtotal)}</p>
            {order && (
              <div className="ka-po-progress ka-pr-split">
                {progress && (
                  <>
                    <div className="ka-po-progress__row">
                      <span className="ka-po-cap">ใบสั่งซื้อนี้รับแล้ว</span>
                      <b className="numeric">
                        {progress.received.toLocaleString('th-TH')} / {progress.ordered.toLocaleString('th-TH')} {progress.unit}
                      </b>
                    </div>
                    <div
                      className={`ka-po-meter${progress.received < progress.ordered ? ' ka-pr-meter--partial' : ''}`}
                      role="progressbar"
                      aria-label="ใบสั่งซื้อนี้รับแล้ว"
                      aria-valuemin={0}
                      aria-valuemax={progress.ordered}
                      aria-valuenow={progress.received}
                      aria-valuetext={`${progress.received} จาก ${progress.ordered} ${progress.unit}`}
                    >
                      <i style={{ width: `${progress.ordered ? Math.min(100, (progress.received / progress.ordered) * 100) : 0}%` }} />
                    </div>
                  </>
                )}
                <p className="ka-po-cap ka-pr-postatus">
                  สถานะใบสั่งซื้อตอนนี้: <b>{statusLabel(order.purchase_order_status)}</b>
                </p>
              </div>
            )}
          </section>

          <section className="ka-card ka-po-cp" aria-labelledby="pr-stock">
            <h2 id="pr-stock" className="ka-po-h2 ka-po-h2--gap">ผลต่อสต็อก</h2>
            {status === 'rejected' ? (
              <p className="ka-po-cap">ไม่มีผลต่อสต็อก ใบรับนี้ถูกยกเลิกแล้ว</p>
            ) : (
              <>
                <ul className="ka-pr-stock">
                  {lines.map((line, index) => (
                    <li key={line.purchase_receipt_list_id ?? `${line.purchase_order_list_id}-${index}`}>
                      <span>{line.material?.material_name ?? line.purchaseOrderList?.material?.material_name ?? '-'}</span>
                      <b className={`numeric ${status === 'approved' ? 'ka-pr-stock--in' : 'ka-pr-stock--wait'}`}>
                        +{Number(line.purchase_receipt_list_qty).toLocaleString('th-TH')} {line.productUnit?.product_unit_name ?? ''}
                      </b>
                    </li>
                  ))}
                </ul>
                <p className="ka-po-cap">{status === 'approved' ? 'เพิ่มเข้าสต็อกแล้วเมื่ออนุมัติ' : 'จะเพิ่มเมื่ออนุมัติ'}</p>
              </>
            )}
          </section>

          <section className="ka-card ka-po-cp ka-po-noprint" aria-labelledby="pr-history">
            <h2 id="pr-history" className="ka-po-h2 ka-po-h2--gap">ประวัติ</h2>
            <DocumentHistoryPanel key={historyKey} endpoint={`/purchase-receipt/${id}/history`} variant="timeline" onEntries={setHistory} />
          </section>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={confirmApprove}
        title="อนุมัติใบรับสินค้า"
        message={`อนุมัติ ${code} ยอด ${formatBaht(vat.total)} แล้วสต็อกวัตถุดิบจะเพิ่ม ${qtyText} หลังอนุมัติจะแก้ไขหรือลบใบนี้ไม่ได้`}
        confirmLabel="อนุมัติ"
        cancelLabel="ยังไม่อนุมัติ"
        tone="neutral"
        bottom_className="ka-btn ka-btn--primary min-h-11"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => void approve()}
      />
      <ConfirmDialog
        isOpen={confirmDelete}
        title="ลบใบรับสินค้า"
        message={`ลบ ${code} จำนวนที่ใบนี้รับไว้ (${qtyText}) จะคืนเป็นยอดคงเหลือของใบสั่งซื้อ ${poCode} ลบแล้วกู้คืนไม่ได้`}
        confirmLabel="ลบใบรับสินค้า"
        cancelLabel="ไม่ลบ"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
      {rejecting && (
        <CancellationDialog
          title={`ยกเลิก ${code}: ${cancelEffect}`}
          onClose={() => setRejecting(false)}
          onConfirm={async (reason) => {
            // The same call as DocumentCancellationAction: POST /purchase-receipt/{id}/reject.
            await axiosInstance.post(`/purchase-receipt/${id}/reject`, { reason });
            toast({ message: `ยกเลิกใบรับสินค้า ${code} แล้ว`, tone: 'success' });
            changed();
          }}
        />
      )}
    </div>
  );
}
