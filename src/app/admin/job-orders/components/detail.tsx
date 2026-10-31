'use client';

import type { ReactNode } from 'react';
import { JobOrder } from '@/types/job-order';
import { formatThaiDate } from '@/lib/date-format';
import DocumentHistoryPanel from '@/components/document-history/DocumentHistoryPanel';
import Modal from '@/components/Modal';
import StatusBadge, { type BadgeTone } from '@/components/StatusBadge';
import Button from '@/components/Button';

interface JobOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobOrder: JobOrder | null;
  mode?: 'view' | 'complete_confirm';
  completionQty?: string;
  completionDefectQty?: string;
  onCompletionQtyChange?: (value: string) => void;
  onCompletionDefectQtyChange?: (value: string) => void;
  onConfirmComplete?: () => void;
  isConfirming?: boolean;
  /** Commands in the footer; each is shown only when the caller passes it (permissions, final states). */
  onCancelJob?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
}

const STATUS: Record<string, { label: string; tone: BadgeTone; step: number }> = {
  pending: { label: 'รอดำเนินการ', tone: 'warning', step: 0 },
  in_progress: { label: 'กำลังผลิต', tone: 'info', step: 1 },
  completed: { label: 'ผลิตเสร็จแล้ว', tone: 'success', step: 2 },
  cancelled: { label: 'ยกเลิกการผลิต', tone: 'danger', step: -1 },
};
const STEPS = ['รอดำเนินการ', 'กำลังผลิต', 'เสร็จแล้ว'];

const normalize = (status?: string) => {
  const lower = String(status || '').toLowerCase();
  if (lower.includes('progress') || lower.includes('กำลัง')) return 'in_progress';
  if (lower.includes('complete') || lower.includes('เสร็จ')) return 'completed';
  if (lower.includes('cancel') || lower.includes('ยกเลิก')) return 'cancelled';
  return 'pending';
};

const typeLabel = (type?: string) => (type === 'website' ? 'ขายบน Website' : type === 'purchase' ? 'ตามคำสั่งซื้อ' : type === 'custom' ? 'สินค้า Custom' : type || '-');
const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);
const baht = (value: number) => `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

const delay = (job: JobOrder): { label: string; tone: BadgeTone } | null => {
  const status = normalize(job.job_order_status);
  if (status === 'cancelled' || !job.target_date) return null;
  const target = new Date(job.target_date);
  const compare = status === 'completed' ? new Date((job.finish_date || job.completed_date || job.completed_at || job.finish_at || Date.now()) as string) : new Date();
  const days = Math.floor((new Date(compare.getFullYear(), compare.getMonth(), compare.getDate()).getTime() - new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()) / 86400000);
  return days > 0 ? { label: `ล่าช้า ${count(days)} วัน`, tone: 'danger' } : { label: 'ตรงเวลา', tone: 'success' };
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="ka-todo__cap">{label}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </div>
  );
}

/** One job in full: its state as three steps, the facts, the materials, the history, and what can be done next. */
export default function JobOrderDetailModal({
  isOpen,
  onClose,
  jobOrder,
  mode = 'view',
  completionQty = '',
  completionDefectQty = '',
  onCompletionQtyChange,
  onCompletionDefectQtyChange,
  onConfirmComplete,
  isConfirming = false,
  onCancelJob,
  onCopy,
  onEdit,
}: JobOrderDetailModalProps) {
  if (!isOpen || !jobOrder) return null;

  const status = STATUS[normalize(jobOrder.job_order_status)];
  const isCompleteConfirm = mode === 'complete_confirm';
  const assignee = jobOrder.employee?.employee_fullname || `${jobOrder.employee?.employee_firstname || ''} ${jobOrder.employee?.employee_lastname || ''}`.trim() || '-';
  const materials = jobOrder.jobOrderMaterials || jobOrder.job_order_materials || [];
  const sizeLabel = jobOrder.size?.size_name || jobOrder.productVariant?.size?.size_name || '';
  const colorLabel = jobOrder.color?.color_name || jobOrder.productVariant?.color?.color_name || '';
  const productLabel = jobOrder.productVariant?.product?.product_name;
  const late = delay(jobOrder);
  const qty = jobOrder.job_order_qty ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isConfirming) onClose();
      }}
      title={jobOrder.job_order_code || 'รายละเอียดงานผลิต'}
      description={jobOrder.job_order_name}
      size="wide"
      closeOnBackdrop={!isConfirming}
      closeOnEscape={!isConfirming}
      footer={
        isCompleteConfirm ? undefined : (
          <>
            {onCancelJob && <Button variant="danger" onClick={onCancelJob}>ยกเลิกงาน</Button>}
            <span className="ka-table-tools__spacer max-sm:hidden" />
            {onCopy && <Button onClick={onCopy}>ทำสำเนา</Button>}
            {onEdit && <Button variant="action" onClick={onEdit}>แก้ไขงาน</Button>}
            {!onEdit && <Button variant="action" onClick={onClose}>ปิด</Button>}
          </>
        )
      }
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {late && <StatusBadge tone={late.tone}>{late.label}</StatusBadge>}
          {(productLabel || sizeLabel || colorLabel) && (
            <span className="ka-todo__cap">{[productLabel, sizeLabel, colorLabel].filter(Boolean).join(' · ')}</span>
          )}
        </div>

        {status.step >= 0 ? (
          <ol className="ka-steps" aria-label="ความคืบหน้า">
            {STEPS.map((label, index) => (
              <li key={label} data-state={index < status.step ? 'done' : index === status.step ? 'now' : 'todo'}>
                <i aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ka-banner ka-banner--danger m-0"><span>งานนี้ถูกยกเลิกแล้ว ดูเหตุผลในประวัติด้านล่าง</span></p>
        )}

        <dl className="ka-facts">
          <Field label="ประเภท">{typeLabel(jobOrder.job_order_type)}</Field>
          <Field label="จำนวน"><span className="numeric">{count(qty)} ชิ้น</span>{typeof jobOrder.job_order_defect_qty === 'number' && jobOrder.job_order_defect_qty > 0 ? <span className="ka-todo__cap"> · เสีย {count(jobOrder.job_order_defect_qty)}</span> : null}</Field>
          <Field label="วันเป้าหมาย"><span className="numeric">{formatThaiDate(jobOrder.target_date)}</span></Field>
          <Field label="ผู้รับผิดชอบ">{assignee}</Field>
          <Field label="ราคาสินค้า"><span className="numeric">{baht(Number(jobOrder.job_order_price ?? 0))}</span></Field>
          <Field label="สร้างเมื่อ"><span className="numeric">{formatThaiDate(jobOrder.create_date)}</span></Field>
        </dl>

        {jobOrder.job_order_description && (
          <div>
            <p className="ka-todo__cap">รายละเอียด</p>
            <p className="m-0 whitespace-pre-wrap">{jobOrder.job_order_description}</p>
          </div>
        )}

        <div>
          <p className="ka-label mb-2">วัตถุดิบที่ใช้</p>
          {materials.length === 0 ? (
            <p className="ka-panel__note">ไม่มีข้อมูลวัตถุดิบ</p>
          ) : (
            <table className="ka-table w-full">
              <thead>
                <tr>
                  <th>วัตถุดิบ</th>
                  <th className="text-right">ต่อชิ้น</th>
                  <th className="text-right">รวม × {count(qty)}</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((item, index) => (
                  <tr key={item.job_order_material_id || `${item.material_id}-${index}`}>
                    <td>{item.material?.material_name || item.material_id || '-'}</td>
                    <td className="numeric text-right">{count(item.material_qty)}</td>
                    <td className="numeric text-right font-semibold">{count(item.material_qty * qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {isCompleteConfirm && (
          <div className="ka-banner ka-banner--success grid gap-3">
            <div>
              <strong>ยืนยันปิดงานผลิต</strong>
              <div className="text-[14px]">หลังยืนยัน งานจะเป็น “ผลิตเสร็จแล้ว” และย้ายไปสถานะอื่นไม่ได้</div>
            </div>
            <div className="ka-editor__g2">
              <div className="ka-field">
                <label htmlFor="jo-done-qty" className="ka-label">จำนวนที่ผลิตจริง</label>
                <input id="jo-done-qty" type="number" min={1} step={1} inputMode="numeric" className="ka-input numeric" value={completionQty} onChange={(event) => onCompletionQtyChange?.(event.target.value)} />
              </div>
              <div className="ka-field">
                <label htmlFor="jo-defect-qty" className="ka-label">จำนวนสินค้าเสียหาย</label>
                <input id="jo-defect-qty" type="number" min={0} step={1} inputMode="numeric" className="ka-input numeric" value={completionDefectQty} onChange={(event) => onCompletionDefectQtyChange?.(event.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={isConfirming}>ยกเลิก</Button>
              <Button variant="action" loading={isConfirming} onClick={onConfirmComplete}>ยืนยันปิดงาน</Button>
            </div>
          </div>
        )}

        <DocumentHistoryPanel endpoint={`/job-order/${jobOrder.job_order_id}/history`} />
      </div>
    </Modal>
  );
}
