'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import axiosInstance from '@/lib/axios';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import type { PurchaseOrder } from '@/types/purchase-order';
import { usePermissions } from '@/hooks/usePermissions';
import useVatRate from '@/hooks/useVatRate';
import { usePageCrumb } from '@/lib/page-crumb';
import { getApiErrorMessage } from '@/lib/api-error';
import CancellationDialog from '@/components/CancellationDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import DocumentHistoryPanel from '@/components/document-history/DocumentHistoryPanel';
import { formatBaht } from '../../purchase-orders/lib/po-display';
import { Receipt, receiptStatusLabel, receiptStatusTone, receiptVatSummary } from '../lib/pr-display';

const purchaseReceiptModel = new PurchaseReceiptModel();
const BASE = '/admin/purchase-receipt';

interface Props {
  receipt: Receipt;
  order: PurchaseOrder | null;
  /** Reloads the receipt after it was approved or cancelled. */
  onChanged: () => void;
}

export default function ReceiptDetail({ receipt, onChanged }: Props) {
  const router = useRouter();
  const toast = useToast();
  const vatRate = useVatRate();
  const { can } = usePermissions();
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const id = receipt.purchase_receipt_id;
  const code = receipt.purchase_receipt_code ?? '';
  const status = receipt.purchase_receipt_status;
  usePageCrumb({ back: { label: 'ใบรับสินค้า', href: BASE }, current: code });
  const vat = receiptVatSummary(receipt, vatRate);

  const changed = () => {
    setHistoryKey((key) => key + 1);
    onChanged();
  };

  const approve = async () => {
    setConfirmApprove(false);
    try {
      const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      await purchaseReceiptModel.approvePurchaseReceipt(id, user.employee_id);
      toast({ message: `อนุมัติใบรับสินค้า ${code} แล้ว`, tone: 'success' });
      changed();
    } catch (error) {
      toast({ message: `อนุมัติ ${code} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    try {
      await purchaseReceiptModel.deletePurchaseReceipt(id);
      toast({ message: `ลบใบรับสินค้า ${code} แล้ว`, tone: 'success' });
      router.push(BASE);
    } catch (error) {
      toast({ message: `ลบ ${code} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    }
  };

  return (
    <div className="ka-page-body ka-po">
      <span className="ka-po-code">{code}</span>
      <StatusBadge tone={receiptStatusTone(status)}>{receiptStatusLabel(status)}</StatusBadge>
      <p className="ka-po-big numeric">{formatBaht(vat.total)}</p>
      <div className="ka-po-ph__acts">
        {status === 'pending' && can('purchase_receipt', 'approve') && (
          <button type="button" className="ka-btn ka-btn--primary" onClick={() => setConfirmApprove(true)}>อนุมัติ</button>
        )}
        {status === 'pending' && can('purchase_receipt', 'edit') && <Link href={`${BASE}/${id}/edit`} className="ka-btn">แก้ไข</Link>}
        {status === 'pending' && can('purchase_receipt', 'delete') && (
          <button type="button" className="ka-btn" onClick={() => setConfirmDelete(true)}>ลบ</button>
        )}
        {(status === 'pending' || status === 'approved') && can('purchase_receipt', 'reject') && (
          <button type="button" className="ka-btn ka-btn--danger" onClick={() => setRejecting(true)}>ยกเลิกเอกสาร</button>
        )}
      </div>
      <DocumentHistoryPanel key={historyKey} endpoint={`/purchase-receipt/${id}/history`} variant="timeline" />
      <ConfirmDialog
        isOpen={confirmApprove}
        title="อนุมัติใบรับสินค้า"
        message={`อนุมัติ ${code} แล้วสต็อกวัตถุดิบจะเพิ่มตามจำนวนที่รับ`}
        confirmLabel="อนุมัติ"
        cancelLabel="ยังไม่อนุมัติ"
        tone="neutral"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => void approve()}
      />
      <ConfirmDialog
        isOpen={confirmDelete}
        title="ลบใบรับสินค้า"
        message={`ลบ ${code} ลบแล้วกู้คืนไม่ได้`}
        confirmLabel="ลบใบรับสินค้า"
        cancelLabel="ไม่ลบ"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
      {rejecting && (
        <CancellationDialog
          title={`ยกเลิกใบรับสินค้า ${code}`}
          onClose={() => setRejecting(false)}
          onConfirm={async (reason) => {
            await axiosInstance.post(`/purchase-receipt/${id}/reject`, { reason });
            toast({ message: `ยกเลิกใบรับสินค้า ${code} แล้ว`, tone: 'success' });
            changed();
          }}
        />
      )}
    </div>
  );
}
