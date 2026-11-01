'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import axiosInstance from '@/lib/axios';
import PurchaseOrderModel from '@/models/purchase-order';
import type { PurchaseOrder } from '@/types/purchase-order';
import { usePermissions } from '@/hooks/usePermissions';
import useVatRate from '@/hooks/useVatRate';
import { usePageCrumb } from '@/lib/page-crumb';
import { formatThaiDate } from '@/lib/date-format';
import { getApiErrorMessage } from '@/lib/api-error';
import CancellationDialog from '@/components/CancellationDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import RowMenu, { RowMenuItem } from '@/components/RowMenu';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import DocumentHistoryPanel, { DocumentHistoryEntry } from '@/components/document-history/DocumentHistoryPanel';
import { markEditFromDetail } from '../lib/edit-origin';
import { deletable, formatBaht, formatMoney, lineTotal, orderLines, orderVatSummary, statusLabel, statusTone } from '../lib/po-display';

const purchaseOrderModel = new PurchaseOrderModel();
const BASE = '/admin/purchase-orders';

interface PurchaseOrderDetailProps {
  purchaseOrder: PurchaseOrder;
  /** Reloads the order after it was approved, submitted or cancelled. */
  onChanged: () => void;
}

type StepState = 'done' | 'current' | 'todo';

function vatTypeText(vatType: string | undefined, rate: number): string {
  if (vatType === 'include') return `ราคารวม VAT ${rate}%`;
  if (vatType === 'exclude') return `ราคาไม่รวม VAT · แยก ${rate}%`;
  return 'ไม่คิด VAT';
}

export default function PurchaseOrderDetail({ purchaseOrder: order, onChanged }: PurchaseOrderDetailProps) {
  const router = useRouter();
  const toast = useToast();
  const vatRate = useVatRate();
  const { can } = usePermissions();
  const canApprove = can('purchase_orders', 'approve');
  const canEdit = can('purchase_orders', 'edit');
  const canDelete = can('purchase_orders', 'delete');
  const canReject = can('purchase_orders', 'reject');
  const canAdd = can('purchase_orders', 'add');

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'submit' | 'delete' | null>(null);
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [historyKey, setHistoryKey] = useState(0);

  const id = order.purchase_order_id;
  const code = order.purchase_order_code;
  const status = order.purchase_order_status;
  usePageCrumb({ back: { label: 'ใบสั่งซื้อ', href: BASE }, current: code });

  const lines = orderLines(order);
  const vat = orderVatSummary(order, vatRate);
  const supplierName = order.supplier?.supplier_name ?? '-';

  // Received so far = ordered minus what is still to receive, once the order has been approved.
  const receiving = status === 'active' || status === 'partial' || status === 'completed';
  const hasBalance = receiving && lines.length > 0 && lines.every((line) => line.purchase_order_list_balance_qty !== null && line.purchase_order_list_balance_qty !== undefined);
  const receivedOf = (line: (typeof lines)[number]) =>
    Math.max(0, Number(line.purchase_order_list_qty) - Number(line.purchase_order_list_balance_qty ?? line.purchase_order_list_qty));
  const progress = (() => {
    if (!hasBalance) return null;
    const units = new Set(lines.map((line) => line.productUnit?.product_unit_name ?? ''));
    if (units.size === 1) {
      const ordered = lines.reduce((sum, line) => sum + Number(line.purchase_order_list_qty), 0);
      const received = lines.reduce((sum, line) => sum + receivedOf(line), 0);
      return { received, ordered, unit: [...units][0] || 'หน่วย' };
    }
    // Different units cannot be added up; count the lines received in full instead.
    const done = lines.filter((line) => receivedOf(line) >= Number(line.purchase_order_list_qty)).length;
    return { received: done, ordered: lines.length, unit: 'รายการ' };
  })();

  const approvedAt = history.find((entry) => entry.action === 'approved')?.created_at;
  const cancelEntry = history.find((entry) => entry.action === 'cancelled' || entry.action === 'rejected');

  const steps: { label: string; state: StepState; date?: string }[] = (() => {
    const at = { draft: 1, pending: 1, active: 2, partial: 3, completed: 4 }[status as 'draft'] ?? 1;
    const labels = ['สร้างใบสั่งซื้อ', 'อนุมัติ', 'รับสินค้า', 'รับครบแล้ว'];
    const dates = [order.purchase_date ? formatThaiDate(order.purchase_date) : undefined, approvedAt ? formatThaiDate(approvedAt) : undefined];
    return labels.map((label, index) => ({
      label: index === 0 && status === 'draft' ? 'สร้างใบสั่งซื้อ (ฉบับร่าง)' : label,
      state: index < at ? 'done' : index === at ? 'current' : 'todo',
      date: index < at ? dates[index] : undefined,
    }));
  })();
  // A draft has not been sent yet, so its first step is still the current one.
  if (status === 'draft') {
    steps[0].state = 'current';
    steps[1].state = 'todo';
  }

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
      await purchaseOrderModel.approvePurchaseOrder(id, user.employee_id);
      toast({ message: `อนุมัติใบสั่งซื้อ ${code} แล้ว`, tone: 'success' });
      changed();
    } catch (error) {
      toast({ message: `อนุมัติ ${code} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  // A draft goes to the approval queue; approving it is a separate step.
  const submit = async () => {
    setBusy('submit');
    try {
      await purchaseOrderModel.submitPurchaseOrder(id);
      toast({ message: `ส่ง ${code} เข้ารออนุมัติแล้ว`, tone: 'success' });
      changed();
    } catch (error) {
      toast({ message: `ส่งอนุมัติไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setBusy('delete');
    try {
      await purchaseOrderModel.deletePurchaseOrder(id);
      toast({ message: `ลบใบสั่งซื้อ ${code} แล้ว`, tone: 'success' });
      router.push(BASE);
    } catch (error) {
      toast({ message: `ลบ ${code} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
      setBusy(null);
    }
  };

  const editable = status === 'draft' || status === 'pending';
  const more: RowMenuItem[] = [];
  if (canReject && (status === 'pending' || status === 'active')) more.push({ label: 'ยกเลิกใบสั่งซื้อ', icon: 'cancel', tone: 'danger', onSelect: () => setRejecting(true) });
  if (canDelete && deletable(status)) more.push({ label: 'ลบ', icon: 'delete', tone: 'danger', onSelect: () => setConfirmDelete(true) });

  const finished = status === 'completed' || status === 'inactive';

  return (
    <div className="ka-page-body ka-po ka-po-print">
      <div className="ka-po-ph">
        <div className="ka-po-ph__main">
          <div className="ka-po-idrow">
            <span className="ka-po-code ka-po-code--muted">{code}</span>
            {order.legacy_code && <span className="ka-po-cap">เลขเดิม {order.legacy_code}</span>}
            <StatusBadge tone={statusTone(status)}>{statusLabel(status)}</StatusBadge>
          </div>
          <h1 className="ka-ph__title ka-po-title">{order.purchase_order_name}</h1>
          <p className="ka-po-cap">
            {supplierName} · สั่งเมื่อ {formatThaiDate(order.purchase_date)}
          </p>
        </div>
        <div className="ka-po-ph__acts ka-po-noprint">
          {status === 'draft' && canEdit && (
            <button type="button" className="ka-btn ka-btn--primary" onClick={() => void submit()} disabled={busy !== null} aria-busy={busy === 'submit' || undefined}>
              {busy === 'submit' ? 'กำลังส่ง…' : 'ส่งอนุมัติ'}
            </button>
          )}
          {status === 'pending' && canApprove && (
            <button type="button" className="ka-btn ka-btn--primary" onClick={() => setConfirmApprove(true)} disabled={busy !== null} aria-busy={busy === 'approve' || undefined}>
              {busy === 'approve' ? 'กำลังอนุมัติ…' : 'อนุมัติ'}
            </button>
          )}
          {editable && canEdit && (
            <Link href={`${BASE}/${id}/edit`} className="ka-btn" onClick={() => markEditFromDetail(`${BASE}/${id}`)}>
              แก้ไข
            </Link>
          )}
          {finished && (
            <button type="button" className="ka-btn" onClick={() => window.print()}>
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 9V3h10v6M7 17H5v-6h14v6h-2M7 14h10v7H7z" />
              </svg>
              พิมพ์ / PDF
            </button>
          )}
          {finished && canAdd && (
            <Link href={`${BASE}/new?copy=${id}`} className="ka-btn">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h11v11H8zM5 16V5h11" />
              </svg>
              สั่งซ้ำ
            </Link>
          )}
          {more.length > 0 && (
            <RowMenu label={`ตัวเลือกเพิ่มเติมของ ${code}`} items={more} triggerClassName="ka-btn ka-btn--icon ka-po-more" />
          )}
        </div>
      </div>

      {status === 'inactive' ? (
        <div className="ka-banner ka-po-cancelled" role="note">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM6 6l12 12" />
          </svg>
          <span>
            <strong>ใบสั่งซื้อนี้ถูกยกเลิก</strong>
            {cancelEntry?.reason && <span className="ka-po-cancelled__why">เหตุผล: {cancelEntry.reason}</span>}
            {cancelEntry && (
              <span className="ka-po-cancelled__why">
                {cancelEntry.actor_name ? `${cancelEntry.actor_name} · ` : ''}
                {formatThaiDate(cancelEntry.created_at)}
              </span>
            )}
          </span>
        </div>
      ) : (
        <section className="ka-card" aria-label="ขั้นตอนใบสั่งซื้อ">
          <ol className="ka-po-steps">
            {steps.map((step, index) => (
              <li key={step.label} className={`ka-po-st ka-po-st--${step.state}`} aria-current={step.state === 'current' ? 'step' : undefined}>
                <i aria-hidden="true">{step.state === 'done' ? '✓' : index + 1}</i>
                <span>
                  {step.label}
                  <span className="sr-only">{step.state === 'done' ? ' (เสร็จแล้ว)' : step.state === 'current' ? ' (ขั้นปัจจุบัน)' : ''}</span>
                </span>
                {step.date && <small className="numeric">{step.date}</small>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="ka-po-grid">
        <div className="ka-po-stack">
          <section className="ka-card" aria-labelledby="po-doc">
            <div className="ka-po-chd">
              <h2 id="po-doc" className="ka-po-h2">ข้อมูลเอกสาร</h2>
            </div>
            <div className="ka-po-cp">
              <dl className="ka-po-dl">
                <div>
                  <dt>ผู้จำหน่าย</dt>
                  <dd className="ka-po-strong">{supplierName}</dd>
                </div>
                <div>
                  <dt>วันที่สั่ง</dt>
                  <dd className="numeric">{formatThaiDate(order.purchase_date)}</dd>
                </div>
                <div>
                  <dt>รูปแบบ VAT</dt>
                  <dd>{vatTypeText(order.vat_type, vatRate)}</dd>
                </div>
                <div className="ka-po-dl__full">
                  <dt>รายละเอียด</dt>
                  <dd className="ka-po-pre">{order.purchase_order_detail || '-'}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="ka-card ka-po-clip" aria-labelledby="po-items">
            <div className="ka-po-chd">
              <h2 id="po-items" className="ka-po-h2">รายการวัตถุดิบ</h2>
              <span className="ka-po-cap numeric">{lines.length} รายการ</span>
            </div>
            {lines.length === 0 ? (
              <p className="ka-po-cp ka-po-cap">ไม่มีรายการวัตถุดิบ</p>
            ) : (
              <div className="ka-po-tw">
                <table className="ka-po-it">
                  <caption className="sr-only">รายการวัตถุดิบใน {code}</caption>
                  <thead>
                    <tr>
                      <th scope="col">วัตถุดิบ</th>
                      <th scope="col" className="ka-po-r">จำนวน</th>
                      <th scope="col" className="ka-po-it__unit">หน่วย</th>
                      <th scope="col" className="ka-po-r ka-po-it__price">ราคา/หน่วย</th>
                      {hasBalance && <th scope="col" className="ka-po-r">รับแล้ว</th>}
                      <th scope="col" className="ka-po-r">รวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const unit = line.productUnit?.product_unit_name ?? '';
                      return (
                        <tr key={line.purchase_order_list_id ?? `${line.material_id}-${index}`}>
                          <th scope="row" className="ka-po-it__name">{line.material?.material_name ?? '-'}</th>
                          <td className="ka-po-r numeric ka-po-it__qty">
                            <span className="ka-po-it__qtyonly">{Number(line.purchase_order_list_qty).toLocaleString('th-TH')}</span>
                            <span className="ka-po-it__qp">
                              {Number(line.purchase_order_list_qty).toLocaleString('th-TH')} {unit} × {formatBaht(Number(line.purchase_order_list_price))}
                            </span>
                          </td>
                          <td className="ka-po-it__unit">{unit || '-'}</td>
                          <td className="ka-po-r numeric ka-po-it__price">{formatMoney(Number(line.purchase_order_list_price))}</td>
                          {hasBalance && (
                            <td className="ka-po-r numeric ka-po-it__recv">
                              <span className="ka-po-it__recvlab">รับแล้ว </span>
                              {receivedOf(line).toLocaleString('th-TH')}/{Number(line.purchase_order_list_qty).toLocaleString('th-TH')}
                            </td>
                          )}
                          <td className="ka-po-r numeric ka-po-it__sum">{formatMoney(lineTotal(line))}</td>
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
                <dt>{order.vat_type === 'include' ? `VAT ${vatRate}% (รวมในราคาแล้ว)` : order.vat_type === 'exclude' ? `VAT ${vatRate}%` : 'VAT'}</dt>
                <dd className="numeric">{order.vat_type === 'include' || order.vat_type === 'exclude' ? formatBaht(vat.vatAmount) : 'ไม่คิด'}</dd>
              </div>
              <div className="ka-po-tot__g">
                <dt>ยอดรวมทั้งสิ้น</dt>
                <dd className="numeric">{formatBaht(vat.total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="ka-po-aside" aria-label="สรุปและประวัติ">
          <section className="ka-card ka-po-cp" aria-labelledby="po-total-label">
            <p id="po-total-label" className="ka-po-cap ka-po-strong">ยอดรวมทั้งสิ้น</p>
            <p className="ka-po-big numeric">{formatBaht(vat.total)}</p>
            <p className="ka-po-cap numeric">
              {order.vat_type === 'none' || !order.vat_type ? 'ไม่คิด VAT' : `รวม VAT ${formatBaht(vat.vatAmount)}`}
            </p>
            {progress && (
              <div className="ka-po-progress">
                <div className="ka-po-progress__row">
                  <span className="ka-po-cap">รับสินค้าแล้ว</span>
                  <b className="numeric">
                    {progress.received.toLocaleString('th-TH')} / {progress.ordered.toLocaleString('th-TH')} {progress.unit}
                  </b>
                </div>
                <div
                  className="ka-po-meter"
                  role="progressbar"
                  aria-label="รับสินค้าแล้ว"
                  aria-valuemin={0}
                  aria-valuemax={progress.ordered}
                  aria-valuenow={progress.received}
                >
                  <i style={{ width: `${progress.ordered ? Math.min(100, (progress.received / progress.ordered) * 100) : 0}%` }} />
                </div>
              </div>
            )}
          </section>

          <section className="ka-card ka-po-cp ka-po-noprint" aria-labelledby="po-history">
            <h2 id="po-history" className="ka-po-h2 ka-po-h2--gap">ประวัติ</h2>
            <DocumentHistoryPanel key={historyKey} endpoint={`/purchase-order/${id}/history`} variant="timeline" onEntries={setHistory} />
          </section>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={confirmApprove}
        title="อนุมัติใบสั่งซื้อ"
        message={`อนุมัติ ${code} “${order.purchase_order_name}” ยอด ${formatBaht(vat.total)} หลังอนุมัติจะแก้ไขใบนี้ไม่ได้ และเปิดใบรับสินค้าได้`}
        confirmLabel="อนุมัติ"
        cancelLabel="ยังไม่อนุมัติ"
        tone="neutral"
        bottom_className="ka-btn ka-btn--primary min-h-11"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => void approve()}
      />
      <ConfirmDialog
        isOpen={confirmDelete}
        title="ลบใบสั่งซื้อ"
        message={`ลบ ${code} “${order.purchase_order_name}” และรายการวัตถุดิบทั้งหมดในใบนี้ ลบแล้วกู้คืนไม่ได้`}
        confirmLabel="ลบใบสั่งซื้อ"
        cancelLabel="ไม่ลบ"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
      {rejecting && (
        <CancellationDialog
          title={`ยกเลิกใบสั่งซื้อ ${code}`}
          onClose={() => setRejecting(false)}
          onConfirm={async (reason) => {
            await axiosInstance.post(`/purchase-order/${id}/reject`, { reason });
            toast({ message: `ยกเลิกใบสั่งซื้อ ${code} แล้ว`, tone: 'success' });
            changed();
          }}
        />
      )}
    </div>
  );
}
