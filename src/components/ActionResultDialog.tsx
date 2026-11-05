import type { ComponentProps, ReactNode } from 'react';
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
  /** The heading in place of "ดำเนินการสำเร็จ" / "ดำเนินการไม่สำเร็จ". */
  title?: string;
  /** Replaces the message text, for a result with a document number in it. */
  body?: ReactNode;
  size?: ComponentProps<typeof Modal>['size'];
  /** Replaces the × drawn for a failure. */
  errorIcon?: ReactNode;
  /** Extra classes on the dialog panel, for a page whose design draws its own result. */
  className?: string;
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
  title: titleText,
  body,
  size = 'sm',
  errorIcon,
  className,
}: ActionResultDialogProps) {
  const isSuccess = status === 'success';
  const title = titleText ?? (isSuccess ? 'ดำเนินการสำเร็จ' : 'ดำเนินการไม่สำเร็จ');
  const actionLabel = actionLabelMap[action];
  const defaultMessage = isSuccess ? `${actionLabel}สำเร็จ` : `${actionLabel}ไม่สำเร็จ`;
  const iconClass = isSuccess ? 'ka-dialog__icon--success' : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={actionLabel}
      size={size}
      className={className}
      layer="elevated"
      footer={
        <button type="button" onClick={onClose} className="ka-btn ka-btn--primary min-h-11 px-5">
          {confirmText}
        </button>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`ka-dialog__icon h-12 w-12 shrink-0 ${iconClass}`} aria-hidden="true">
          {isSuccess ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path className="ka-check-draw" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m5 13 4 4L19 7" />
            </svg>
          ) : (
            errorIcon ?? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
              </svg>
            )
          )}
        </div>
        <p role={isSuccess ? 'status' : 'alert'} className="break-words whitespace-pre-line pt-2.5 text-[var(--ink-muted)]">
          {body ?? (message || defaultMessage)}
        </p>
      </div>
    </Modal>
  );
}
