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
  if (!isOpen) return null;

  const title = status === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด';
  const actionLabel = actionLabelMap[action];
  const defaultMessage =
    status === 'success' ? `${actionLabel}สำเร็จ` : `${actionLabel}ไม่สำเร็จ`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-fadeIn">
        <div className="flex flex-col items-center gap-4">
          {status === 'success' ? (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          <h3 className={`text-xl font-semibold ${status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {title}
          </h3>

          <p className="text-gray-700 text-center">{message || defaultMessage}</p>

          <button
            onClick={onClose}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
              status === 'success'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}