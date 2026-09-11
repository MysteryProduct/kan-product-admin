'use client';

import Modal from '@/components/Modal';
import { BankAccount } from '@/types/bank-account';

interface BankAccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccount: BankAccount;
}

export default function BankAccountDetailModal({ isOpen, onClose, bankAccount }: BankAccountDetailModalProps) {
  const details = [
    ['รหัสบัญชี', bankAccount.account_id],
    ['เลขที่บัญชี', bankAccount.account_number],
    ['ชื่อบัญชี', bankAccount.account_name],
    ['ธนาคาร', bankAccount.bank_name],
    ['สาขา', bankAccount.branch_name || '-'],
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="รายละเอียดบัญชีรับเงิน"
      description="ข้อมูลบัญชีที่ใช้รับชำระเงิน"
      size="md"
      footer={
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-[var(--color-primary)] px-5 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)]">
          ปิด
        </button>
      }
    >
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {details.map(([label, value], index) => (
          <div key={label} className={`rounded-xl bg-[var(--color-bg-secondary)] p-4 ${index === details.length - 1 ? 'sm:col-span-2' : ''}`}>
            <dt className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold text-[var(--color-text-primary)]">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
