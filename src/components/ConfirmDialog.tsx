import Modal from '@/components/Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  bottom_className?: string;
}

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'ยืนยันการดำเนินการ',
  message,
  bottom_className = '',
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      description="โปรดตรวจสอบข้อมูลก่อนยืนยัน"
      size="sm"
      footer={
        <>
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={bottom_className || 'min-h-11 rounded-lg bg-[var(--color-error)] px-4 py-2 font-medium text-white hover:opacity-90'}
          >
            ยืนยัน
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-error)]" aria-hidden="true">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <p className="break-words text-[var(--color-text-secondary)]">{message}</p>
      </div>
    </Modal>
  );
}
