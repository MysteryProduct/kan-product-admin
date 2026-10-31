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

const INPUT_CLASSNAME = 'ka-input h-11 w-full';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('th-TH', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

export default function UpdateInvoiceSupplierForm({ isOpen, onClose, onSubmit, invoice }: UpdateInvoiceSupplierFormProps) {
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
            supplier_id: invoice.supplier_id,
            invoice_supplier_total: invoiceTotal,
        });
    };

    return (
        <Modal guardUnsaved
            isOpen={isOpen}
            onClose={onClose}
            title="แก้ไขใบชำระหนี้ผู้จัดจำหน่าย"
            size="xl"
            footer={
                <>
                    <button type="button" onClick={onClose} className="ka-btn h-11">
                        ยกเลิก
                    </button>
                    <button type="submit" form="invoice-supplier-update-form" className="ka-btn ka-btn--primary min-h-11 h-11">
                        บันทึกการแก้ไข
                    </button>
                </>
            }
        >
            <form id="invoice-supplier-update-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-[var(--ink)]">เลขที่ใบชำระหนี้</label>
                        {/* Issued by the system (ADR-0001); the API refuses a changed code. */}
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">{invoice?.invoice_supplier_code || '-'}</div>
                    </div>

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
                        <CustomSelect aria-label="สถานะเอกสาร"
                          value={invoiceStatus}
                          onChange={(value) => setInvoiceStatus(value as 'pending' | 'partial' | 'paid' | 'cancelled')}
                          options={INVOICE_STATUS_OPTIONS.map((status) => ({ value: status.value, label: status.label }))}
                        />
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
                                        <CustomSelect aria-label="วิธีชำระ"
                                          value={payment.payment_method}
                                          onChange={(value) => {
                                                const nextMethod = value as 'cash' | 'bank';
                                                updatePaymentRow(payment.invoice_payment_id, (prev) => ({
                                                    ...prev,
                                                    payment_method: nextMethod,
                                                    payment_id: nextMethod === 'bank' ? prev.payment_id || invoiceAvailablePayments[0]?.payment_id : undefined,
                                                }));
                                            }}
                                          options={INVOICE_PAYMENT_METHOD_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">บัญชีธนาคาร</label>
                                        <CustomSelect aria-label="บัญชีธนาคาร"
                                          value={payment.payment_id || ''}
                                          onChange={(value) => updatePaymentRow(payment.invoice_payment_id, (prev) => ({ ...prev, payment_id: value }))}
                                          options={invoiceAvailablePayments.map((bank) => ({ value: bank.payment_id, label: `${bank.bank_name}- ${bank.account_number}` }))}
                                          placeholder="เลือกบัญชี"
                                          disabled={payment.payment_method !== 'bank'}
                                        />
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
import Modal from '@/components/Modal';
import CustomSelect from '@/components/CustomSelect';
