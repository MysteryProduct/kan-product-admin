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
import DocumentHistoryPanel from '@/components/document-history/DocumentHistoryPanel';
import DocumentCancellationAction from '@/components/DocumentCancellationAction';
import { SALE_ORDER_STATUS_TONE } from '@/lib/status-tones';
import StatusBadge from '@/components/StatusBadge';

interface SaleOrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    saleOrder: SaleOrder;
}

const saleOrderModel = new SaleOrderModel();

export default function SaleOrderDetailModal({ isOpen, onClose, onSuccess, saleOrder }: SaleOrderDetailModalProps) {
    const settingsVatRate = useVatRate();
    const { can } = usePermissions();
    const canApproveSaleOrder = can('sale_orders', 'approve');

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
    // The order's own rate and amounts as the API booked them (TASK-0038): a
    // later change to the VAT setting must not re-price an order already
    // written, and a Store order's total includes its shipping.
    const vatRate =
        saleOrder.vat_rate !== undefined && saleOrder.vat_rate !== null
            ? Number(saleOrder.vat_rate)
            : settingsVatRate;
    const computedVat = calculateVatSummary(grandTotal, saleOrder.vat_type || 'none', vatRate);
    const vatSummary =
        saleOrder.sale_order_subtotal !== undefined && saleOrder.sale_order_vat_amount !== undefined
            ? {
                  ...computedVat,
                  subtotal: Number(saleOrder.sale_order_subtotal) - Number(saleOrder.sale_order_vat_amount),
                  vatAmount: Number(saleOrder.sale_order_vat_amount),
                  total: Number(saleOrder.sale_order_subtotal),
              }
            : computedVat;
    const shippingFee = Number(saleOrder.sale_order_shipping_fee ?? 0);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm">
            <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-[var(--color-bg-primary)] overlay-surface">
                <div className="border-b border-[var(--border)] px-6 py-5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-2xl font-bold text-[var(--ink)]">รายละเอียดใบขายสินค้า</h2>
                        <button
                            onClick={onClose}
                            aria-label="ปิดหน้าต่าง"
                            className="ka-btn ka-btn--icon"
                            type="button"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <DocumentHistoryPanel endpoint={`/sale-order/${saleOrder.sale_order_id}/history`} />
                    {can('sale_orders', 'reject') && ['pending'].includes(saleOrder.sale_order_status) && <DocumentCancellationAction endpoint={`/sale-order/${saleOrder.sale_order_id}/cancel`} onSuccess={() => { onSuccess?.(); onClose(); }} />}
                </div>

                <div className="max-h-[calc(90vh-160px)] overflow-y-auto p-6">
                    {/* Info Section */}
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รหัสใบขายสินค้า</label>
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
                                {saleOrder.sale_order_code || saleOrder.sale_order_id}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">ชื่อใบขายสินค้า</label>
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
                                {saleOrder.sale_order_name}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">ประเภท</label>
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
                                {typeLabels[saleOrder.sale_order_type || ''] || saleOrder.sale_order_type || '-'}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รูปแบบ VAT</label>
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
                                {VAT_TYPE_LABELS[saleOrder.vat_type || 'none']}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">สถานะ</label>
                            <div className="flex min-h-[44px] items-center rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 shadow-sm">
                                <StatusBadge tone={SALE_ORDER_STATUS_TONE[saleOrder.sale_order_status]}>{statusLabels[saleOrder.sale_order_status] || saleOrder.sale_order_status}</StatusBadge>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">ที่อยู่จัดส่ง</label>
                            <div className="min-h-[76px] whitespace-pre-line rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
                                {saleOrder.shipping_address_name || '-'}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รายละเอียด</label>
                            <div className="min-h-[60px] whitespace-pre-line rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
                                {saleOrder.sale_order_detail || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Items Section */}
                    <h3 className="mb-3 text-base font-semibold text-[var(--ink)]">รายการสินค้า</h3>
                    <div className="space-y-3">
                        {items.length > 0 ? (
                            items.map((item, index) => (
                                <div
                                    key={item.sale_order_list_id || `${item.product_name}-${index}`}
                                    className="rounded-2xl border border-[var(--border)] bg-[var(--color-bg-secondary)] p-4"
                                >
                                    <div className="mb-3 flex items-center gap-2">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand-ink)]">
                                            {index + 1}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                        <div>
                                            <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">ชื่อสินค้า</label>
                                            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--ink)]">
                                                {item.product_name || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">จำนวน</label>
                                            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--ink)]">
                                                {item.sale_order_list_qty}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">ราคา/หน่วย</label>
                                            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--ink)]">
                                                ฿{formatCurrency(Number(item.sale_order_list_price))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">ยอดรวม</label>
                                            <div className="rounded-xl border border-[var(--brand-soft)] bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-ink)]">
                                                ฿{formatCurrency(calculateItemTotal(item))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-6 text-center text-[var(--ink-muted)]">
                                ไม่พบรายการสินค้า
                            </div>
                        )}
                    </div>

                    {/* VAT Summary */}
                    <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 text-[var(--color-text-primary)]">
                        <div className="space-y-2">
                            {shippingFee > 0 && (
                                <>
                                    <div className="flex items-center justify-between text-sm md:text-base">
                                        <span>ยอดสินค้า</span>
                                        <span>฿{formatCurrency(Number(grandTotal) - shippingFee)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm md:text-base">
                                        <span>ค่าจัดส่ง (รวม VAT)</span>
                                        <span>฿{formatCurrency(shippingFee)}</span>
                                    </div>
                                </>
                            )}
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
                    <div className="mt-6 flex gap-3 border-t border-[var(--border)] pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="ka-btn flex-1"
                        >
                            ปิด
                        </button>
                        {canApproveSaleOrder && saleOrder.sale_order_status === 'pending' && (
                            <button
                                type="button"
                                onClick={() => setShowConfirmDialog(true)}
                                className="ka-btn ka-btn--primary min-h-11 flex-1"
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
                    bottom_className="ka-btn ka-btn--primary min-h-11"
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
