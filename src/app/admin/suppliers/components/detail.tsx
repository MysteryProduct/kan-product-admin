'use client';
import Modal from '@/components/Modal';
import { SupplierWithPayment } from '@/types/supplier';
import { VAT_TYPE_LABELS } from '@/lib/vat';

interface SupplierDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: SupplierWithPayment;
}

export default function SupplierDetailModal({ isOpen, onClose, supplier }: SupplierDetailModalProps) {
    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="รายละเอียดผู้จัดจำหน่าย"
            size="xl"
        >
            <div className="space-y-6 lg:space-y-8">
                {/* Supplier Information */}
                <div className="bg-[var(--bg-subtle)] rounded-xl p-4 sm:p-6 border border-[var(--border)]">
                    <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                        <div className="p-3 bg-[var(--brand-soft)] rounded-xl">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--brand-ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg sm:text-xl font-semibold text-[var(--ink)]">ข้อมูลผู้จัดจำหน่าย</h3>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-[var(--ink)]">รหัสผู้จัดจำหน่าย</p>
                                <div className="px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-xl text-[var(--ink)] font-mono break-all">
                                    {supplier.supplier_code || '-'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-[var(--ink)]">
                                    <span className="flex items-center space-x-2">
                                        <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>เลขประจำตัวผู้เสียภาษี</span>
                                    </span>
                                </label>
                                <div className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-xl text-[var(--ink)] font-mono text-lg">
                                    {supplier.tax_id}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-[var(--ink)]">
                                    <span className="flex items-center space-x-2">
                                        <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3 .672 3 1.5S13.657 14 12 14s-3 .672-3 1.5S10.343 17 12 17m0-9v9" />
                                        </svg>
                                        <span>รูปแบบ VAT</span>
                                    </span>
                                </label>
                                <div className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-xl text-[var(--ink)] shadow-sm">
                                    {VAT_TYPE_LABELS[supplier.vat_type || 'none']}
                                </div>
                            </div>
                                    
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-[var(--ink)]">
                                    <span className="flex items-center space-x-2">
                                        <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <span>ชื่อผู้จัดจำหน่าย</span>
                                    </span>
                                </label>
                                <div className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-xl text-[var(--ink)] shadow-sm">
                                    {supplier.supplier_name}
                                </div>
                            </div>
                                    
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-[var(--ink)]">
                                    <span className="flex items-center space-x-2">
                                        <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span>ผู้ติดต่อ</span>
                                    </span>
                                </label>
                                <div className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-xl text-[var(--ink)] shadow-sm">
                                    {supplier.supplier_contact}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-[var(--ink)]">
                                    <span className="flex items-center space-x-2">
                                        <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        <span>เบอร์โทรศัพท์</span>
                                    </span>
                                </label>
                                <div className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-xl text-[var(--ink)] font-mono text-lg">
                                    {supplier.supplier_phone}
                                </div>
                            </div>
                                    
                            <div className="space-y-2 lg:col-span-1">
                                <label className="block text-sm font-semibold text-[var(--ink)]">
                                    <span className="flex items-center space-x-2">
                                        <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>ที่อยู่</span>
                                    </span>
                                </label>
                                <div className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border)] rounded-xl text-[var(--ink)] min-h-[120px] shadow-sm">
                                    <div className="whitespace-pre-line leading-relaxed">{supplier.supplier_address}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Information */}
                <div className="bg-[var(--bg-subtle)] rounded-xl p-4 sm:p-6 border border-[var(--border)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-3 bg-[var(--brand-soft)] rounded-xl">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--brand-ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-semibold text-[var(--ink)]">ข้อมูลการชำระเงิน</h3>
                                <p className="text-[var(--ink-muted)] text-sm hidden sm:block">รายละเอียดบัญชีธนาคารและวิธีการชำระเงิน</p>
                            </div>
                        </div>
                        {supplier.payments && supplier.payments.length > 0 && (
                            <div className="bg-[var(--neutral-soft)] text-[var(--neutral)] text-sm font-semibold px-4 py-2 rounded-xl">
                                {supplier.payments.length} วิธี{supplier.payments.length > 1 ? 'การ' : ''}
                            </div>
                        )}
                    </div>
                            
                    {supplier.payments && supplier.payments.length > 0 ? (
                        <div className="space-y-6">
                            {supplier.payments.map((payment, index) => (
                                <div key={payment.payment_id} className="bg-[var(--bg-surface)] rounded-xl p-4 sm:p-6 border border-[var(--border)] shadow-sm">
                                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-lg font-bold text-[var(--brand-ink)]">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-[var(--ink)] text-base sm:text-lg">วิธีการชำระเงิน {index + 1}</h4>
                                                <p className="text-[var(--ink-muted)] text-sm hidden sm:block">ข้อมูลบัญชีธนาคาร</p>
                                            </div>
                                        </div>
                                    </div>
                                            
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-[var(--ink)]">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>หมายเลขบัญชี</span>
                                                </span>
                                            </label>
                                            <div className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg text-[var(--ink)] font-mono">
                                                {payment.account_number}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-[var(--ink)]">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                                    </svg>
                                                    <span>ชื่อธนาคาร</span>
                                                </span>
                                            </label>
                                            <div className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg text-[var(--ink)]">
                                                {payment.bank_name}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-[var(--ink)]">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    <span>ชื่อบัญชี</span>
                                                </span>
                                            </label>
                                            <div className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg text-[var(--ink)]">
                                                {payment.account_name}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-[var(--ink)]">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-[var(--ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                    <span>สาขา</span>
                                                </span>
                                            </label>
                                            <div className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg text-[var(--ink)]">
                                                {payment.account_branch}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-[var(--bg-surface)] rounded-lg p-8 text-center border border-[var(--border)]">
                            <div className="flex flex-col items-center space-y-4">
                                <div className="w-16 h-16 bg-[var(--bg-subtle)] rounded-lg flex items-center justify-center">
                                    <svg className="w-8 h-8 text-[var(--ink-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-[var(--ink-muted)]">No Payment Information</p>
                                    <p className="text-sm text-[var(--ink-muted)] mt-1">No payment methods have been configured for this supplier</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
