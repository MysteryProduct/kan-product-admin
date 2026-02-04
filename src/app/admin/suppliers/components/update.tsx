'use client';
import React, { useEffect, useState, useCallback } from 'react';
import SupplierModel from '@/models/supplier';
import { SupplierWithPayment, Payment, PaymentUpdate } from '@/types/supplier';

interface UpdateSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplierId: string | null;
    onUpdate: () => void;
}

export default function UpdateSupplierModal({ isOpen, onClose, supplierId, onUpdate }: UpdateSupplierModalProps) {
    const [formData, setFormData] = useState({
        supplier_name: '',
        supplier_contact: '',
        supplier_phone: '',
        supplier_address: '',
        tax_id: ''
    });

    const [payments, setPayments] = useState<Omit<PaymentUpdate, 'supplier_id'>[]>([{
        payment_id: '',
        account_name: '',
        account_number: '',
        account_branch: '',
        bank_name: ''
    }]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && supplierId) {
            const fetchSupplier = async () => {
                setLoading(true);
                try {
                    const supplierModel = new SupplierModel();
                    const supplier = await supplierModel.getSupplierById(supplierId);
                    setFormData({
                        supplier_name: supplier.supplier_name,
                        supplier_contact: supplier.supplier_contact,
                        supplier_phone: supplier.supplier_phone,
                        supplier_address: supplier.supplier_address,
                        tax_id: supplier.tax_id
                    });
                    setPayments(supplier.payments && supplier.payments.length > 0 
                        ? supplier.payments.map(p => ({
                            payment_id: p.payment_id,
                            account_name: p.account_name,
                            account_number: p.account_number,
                            account_branch: p.account_branch,
                            bank_name: p.bank_name
                        }))
                        : [{
                            payment_id: '',
                            account_name: '',
                            account_number: '',
                            account_branch: '',
                            bank_name: ''
                        }]
                    );
                } catch (error) {
                    console.error('Error fetching supplier:', error);
                    setErrors({ fetch: 'ไม่สามารถโหลดข้อมูลซัพพลายเออร์ได้' });
                } finally {
                    setLoading(false);
                }
            };
            fetchSupplier();
        }
    }, [isOpen, supplierId]);

    const validateForm = useCallback((): boolean => {
        const newErrors: { [key: string]: string } = {};

        // Supplier validation
        if (!formData.supplier_name.trim()) {
            newErrors.supplier_name = 'Supplier name is required';
        }
        if (!formData.supplier_contact.trim()) {
            newErrors.supplier_contact = 'Contact person is required';
        }
        if (!formData.supplier_address.trim()) {
            newErrors.supplier_address = 'Address is required';
        }
        if (!formData.supplier_phone.trim()) {
            newErrors.supplier_phone = 'Phone number is required';
        }
        if (!formData.tax_id.trim()) {
            newErrors.tax_id = 'Tax ID is required';
        } else if (formData.tax_id.length !== 13) {
            newErrors.tax_id = 'Tax ID must be 13 digits';
        }

        // Payment validation - must have at least 1 payment
        if (payments.length === 0) {
            newErrors.payments = 'At least one payment method is required';
        } else {
            payments.forEach((payment, index) => {
                if (!payment.account_name.trim()) {
                    newErrors[`account_name_${index}`] = 'Account name is required';
                }
                if (!payment.account_number.trim()) {
                    newErrors[`account_number_${index}`] = 'Account number is required';
                }
                if (!payment.account_branch.trim()) {
                    newErrors[`account_branch_${index}`] = 'Branch is required';
                }
                if (!payment.bank_name.trim()) {
                    newErrors[`bank_name_${index}`] = 'Bank name is required';
                }
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, payments]);

    const handleSupplierInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    }, [errors]);

    const handlePaymentInputChange = useCallback((index: number, field: keyof Omit<Payment, 'supplier_id'>, value: string) => {
        setPayments(prev => prev.map((payment, i) =>
            i === index ? { ...payment, [field]: value } : payment
        ));
        // Clear error when user starts typing
        const errorKey = `${field}_${index}`;
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: '' }));
        }
    }, [errors]);

    const addPayment = useCallback(() => {
        setPayments(prev => [...prev, {
            payment_id: '',
            account_name: '',
            account_number: '',
            account_branch: '',
            bank_name: ''
        }]);
    }, []);

    const removePayment = useCallback((index: number) => {
        if (payments.length > 1) {
            setPayments(prev => prev.filter((_, i) => i !== index));
            // Clear errors for removed payment
            const newErrors = { ...errors };
            Object.keys(newErrors).forEach(key => {
                if (key.endsWith(`_${index}`)) {
                    delete newErrors[key];
                }
            });
            setErrors(newErrors);
        }
    }, [payments.length, errors]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const supplierModel = new SupplierModel();
            await supplierModel.updateSupplier({
                supplier_id: supplierId || '',
                supplier_name: formData.supplier_name,
                supplier_contact: formData.supplier_contact,
                supplier_address: formData.supplier_address,
                supplier_phone: formData.supplier_phone,
                tax_id: formData.tax_id,
                payments: payments.map(payment => ({
                    payment_id: payment.payment_id || '',
                    account_name: payment.account_name,
                    account_number: payment.account_number,
                    account_branch: payment.account_branch,
                    bank_name: payment.bank_name
                }))
            });

            setErrors({});
            onUpdate();
            onClose();
        } catch (error: any) {
            console.error('Error updating supplier:', error);
            setErrors({ submit: 'Failed to update supplier. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-6xl h-[95vh] relative overflow-hidden">

                {/* Fixed Header */}
                <div className="absolute top-0 left-0 right-0 z-20 bg-emerald-600 rounded-t-2xl shadow-md border-b border-gray-200">
                    <div className="flex justify-between items-center p-4 sm:p-6 lg:p-8">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white">แก้ไขข้อมูลผู้จัดจำหน่าย</h2>
                                <p className="text-white/80 text-sm hidden sm:block">กรุณาแก้ไขข้อมูลให้ครบถ้วนเพื่ออัปเดตผู้จัดจำหน่าย</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg flex-shrink-0"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Scrollable Content */}
                        <div className="absolute top-0 left-0 right-0 bottom-0 overflow-y-auto pt-24 sm:pt-28 lg:pt-32 pb-24 sm:pb-28">
                            <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
                                {/* Supplier Information */}
                                <div className="bg-emerald-50 rounded-lg p-4 sm:p-6 border border-emerald-200">
                                    <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                                        <div className="p-2 bg-emerald-500 rounded-lg">
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-semibold text-gray-800">ข้อมูลผู้จัดจำหน่าย</h3>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span>เลขประจำตัวผู้เสียภาษี <span className="text-red-500">*</span></span>
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                name="tax_id"
                                                value={formData.tax_id}
                                                onChange={handleSupplierInputChange}
                                                maxLength={13}
                                                className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono ${errors.tax_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                    }`}
                                                placeholder="กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลัก"
                                            />
                                            {errors.tax_id && (
                                                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>{errors.tax_id}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                    <span>ชื่อผู้จัดจำหน่าย <span className="text-red-500">*</span></span>
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                name="supplier_name"
                                                value={formData.supplier_name}
                                                onChange={handleSupplierInputChange}
                                                className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.supplier_name ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                    }`}
                                                placeholder="กรุณากรอกชื่อผู้จัดจำหน่าย"
                                            />
                                            {errors.supplier_name && (
                                                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>{errors.supplier_name}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    <span>ผู้ติดต่อ <span className="text-red-500">*</span></span>
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                name="supplier_contact"
                                                value={formData.supplier_contact}
                                                onChange={handleSupplierInputChange}
                                                className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.supplier_contact ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                    }`}
                                                placeholder="กรุณากรอกชื่อผู้ติดต่อ"
                                            />
                                            {errors.supplier_contact && (
                                                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>{errors.supplier_contact}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                    <span>เบอร์โทรศัพท์ <span className="text-red-500">*</span></span>
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                name="supplier_phone"
                                                value={formData.supplier_phone}
                                                onChange={handleSupplierInputChange}
                                                className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.supplier_phone ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                    }`}
                                                placeholder="กรุณากรอกเบอร์โทรศัพท์"
                                            />
                                            {errors.supplier_phone && (
                                                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>{errors.supplier_phone}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="lg:col-span-2 space-y-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                <span className="flex items-center space-x-2">
                                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span>ที่อยู่ <span className="text-red-500">*</span></span>
                                                </span>
                                            </label>
                                            <textarea
                                                name="supplier_address"
                                                value={formData.supplier_address}
                                                onChange={handleSupplierInputChange}
                                                rows={3}
                                                className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none ${errors.supplier_address ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                    }`}
                                                placeholder="กรุณากรอกที่อยู่แบบละเอียด"
                                            />
                                            {errors.supplier_address && (
                                                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>{errors.supplier_address}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Information */}
                                <div className="bg-orange-50 rounded-lg p-4 sm:p-6 border border-orange-200">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-orange-500 rounded-lg">
                                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-lg sm:text-xl font-semibold text-gray-800">ข้อมูลการชำระเงิน</h3>
                                                <p className="text-orange-700 text-sm hidden sm:block">รายละเอียดบัญชีธนาคารสำหรับการชำระเงิน</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addPayment}
                                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium whitespace-nowrap"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            เพิ่มบัญชี
                                        </button>
                                    </div>

                                    {errors.payments && (
                                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <p className="text-red-600 text-sm flex items-center space-x-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span>{errors.payments}</span>
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {payments.map((payment, index) => (
                                            <div key={index} className="bg-white rounded-lg p-4 sm:p-6 border border-orange-200 shadow-md relative">
                                                <div className="flex items-center justify-between mb-4 sm:mb-6">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-gray-800 text-base sm:text-lg">บัญชีธนาคาร {index + 1}</h4>
                                                            <p className="text-orange-600 text-sm hidden sm:block">ข้อมูลการชำระเงิน</p>
                                                        </div>
                                                    </div>
                                                    {payments.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removePayment(index)}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex-shrink-0"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-semibold text-gray-700">
                                                            <span className="flex items-center space-x-2">
                                                                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                <span>เลขที่บัญชี <span className="text-red-500">*</span></span>
                                                            </span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={payment.account_number}
                                                            onChange={(e) => handlePaymentInputChange(index, 'account_number', e.target.value)}
                                                            className={`w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 font-mono ${errors[`account_number_${index}`] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                                }`}
                                                            placeholder="กรุณากรอกเลขที่บัญชี"
                                                        />
                                                        {errors[`account_number_${index}`] && (
                                                            <p className="text-sm text-red-600 flex items-center space-x-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                <span>{errors[`account_number_${index}`]}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-semibold text-gray-700">
                                                            <span className="flex items-center space-x-2">
                                                                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                                </svg>
                                                                <span>ธนาคาร <span className="text-red-500">*</span></span>
                                                            </span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={payment.bank_name}
                                                            onChange={(e) => handlePaymentInputChange(index, 'bank_name', e.target.value)}
                                                            className={`w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 ${errors[`bank_name_${index}`] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                                }`}
                                                            placeholder="กรุณากรอกชื่อธนาคาร"
                                                        />
                                                        {errors[`bank_name_${index}`] && (
                                                            <p className="text-sm text-red-600 flex items-center space-x-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                <span>{errors[`bank_name_${index}`]}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-semibold text-gray-700">
                                                            <span className="flex items-center space-x-2">
                                                                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                </svg>
                                                                <span>ชื่อบัญชี <span className="text-red-500">*</span></span>
                                                            </span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={payment.account_name}
                                                            onChange={(e) => handlePaymentInputChange(index, 'account_name', e.target.value)}
                                                            className={`w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 ${errors[`account_name_${index}`] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                                }`}
                                                            placeholder="กรุณากรอกชื่อบัญชี"
                                                        />
                                                        {errors[`account_name_${index}`] && (
                                                            <p className="text-sm text-red-600 flex items-center space-x-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                <span>{errors[`account_name_${index}`]}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-semibold text-gray-700">
                                                            <span className="flex items-center space-x-2">
                                                                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                <span>สาขา <span className="text-red-500">*</span></span>
                                                            </span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={payment.account_branch}
                                                            onChange={(e) => handlePaymentInputChange(index, 'account_branch', e.target.value)}
                                                            className={`w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 ${errors[`account_branch_${index}`] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                                }`}
                                                            placeholder="กรุณากรอกสาขา"
                                                        />
                                                        {errors[`account_branch_${index}`] && (
                                                            <p className="text-sm text-red-600 flex items-center space-x-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                <span>{errors[`account_branch_${index}`]}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Submit Error */}
                                {errors.submit && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-red-600 text-sm flex items-center space-x-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>{errors.submit}</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fixed Footer */}
                        <div className="absolute bottom-0 left-0 right-0 z-20 bg-white p-4 sm:p-6 border-t border-gray-200 rounded-b-2xl">
                            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 sm:justify-end">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            กำลังอัปเดต...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            อัปเดตข้อมูล
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
