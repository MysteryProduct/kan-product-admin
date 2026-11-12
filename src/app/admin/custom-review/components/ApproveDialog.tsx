'use client';

import Modal from '@/components/Modal';
import Button from '@/components/Button';
import type { ReviewDetail } from '@/types/custom-review';

/**
 * The page's one dialog (v2 brief): approval cannot be undone (Q5). A 409 keeps
 * the dialog open with the conflict and offers to load the latest record. Below
 * 640px the shared Modal rises from the bottom as a sheet.
 */
export default function ApproveDialog({
  detail,
  originals,
  open,
  pending,
  conflict,
  onClose,
  onApprove,
  onReload,
}: {
  detail: ReviewDetail;
  originals: number;
  open: boolean;
  pending: boolean;
  conflict: string | null;
  onClose: () => void;
  onApprove: () => void;
  onReload: () => void;
}) {
  const units = new Set(detail.items.map((i) => i.saleUnit));
  const quantity = detail.items.reduce((sum, i) => sum + i.quantity, 0);
  const itemsText =
    units.size === 1 ? `${detail.items.length} รายการ · ${quantity} ${[...units][0]}` : `${detail.items.length} รายการ`;

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={`อนุมัติแบบฉบับ ${detail.revision} ของ ${detail.code} ให้ผลิต?`}
      size="standard"
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      className="ka-cr-dlg"
      footer={
        conflict ? (
          <>
            <Button variant="ghost" onClick={onClose}>ปิด</Button>
            <Button variant="action" onClick={onReload}>โหลดข้อมูลล่าสุด</Button>
          </>
        ) : (
          <>
            <Button onClick={onClose} disabled={pending}>กลับไปตรวจ</Button>
            <Button variant="action" loading={pending} onClick={onApprove}>อนุมัติให้ผลิต</Button>
          </>
        )
      }
    >
      {conflict && (
        <div className="ka-cr-ban" role="alert">
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9l-6 6M9 9l6 6" /></svg>
          <span>
            <b>อนุมัติไม่สำเร็จ</b> {conflict} โหลดข้อมูลล่าสุดแล้วตรวจอีกครั้ง
          </span>
        </div>
      )}
      <dl className="ka-cr-sum">
        <div><dt>ผู้สั่งซื้อ</dt><dd>{detail.buyer.name}</dd></div>
        <div><dt>ใบสั่งขาย</dt><dd className="ka-cr-code">{detail.saleOrderCode}</dd></div>
        <div><dt>รายการ</dt><dd>{itemsText}</dd></div>
        <div><dt>ภาพต้นฉบับ</dt><dd>{originals ? `${originals} ไฟล์` : 'ไม่มี (ข้อความล้วน)'}</dd></div>
        <div><dt>ตรวจแล้ว</dt><dd>ครบ 4 ข้อ</dd></div>
      </dl>
      <p className="ka-cr-dlg__d">
        อนุมัติแล้ว<b>ย้อนผลไม่ได้</b> ถ้าพบปัญหาภายหลังต้องยกเลิกคำขอ
      </p>
    </Modal>
  );
}
