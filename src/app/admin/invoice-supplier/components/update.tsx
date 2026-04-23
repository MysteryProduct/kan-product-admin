'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    InvoicePaymentItem,
    InvoiceSupplierFormPayload,
    InvoiceSupplierRow,
    INVOICE_PAYMENT_METHOD_LABELS,
    INVOICE_PAYMENT_METHOD_OPTIONS,
    INVOICE_STATUS_OPTIONS,
} from '@/types/invoice-supplier';

interface UpdateInvoiceSupplierFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: InvoiceSupplierFormPayload) => void;
    invoice: InvoiceSupplierRow | null;
}

const INPUT_CLASSNAME =
    'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('th-TH', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

export default function UpdateInvoiceSupplierForm({ isOpen, onClose, onSubmit, invoice }: UpdateInvoiceSupplierFormProps) {
    const [invoiceCode, setInvoiceCode] = useState('');
    const [invoiceName, setInvoiceName] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [invoiceDueDate, setInvoiceDueDate] = useState('');
    const [invoiceStatus, setInvoiceStatus] = useState<'pending' | 'partial' | 'paid' | 'cancelled'>('pending');
    const [invoiceDetail, setInvoiceDetail] = useState('');
    const [invoicePayments, setInvoicePayments] = useState<InvoicePaymentItem[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const invoiceTotal = Number(invoice?.invoice_supplier_total || 0);

    const paidTotal = useMemo(
        () => invoicePayments.reduce((sum, item) => sum + Number(item.invoice_payment_price || 0), 0),
        [invoicePayments],
    );

    useEffect(() => {
        if (!isOpen || !invoice) {
            return;
        }

        const availablePaymentsList = invoice.availablePayments || [];
        const existingPayments = invoice.invoicePayments || [];

        setInvoiceCode(invoice.invoice_supplier_code);
        setInvoiceName(invoice.invoice_supplier_name);
        setInvoiceDate(invoice.invoice_supplier_date.slice(0, 10));
        setInvoiceDueDate(invoice.invoice_supplier_due_date.slice(0, 10));
        setInvoiceStatus(invoice.invoice_supplier_status);
        setInvoiceDetail(invoice.invoice_supplier_detail || '');
        setInvoicePayments(
            existingPayments.length > 0
                ? existingPayments
                : [
                    {
                        invoice_payment_id: crypto.randomUUID(),
                        payment_method: availablePaymentsList.length > 0 ? 'bank' : 'cash',
                        payment_id: availablePaymentsList[0]?.payment_id,
                        invoice_payment_price: invoice.invoice_supplier_total,
                    },
                ],
        );
        setErrors({});
    }, [isOpen, invoice]);

    if (!isOpen || !invoice) {
        return null;
    }

    const invoiceAvailablePayments = invoice.availablePayments || [];

    const addPaymentRow = () => {
        setInvoicePayments((prev) => [
            ...prev,
            {
                invoice_payment_id: crypto.randomUUID(),
                payment_method: invoiceAvailablePayments.length > 0 ? 'bank' : 'cash',
                payment_id: invoiceAvailablePayments[0]?.payment_id,
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

        if (!invoiceCode.trim()) {
            nextErrors.invoice_supplier_code = 'กรุณาระบุเลขที่ใบชำระหนี้';
        }
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
            invoice_supplier_code: invoiceCode.trim(),
            invoice_supplier_name: invoiceName.trim(),
            invoice_supplier_date: invoiceDate,
            invoice_supplier_due_date: invoiceDueDate,
            invoice_supplier_status: invoiceStatus,
            invoice_supplier_detail: invoiceDetail.trim(),
            invoicePayments,
            supplier_id: invoice.supplier_id,
            invoice_supplier_total: invoiceTotal,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
            <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-xl font-bold sm:text-2xl">แก้ไขใบชำระหนี้ผู้จัดจำหน่าย</h2>
                        <button type="button" onClick={onClose} className="rounded-lg p-2 transition hover:bg-white/20" aria-label="close">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">เลขที่ใบชำระหนี้</label>
                            <input value={invoiceCode} onChange={(event) => setInvoiceCode(event.target.value)} className={INPUT_CLASSNAME} />
                            {errors.invoice_supplier_code && <p className="mt-1 text-xs text-rose-500">{errors.invoice_supplier_code}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">ชื่อเอกสาร</label>
                            <input value={invoiceName} onChange={(event) => setInvoiceName(event.target.value)} className={INPUT_CLASSNAME} />
                            {errors.invoice_supplier_name && <p className="mt-1 text-xs text-rose-500">{errors.invoice_supplier_name}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">วันที่เอกสาร</label>
                            <input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className={INPUT_CLASSNAME} />
                            {errors.invoice_supplier_date && <p className="mt-1 text-xs text-rose-500">{errors.invoice_supplier_date}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">วันที่ครบกำหนด</label>
                            <input type="date" value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} className={INPUT_CLASSNAME} />
                            {errors.invoice_supplier_due_date && <p className="mt-1 text-xs text-rose-500">{errors.invoice_supplier_due_date}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">สถานะเอกสาร</label>
                            <select value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value as 'pending' | 'partial' | 'paid' | 'cancelled')} className={INPUT_CLASSNAME}>
                                {INVOICE_STATUS_OPTIONS.map((status) => (
                                    <option key={status.value} value={status.value}>
                                        {status.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">ยอดใบชำระหนี้</label>
                            <div className="h-11 rounded-xl border border-slate-300 bg-slate-100 px-3 text-sm leading-[44px] text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                                ฿{formatCurrency(invoiceTotal)}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">รายละเอียดเพิ่มเติม</label>
                        <textarea
                            rows={3}
                            value={invoiceDetail}
                            onChange={(event) => setInvoiceDetail(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900"
                        />
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Invoice Payment (ชำระได้หลายครั้ง)</h3>
                            <button type="button" onClick={addPaymentRow} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700">
                                เพิ่มรายการชำระ
                            </button>
                        </div>

                        <div className="space-y-3">
                            {invoicePayments.map((payment, index) => (
                                <div key={payment.invoice_payment_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">วิธีชำระ</label>
                                            <select
                                                value={payment.payment_method}
                                                onChange={(event) => {
                                                    const nextMethod = event.target.value as 'cash' | 'bank';
                                                    updatePaymentRow(payment.invoice_payment_id, (prev) => ({
                                                        ...prev,
                                                        payment_method: nextMethod,
                                                        payment_id: nextMethod === 'bank' ? prev.payment_id || invoiceAvailablePayments[0]?.payment_id : undefined,
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
                                            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">บัญชีธนาคาร</label>
                                            <select
                                                value={payment.payment_id || ''}
                                                onChange={(event) => updatePaymentRow(payment.invoice_payment_id, (prev) => ({ ...prev, payment_id: event.target.value }))}
                                                disabled={payment.payment_method !== 'bank'}
                                                className={`${INPUT_CLASSNAME} disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                <option value="">เลือกบัญชี</option>
                                                {invoiceAvailablePayments.map((bank) => (
                                                    <option key={bank.payment_id} value={bank.payment_id}>
                                                        {bank.bank_name} - {bank.account_number}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors[`payment_id_${index}`] && <p className="mt-1 text-xs text-rose-500">{errors[`payment_id_${index}`]}</p>}
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">ยอดชำระ</label>
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
                                                    className="h-11 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                                    disabled={invoicePayments.length <= 1}
                                                >
                                                    ลบ
                                                </button>
                                            </div>
                                            {errors[`invoice_payment_price_${index}`] && <p className="mt-1 text-xs text-rose-500">{errors[`invoice_payment_price_${index}`]}</p>}
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{INVOICE_PAYMENT_METHOD_LABELS[payment.payment_method]}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {errors.invoice_payments && <p className="mt-2 text-xs text-rose-500">{errors.invoice_payments}</p>}

                        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-700/60 sm:grid-cols-3">
                            <p className="text-slate-700 dark:text-slate-100">ยอดเอกสาร: <span className="font-semibold">฿{formatCurrency(invoiceTotal)}</span></p>
                            <p className="text-slate-700 dark:text-slate-100">ชำระแล้ว: <span className="font-semibold">฿{formatCurrency(paidTotal)}</span></p>
                            <p className="text-slate-700 dark:text-slate-100">คงเหลือ: <span className="font-semibold">฿{formatCurrency(Math.max(invoiceTotal - paidTotal, 0))}</span></p>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-700">
                        <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                            ยกเลิก
                        </button>
                        <button type="submit" className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">
                            บันทึกการแก้ไข
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
