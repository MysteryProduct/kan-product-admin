'use client';

import React from 'react';
import Cookies from 'js-cookie';
import { SaleOrder, SaleOrderList } from '@/types/sale-order';
import { usePermissions } from '@/hooks/usePermissions';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import SaleOrderModel from '@/models/sale-order';
import { calculateVatSummary, VAT_TYPE_LABELS } from '@/lib/vat';
import useVatRate from '@/hooks/useVatRate';

interface SaleOrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    saleOrder: SaleOrder;
}

const saleOrderModel = new SaleOrderModel();

export default function SaleOrderDetailModal({ isOpen, onClose, onSuccess, saleOrder }: SaleOrderDetailModalProps) {
    const vatRate = useVatRate();
    const { can } = usePermissions();
    const canApproveSaleOrder = can('sale_order', 'approve');

    const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
    const [resultDialog, setResultDialog] = React.useState<{
        isOpen: boolean;
        status: 'success' | 'error';
        action: ActionResultDialogAction;
        message: string;
    }>({
        isOpen: false,
        status: 'success',
        action: 'approve',
        message: '',
    });

    const items: SaleOrderList[] = saleOrder.saleOrderLists || [];

    const calculateItemTotal = (item: SaleOrderList) => {
        if (typeof item.sale_order_list_total === 'number') {
            return item.sale_order_list_total;
        }
        return Number(item.sale_order_list_qty) * Number(item.sale_order_list_price);
    };

    const grandTotal =
        saleOrder.sale_order_total || items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const vatSummary = calculateVatSummary(grandTotal, saleOrder.vat_type || 'none', vatRate);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);

    const statusLabels: Record<string, string> = {
        pending: 'รอดำเนินการ',
        approved: 'อนุมัติแล้ว',
        partial: 'ชำระบางส่วน',
        paid: 'ชำระครบแล้ว',
        cancelled: 'ยกเลิกแล้ว',
        partially_returned: 'คืนสินค้าบางส่วน',
        returned: 'คืนสินค้าทั้งหมด',
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        approved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
        paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        partially_returned: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
        returned: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };

    const typeLabels: Record<string, string> = {
        online: 'ขายบนเว็บไซต์',
        order: 'ขายจากการสั่งซื้อ',
    };

    async function handleApprove() {
        try {
            const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
            if (!user) throw new Error('User not authenticated');
            await saleOrderModel.approveSaleOrder(saleOrder.sale_order_id, user.employee_id);
            setResultDialog({ isOpen: true, status: 'success', action: 'approve', message: 'อนุมัติใบขายสินค้าสำเร็จ' });
        } catch (error) {
            setResultDialog({
                isOpen: true,
                status: 'error',
                action: 'approve',
                message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอนุมัติใบขายสินค้า',
            });
        }
    }

    const handleResultDialogClose = () => {
        const isSuccess = resultDialog.status === 'success';
        setResultDialog((prev) => ({ ...prev, isOpen: false }));
        if (isSuccess) {
            onSuccess?.();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-300/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-[var(--color-bg-primary)] overlay-surface ">
                <div className="bg-[var(--color-primary)] px-6 py-5 ">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-2xl font-bold text-white">รายละเอียดใบขายสินค้า</h2>
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-white/60 bg-white/15 p-2 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                            type="button"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="max-h-[calc(90vh-160px)] overflow-y-auto p-6">
                    {/* Info Section */}
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รหัสใบขายสินค้า</label>
                            <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                {saleOrder.sale_order_code || saleOrder.sale_order_id}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">ชื่อใบขายสินค้า</label>
                            <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                {saleOrder.sale_order_name}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">ประเภท</label>
                            <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                {typeLabels[saleOrder.sale_order_type || ''] || saleOrder.sale_order_type || '-'}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รูปแบบ VAT</label>
                            <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                {VAT_TYPE_LABELS[saleOrder.vat_type || 'none']}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">สถานะ</label>
                            <div className="flex min-h-[44px] items-center rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 shadow-sm dark:border-gray-600 dark:bg-gray-700">
                                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusColors[saleOrder.sale_order_status] || 'bg-gray-100 text-gray-800'}`}>
                                    {statusLabels[saleOrder.sale_order_status] || saleOrder.sale_order_status}
                                </span>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">ที่อยู่จัดส่ง</label>
                            <div className="min-h-[76px] whitespace-pre-line rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                {saleOrder.shipping_address_name || '-'}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รายละเอียด</label>
                            <div className="min-h-[60px] whitespace-pre-line rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                {saleOrder.sale_order_detail || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Items Section */}
                    <h3 className="mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">รายการสินค้า</h3>
                    <div className="space-y-3">
                        {items.length > 0 ? (
                            items.map((item, index) => (
                                <div
                                    key={item.sale_order_list_id || `${item.product_name}-${index}`}
                                    className="rounded-2xl border border-gray-200 bg-[var(--color-bg-secondary)] from-white p-4 dark:border-gray-700 "
                                >
                                    <div className="mb-3 flex items-center gap-2">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                            {index + 1}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ชื่อสินค้า</label>
                                            <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                                {item.product_name || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">จำนวน</label>
                                            <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                                {item.sale_order_list_qty}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ราคา/หน่วย</label>
                                            <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                                ฿{formatCurrency(Number(item.sale_order_list_price))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ยอดรวม</label>
                                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                ฿{formatCurrency(calculateItemTotal(item))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400">
                                ไม่พบรายการสินค้า
                            </div>
                        )}
                    </div>

                    {/* VAT Summary */}
                    <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 text-[var(--color-text-primary)]">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm md:text-base">
                                <span>ยอดก่อน VAT</span>
                                <span>฿{formatCurrency(vatSummary.subtotal)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm md:text-base">
                                <span>VAT {vatRate}% ({VAT_TYPE_LABELS[saleOrder.vat_type || 'none']})</span>
                                <span>฿{formatCurrency(vatSummary.vatAmount)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                                <span className="text-lg font-semibold">ยอดรวมทั้งสิ้น</span>
                                <span className="text-2xl font-bold">฿{formatCurrency(vatSummary.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="mt-6 flex gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border-2 border-gray-200 bg-gray-100 px-6 py-3.5 font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            ปิด
                        </button>
                        {canApproveSaleOrder && saleOrder.sale_order_status === 'pending' && (
                            <button
                                type="button"
                                onClick={() => setShowConfirmDialog(true)}
                                className="flex-1 rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)] px-6 py-3.5 font-semibold text-white transition-all hover:border-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)]"
                            >
                                อนุมัติ
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showConfirmDialog && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="ยืนยันการอนุมัติ"
                    message="คุณแน่ใจหรือไม่ว่าต้องการอนุมัติใบขายสินค้านี้?"
                    onConfirm={handleApprove}
                    onCancel={() => setShowConfirmDialog(false)}
                    bottom_className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] transition-all font-semibold border-2 border-[var(--color-primary)] hover:border-[var(--color-primary-hover)]"
                />
            )}

            <ActionResultDialog
                isOpen={resultDialog.isOpen}
                status={resultDialog.status}
                action={resultDialog.action}
                message={resultDialog.message}
                onClose={handleResultDialogClose}
            />
        </div>
    );
}
