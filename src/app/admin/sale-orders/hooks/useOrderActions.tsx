'use client';

import { useCallback, useState, type ReactNode } from 'react';
import Cookies from 'js-cookie';
import axiosInstance from '@/lib/axios';
import SaleOrderModel from '@/models/sale-order';
import type { SaleOrder } from '@/types/sale-order';
import { getApiErrorMessage } from '@/lib/api-error';
import CancellationDialog from '@/components/CancellationDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import InsertPaymentReceiptForm from '@/app/admin/payment-receipts/components/insert';
import { formatBaht, payable } from '../lib/so-display';

const saleOrderModel = new SaleOrderModel();

export type OrderAction = 'approve' | 'cancel' | 'delete' | 'pay';

interface Options {
  /** After approve, cancel or a payment: reload what is on screen. */
  onChanged: () => void;
  /** After a delete: the order no longer exists. */
  onDeleted: (order: SaleOrder) => void;
}

/**
 * The commands the list and the detail page share. `request` opens the matching dialog; `dialogs` is
 * drawn once by the page. Results come back as toasts, so the page stays where it is.
 */
export function useOrderActions({ onChanged, onDeleted }: Options): {
  request: (action: OrderAction, order: SaleOrder) => void;
  busy: OrderAction | null;
  dialogs: ReactNode;
} {
  const toast = useToast();
  const [pending, setPending] = useState<{ action: OrderAction; order: SaleOrder } | null>(null);
  const [busy, setBusy] = useState<OrderAction | null>(null);

  const request = useCallback((action: OrderAction, order: SaleOrder) => setPending({ action, order }), []);
  const close = () => setPending(null);

  const label = (order: SaleOrder) => order.sale_order_code ?? order.sale_order_name;

  const approve = async (order: SaleOrder) => {
    close();
    setBusy('approve');
    try {
      const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      await saleOrderModel.approveSaleOrder(order.sale_order_id, user.employee_id);
      toast({ message: `อนุมัติใบสั่งขาย ${label(order)} แล้ว ตัดสต็อกเรียบร้อย`, tone: 'success' });
      onChanged();
    } catch (error) {
      toast({ message: `อนุมัติ ${label(order)} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (order: SaleOrder) => {
    close();
    setBusy('delete');
    try {
      await saleOrderModel.deleteSaleOrder(order.sale_order_id);
      toast({ message: `ลบใบสั่งขาย ${label(order)} แล้ว`, tone: 'success' });
      onDeleted(order);
    } catch (error) {
      toast({ message: `ลบ ${label(order)} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const order = pending?.order ?? null;
  return {
    request,
    busy,
    dialogs: (
      <>
        <ConfirmDialog
          isOpen={pending?.action === 'approve'}
          title="อนุมัติใบสั่งขาย"
          message={`อนุมัติ ${order ? label(order) : ''} “${order?.sale_order_name ?? ''}” ยอด ${order ? formatBaht(payable(order)) : ''} ระบบจะตัดสต็อกตามจำนวนที่จองไว้ และแก้ไขใบนี้ไม่ได้อีก`}
          confirmLabel="อนุมัติและตัดสต็อก"
          cancelLabel="ยังไม่อนุมัติ"
          tone="neutral"
          bottom_className="ka-btn ka-btn--primary min-h-11"
          onCancel={close}
          onConfirm={() => order && void approve(order)}
        />
        <ConfirmDialog
          isOpen={pending?.action === 'delete'}
          title="ลบใบสั่งขาย"
          message={`ลบ ${order ? label(order) : ''} “${order?.sale_order_name ?? ''}” และคืนยอดจองสินค้า ลบแล้วกู้คืนไม่ได้`}
          confirmLabel="ลบใบสั่งขาย"
          cancelLabel="ไม่ลบ"
          onCancel={close}
          onConfirm={() => order && void remove(order)}
        />
        {pending?.action === 'cancel' && order && (
          <CancellationDialog
            title={`ยกเลิกใบสั่งขาย ${label(order)}`}
            onClose={close}
            onConfirm={async (reason) => {
              await axiosInstance.post(`/sale-order/${order.sale_order_id}/cancel`, { reason });
              toast({ message: `ยกเลิกใบสั่งขาย ${label(order)} แล้ว คืนยอดจองแล้ว`, tone: 'success' });
              onChanged();
            }}
          />
        )}
        <InsertPaymentReceiptForm
          isOpen={pending?.action === 'pay'}
          saleOrder={pending?.action === 'pay' ? order : null}
          onClose={close}
          onSuccess={onChanged}
        />
      </>
    ),
  };
}
