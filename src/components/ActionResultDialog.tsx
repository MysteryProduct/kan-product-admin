import Modal from '@/components/Modal';

type ActionResultDialogStatus = 'success' | 'error';
export type ActionResultDialogAction = 'insert' | 'update' | 'delete' | 'approve';

interface ActionResultDialogProps {
  isOpen: boolean;
  status: ActionResultDialogStatus;
  action: ActionResultDialogAction;
  onClose: () => void;
  message?: string;
  confirmText?: string;
}

const actionLabelMap: Record<ActionResultDialogAction, string> = {
  insert: 'เพิ่มข้อมูล',
  update: 'แก้ไขข้อมูล',
  delete: 'ลบข้อมูล',
  approve: 'อนุมัติรายการ',
};

export default function ActionResultDialog({
  isOpen,
  status,
  action,
  onClose,
  message,
  confirmText = 'ตกลง',
}: ActionResultDialogProps) {
  const isSuccess = status === 'success';
  const title = isSuccess ? 'ดำเนินการสำเร็จ' : 'ดำเนินการไม่สำเร็จ';
  const actionLabel = actionLabelMap[action];
  const defaultMessage = isSuccess ? `${actionLabel}สำเร็จ` : `${actionLabel}ไม่สำเร็จ`;
  const statusColor = isSuccess ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={actionLabel}
      size="sm"
      layer="elevated"
      footer={
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-[var(--color-primary)] px-5 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)]">
          {confirmText}
        </button>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] ${statusColor}`} aria-hidden="true">
          {isSuccess ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <p role={isSuccess ? 'status' : 'alert'} className="break-words whitespace-pre-line text-[var(--color-text-secondary)]">
          {message || defaultMessage}
        </p>
      </div>
    </Modal>
  );
}
