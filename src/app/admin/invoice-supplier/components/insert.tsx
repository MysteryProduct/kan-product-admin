'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { PurchaseReceipt } from '@/types/purchase-receipt';
import { VAT_TYPE_LABELS } from '@/lib/vat';
import { toLocalIsoDate, todayLocalIso } from '@/lib/date-format';
import {
    InvoicePaymentItem,
    InvoiceSupplierFormPayload,
    InvoiceSupplierPayment,
    INVOICE_PAYMENT_METHOD_LABELS,
    INVOICE_PAYMENT_METHOD_OPTIONS,
    INVOICE_STATUS_OPTIONS,
} from '@/types/invoice-supplier';

interface InsertInvoiceSupplierFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: InvoiceSupplierFormPayload) => void;
    sourceReceipt: PurchaseReceipt | null;
    availablePayments: InvoiceSupplierPayment[];
}

const INPUT_CLASSNAME = 'ka-input h-11 w-full';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('th-TH', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

const todayIso = todayLocalIso;

const plusDaysIso = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toLocalIsoDate(date);
};

export default function InsertInvoiceSupplierForm({
    isOpen,
    onClose,
    onSubmit,
    sourceReceipt,
    availablePayments,
}: InsertInvoiceSupplierFormProps) {
    const [invoiceName, setInvoiceName] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(todayIso());
    const [invoiceDueDate, setInvoiceDueDate] = useState(plusDaysIso(30));
    const [invoiceStatus, setInvoiceStatus] = useState<'pending' | 'partial' | 'paid' | 'cancelled'>('pending');
    const [invoiceDetail, setInvoiceDetail] = useState('');
    const [invoicePayments, setInvoicePayments] = useState<InvoicePaymentItem[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const invoiceTotal = Number(sourceReceipt?.purchase_receipt_total || 0);

    const paidTotal = useMemo(
        () => invoicePayments.reduce((sum, item) => sum + Number(item.invoice_payment_price || 0), 0),
        [invoicePayments],
    );

    useEffect(() => {
        if (!isOpen || !sourceReceipt) {
            return;
        }

        setInvoiceName(sourceReceipt.supplier?.supplier_name ? `ใบชำระหนี้ ${sourceReceipt.supplier.supplier_name}` : 'ใบชำระหนี้');
        setInvoiceDate(todayIso());
        setInvoiceDueDate(plusDaysIso(30));
        setInvoiceStatus('pending');
        setInvoiceDetail(sourceReceipt.purchase_receipt_detail || '');

        if (availablePayments.length > 0) {
            setInvoicePayments([
                {
                    invoice_payment_id: crypto.randomUUID(),
                    payment_method: 'bank',
                    payment_id: availablePayments[0].payment_id,
                    invoice_payment_price: invoiceTotal,
                },
            ]);
        } else {
            setInvoicePayments([
                {
                    invoice_payment_id: crypto.randomUUID(),
                    payment_method: 'cash',
                    invoice_payment_price: invoiceTotal,
                },
            ]);
        }

        setErrors({});
    }, [isOpen, sourceReceipt, availablePayments, invoiceTotal]);

    if (!isOpen || !sourceReceipt) {
        return null;
    }

    const addPaymentRow = () => {
        setInvoicePayments((prev) => [
            ...prev,
            {
                invoice_payment_id: crypto.randomUUID(),
                payment_method: availablePayments.length > 0 ? 'bank' : 'cash',
                payment_id: availablePayments[0]?.payment_id,
                invoice_payment_price: 0,
            },
        ]);
    };

    const removePaymentRow = (id: string) => {
        setInvoicePayments((prev) => prev.filter((item) => item.invoice_payment_id !== id));
    };

    const updatePaymentRow = (id: string, updater: (prev: InvoicePaymentItem) => InvoicePaymentItem) => {
        setInvoicePayments((prev) => prev.map((item) => (item.invoice_payment_id === id ? updater(item) : item)));
    };

    const validate = () => {
        const nextErrors: Record<string, string> = {};

        if (!invoiceName.trim()) {
            nextErrors.invoice_supplier_name = 'กรุณาระบุชื่อเอกสาร';
        }
        if (!invoiceDate) {
            nextErrors.invoice_supplier_date = 'กรุณาเลือกวันที่เอกสาร';
        }
        if (!invoiceDueDate) {
            nextErrors.invoice_supplier_due_date = 'กรุณาเลือกวันที่ครบกำหนด';
        }
        if (invoicePayments.length === 0) {
            nextErrors.invoice_payments = 'กรุณาเพิ่มรายการชำระอย่างน้อย 1 รายการ';
        }

        invoicePayments.forEach((payment, index) => {
            if (payment.invoice_payment_price <= 0) {
                nextErrors[`invoice_payment_price_${index}`] = 'ยอดชำระต้องมากกว่า 0';
            }
            if (payment.payment_method === 'bank' && !payment.payment_id) {
                nextErrors[`payment_id_${index}`] = 'กรุณาเลือกบัญชีธนาคาร';
            }
        });

        if (paidTotal > invoiceTotal) {
            nextErrors.invoice_payments = 'ยอดชำระรวมมากกว่ายอดใบชำระหนี้';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!validate()) {
            return;
        }

        onSubmit({
            invoice_supplier_name: invoiceName.trim(),
            invoice_supplier_date: invoiceDate,
            invoice_supplier_due_date: invoiceDueDate,
            invoice_supplier_status: invoiceStatus,
            invoice_supplier_detail: invoiceDetail.trim(),
            invoicePayments,
            supplier_id: sourceReceipt.supplier_id,
            invoice_supplier_total: invoiceTotal,
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="เพิ่มใบชำระหนี้ผู้จัดจำหน่าย"
            size="xl"
            footer={
                <>
                    <button type="button" onClick={onClose} className="ka-btn h-11">
                        ยกเลิก
                    </button>
                    <button type="submit" form="invoice-supplier-insert-form" className="ka-btn ka-btn--primary h-11">
                        บันทึกใบชำระหนี้
                    </button>
                </>
            }
        >
            <form id="invoice-supplier-insert-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                    <h3 className="mb-3 text-base font-semibold text-[var(--ink)]">ข้อมูลที่ดึงจากใบรับสินค้า (ค่าเริ่มต้น)</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <p className="text-sm text-[var(--ink-muted)]">ใบรับสินค้า: <span className="font-semibold text-[var(--ink)]">{sourceReceipt.purchase_receipt_code || '-'}</span></p>
                        <p className="text-sm text-[var(--ink-muted)]">Supplier: <span className="font-semibold text-[var(--ink)]">{sourceReceipt.supplier?.supplier_name || '-'}</span></p>
                        <p className="text-sm text-[var(--ink-muted)]">VAT: <span className="font-semibold text-[var(--ink)]">{VAT_TYPE_LABELS[sourceReceipt.vat_type || 'none']}</span></p>
                        <p className="text-sm text-[var(--ink-muted)]">ยอดรวม: <span className="font-semibold text-[var(--ink)]">฿{formatCurrency(invoiceTotal)}</span></p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-[var(--ink)]">ชื่อเอกสาร</label>
                        <input value={invoiceName} onChange={(event) => setInvoiceName(event.target.value)} className={INPUT_CLASSNAME} />
                        {errors.invoice_supplier_name && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.invoice_supplier_name}</p>}
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-[var(--ink)]">วันที่เอกสาร</label>
                        <input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className={INPUT_CLASSNAME} />
                        {errors.invoice_supplier_date && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.invoice_supplier_date}</p>}
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-[var(--ink)]">วันที่ครบกำหนด</label>
                        <input type="date" value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} className={INPUT_CLASSNAME} />
                        {errors.invoice_supplier_due_date && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.invoice_supplier_due_date}</p>}
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-[var(--ink)]">สถานะเอกสาร</label>
                        <select value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value as 'pending' | 'partial' | 'paid' | 'cancelled')} className={INPUT_CLASSNAME}>
                            {INVOICE_STATUS_OPTIONS.map((status) => (
                                <option key={status.value} value={status.value}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-[var(--ink)]">ยอดใบชำระหนี้</label>
                        <div className="h-11 rounded-xl border border-[var(--border-control)] bg-[var(--bg-muted)] px-3 text-sm leading-[44px] text-[var(--ink)]">
                            ฿{formatCurrency(invoiceTotal)}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-semibold text-[var(--ink)]">รายละเอียดเพิ่มเติม</label>
                    <textarea
                        rows={3}
                        value={invoiceDetail}
                        onChange={(event) => setInvoiceDetail(event.target.value)}
                        className="ka-textarea w-full"
                        placeholder="หมายเหตุเพิ่มเติม"
                    />
                </div>

                <div className="rounded-2xl border border-[var(--border)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-[var(--ink)]">Invoice Payment (ชำระได้หลายครั้ง)</h3>
                        <button type="button" onClick={addPaymentRow} className="ka-btn ka-btn--primary min-h-11 h-10">
                            เพิ่มรายการชำระ
                        </button>
                    </div>

                    <div className="space-y-3">
                        {invoicePayments.map((payment, index) => (
                            <div key={payment.invoice_payment_id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                    <div>
                                        <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">วิธีชำระ</label>
                                        <select
                                            value={payment.payment_method}
                                            onChange={(event) => {
                                                const nextMethod = event.target.value as 'cash' | 'bank';
                                                updatePaymentRow(payment.invoice_payment_id, (prev) => ({
                                                    ...prev,
                                                    payment_method: nextMethod,
                                                    payment_id: nextMethod === 'bank' ? prev.payment_id || availablePayments[0]?.payment_id : undefined,
                                                }));
                                            }}
                                            className={INPUT_CLASSNAME}
                                        >
                                            {INVOICE_PAYMENT_METHOD_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">บัญชีธนาคาร</label>
                                        <select
                                            value={payment.payment_id || ''}
                                            onChange={(event) => updatePaymentRow(payment.invoice_payment_id, (prev) => ({ ...prev, payment_id: event.target.value }))}
                                            disabled={payment.payment_method !== 'bank'}
                                            className={`${INPUT_CLASSNAME} disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                            <option value="">เลือกบัญชี</option>
                                            {availablePayments.map((bank) => (
                                                <option key={bank.payment_id} value={bank.payment_id}>
                                                    {bank.bank_name} - {bank.account_number}
                                                </option>
                                            ))}
                                        </select>
                                        {errors[`payment_id_${index}`] && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors[`payment_id_${index}`]}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">ยอดชำระ</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min={0}
                                                value={payment.invoice_payment_price}
                                                onChange={(event) => {
                                                    const next = Number(event.target.value || 0);
                                                    updatePaymentRow(payment.invoice_payment_id, (prev) => ({ ...prev, invoice_payment_price: next }));
                                                }}
                                                className={INPUT_CLASSNAME}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removePaymentRow(payment.invoice_payment_id)}
                                                className="ka-btn ka-btn--danger h-11"
                                                disabled={invoicePayments.length <= 1}
                                            >
                                                ลบ
                                            </button>
                                        </div>
                                        {errors[`invoice_payment_price_${index}`] && <p className="mt-1 text-[13px] text-[var(--danger)]">{errors[`invoice_payment_price_${index}`]}</p>}
                                        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{INVOICE_PAYMENT_METHOD_LABELS[payment.payment_method]}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {errors.invoice_payments && <p className="mt-2 text-[13px] text-[var(--danger)]">{errors.invoice_payments}</p>}

                    <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-[var(--bg-muted)] p-3 text-sm sm:grid-cols-3">
                        <p className="text-[var(--ink)]">ยอดเอกสาร: <span className="font-semibold">฿{formatCurrency(invoiceTotal)}</span></p>
                        <p className="text-[var(--ink)]">ชำระแล้ว: <span className="font-semibold">฿{formatCurrency(paidTotal)}</span></p>
                        <p className="text-[var(--ink)]">คงเหลือ: <span className="font-semibold">฿{formatCurrency(Math.max(invoiceTotal - paidTotal, 0))}</span></p>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
