import Modal from '@/components/Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  bottom_className?: string;
  /** The verb on the confirm button: "ลบสินค้า", not "ตกลง", for a step that cannot be undone. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` (default) for deleting or cancelling; `neutral` for an ordinary confirmation. */
  tone?: 'danger' | 'neutral';
}

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'ยืนยันการดำเนินการ',
  message,
  bottom_className = '',
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  tone = 'danger',
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      description="โปรดตรวจสอบข้อมูลก่อนยืนยัน"
      size="compact"
      footer={
        <>
          <button type="button" onClick={onCancel} className="ka-btn min-h-11">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`${bottom_className || `ka-btn ${tone === 'danger' ? 'ka-btn--danger' : 'ka-btn--primary'}`} min-h-11`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`ka-dialog__icon ${tone === 'danger' ? '' : 'ka-dialog__icon--warning'} h-11 w-11 shrink-0`} aria-hidden="true">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <p className="break-words pt-2 text-[var(--ink-muted)]">{message}</p>
      </div>
    </Modal>
  );
}
