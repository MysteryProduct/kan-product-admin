'use client';
import { useState, useCallback } from 'react';
import { SupplierWithPayment, Payment } from '@/types/supplier';
import SupplierModel, { CreateSupplierDto } from '@/models/supplier';

interface SupplierInsertFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function SupplierInsertForm({ isOpen, onClose, onSuccess }: SupplierInsertFormProps) {
    const [formData, setFormData] = useState<Omit<SupplierWithPayment, 'payments'>>({
        supplier_id: '',
        supplier_name: '',
        supplier_contact: '',
        supplier_address: '',
        supplier_phone: '',
        tax_id: ''
    });

    const [payments, setPayments] = useState<Omit<Payment, 'supplier_id'>[]>([{
        account_name: '',
        account_number: '',
        account_branch: '',
        bank_name: ''
    }]);

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const supplierModel = new SupplierModel();
            const supplierPayload: CreateSupplierDto = {
                supplier_name: formData.supplier_name,
                supplier_contact: formData.supplier_contact,
                supplier_address: formData.supplier_address,
                supplier_phone: formData.supplier_phone,
                tax_id: formData.tax_id,
                payments: payments.map(payment => ({
                    account_name: payment.account_name,
                    account_number: payment.account_number,
                    account_branch: payment.account_branch,
                    bank_name: payment.bank_name
                }))
            };

            await supplierModel.createSupplier(supplierPayload);

            // Reset form
            setFormData({
                supplier_id: '',
                supplier_name: '',
                supplier_contact: '',
                supplier_address: '',
                supplier_phone: '',
                tax_id: ''
            });
            setPayments([{
                account_name: '',
                account_number: '',
                account_branch: '',
                bank_name: ''
            }]);
            setErrors({});

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error creating supplier:', error);
            setErrors({ submit: 'Failed to create supplier. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-6xl h-[95vh] relative overflow-hidden">

                {/* Fixed Header */}
                <div className="absolute top-0 left-0 right-0 z-20 bg-blue-600 rounded-t-2xl shadow-md border-b border-gray-200">
                    <div className="flex justify-between items-center p-4 sm:p-6 lg:p-8">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white">เพิ่มผู้จัดจำหน่ายใหม่</h2>
                                <p className="text-white/80 text-sm hidden sm:block">กรุณากรอกข้อมูลให้ครบถ้วนเพื่อเพิ่มผู้จัดจำหน่ายใหม่</p>
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

                {/* Scrollable Content */}
                <div className="absolute top-0 left-0 right-0 bottom-0 overflow-y-auto pt-24 sm:pt-28 lg:pt-32 pb-24 sm:pb-28">
                    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
                        {/* Supplier Information */}
                        <div className="bg-blue-50 rounded-lg p-4 sm:p-6 border border-blue-200">
                            <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                                <div className="p-2 bg-blue-500 rounded-lg">
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
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                        className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono ${errors.tax_id ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
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
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                        className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.supplier_name ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
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
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                        className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.supplier_contact ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
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
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <span>หมายเลขโทรศัพท์ <span className="text-red-500">*</span></span>
                                        </span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="supplier_phone"
                                        value={formData.supplier_phone}
                                        onChange={handleSupplierInputChange}
                                        className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.supplier_phone ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                            }`}
                                        placeholder="กรุณากรอกหมายเลขโทรศัพท์"
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
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                        className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${errors.supplier_address ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                            }`}
                                        placeholder="กรุณากรอกที่อยู่ผู้จัดจำหน่าย"
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
                        <div className="bg-green-50 rounded-xl p-4 sm:p-6 border border-green-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-green-500 rounded-lg">
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-semibold text-gray-800">ข้อมูลการชำระเงิน</h3>
                                        <p className="text-green-700 text-sm hidden sm:block">เพิ่มวิธีการชำระเงินหนึ่งวิธีหรือมากกว่า</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={addPayment}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-lg hover:shadow-lg text-sm sm:text-base w-full sm:w-auto justify-center sm:justify-start"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span className="font-semibold">เพิ่มวิธีการชำระเงิน</span>
                                </button>
                            </div>

                            <div className="space-y-6">
                                {payments.map((payment, index) => (
                                    <div key={index} className="bg-white rounded-lg p-4 sm:p-6 border border-green-200 shadow-md hover:shadow-lg relative">
                                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-800 text-base sm:text-lg">วิธีการชำระเงิน {index + 1}</h4>
                                                    <p className="text-green-600 text-sm hidden sm:block">ข้อมูลธนาคาร</p>
                                                </div>
                                            </div>
                                            {payments.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePayment(index)}
                                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200"
                                                    title="Remove Payment"
                                                >
                                                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">

                                            <div className="space-y-2">
                                                <label className="block text-sm font-semibold text-gray-700">
                                                    <span className="flex items-center space-x-2">
                                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                        </svg>
                                                        <span>หมายเลขบัญชี <span className="text-red-500">*</span></span>
                                                    </span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={payment.account_number}
                                                    onChange={(e) => handlePaymentInputChange(index, 'account_number', e.target.value)}
                                                    className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono ${errors[`account_number_${index}`] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                        }`}
                                                    placeholder="กรุณากรอกหมายเลขบัญชี"
                                                />
                                                {errors[`account_number_${index}`] && (
                                                    <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
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
                                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                                        </svg>
                                                        <span>ชื่อธนาคาร <span className="text-red-500">*</span></span>
                                                    </span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={payment.bank_name}
                                                    onChange={(e) => handlePaymentInputChange(index, 'bank_name', e.target.value)}
                                                    className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors[`bank_name_${index}`] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                        }`}
                                                    placeholder="กรุณากรอกชื่อธนาคาร"
                                                />
                                                {errors[`bank_name_${index}`] && (
                                                    <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
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
                                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        <span>ชื่อบัญชี <span className="text-red-500">*</span></span>
                                                    </span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={payment.account_name}
                                                    onChange={(e) => handlePaymentInputChange(index, 'account_name', e.target.value)}
                                                    className={`text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors[`account_name_${index}`] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                        }`}
                                                    placeholder="กรุณากรอกชื่อบัญชี"
                                                />
                                                {errors[`account_name_${index}`] && (
                                                    <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
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
                                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                        </svg>
                                                        <span>สาขา <span className="text-red-500">*</span></span>
                                                    </span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={payment.account_branch}
                                                    onChange={(e) => handlePaymentInputChange(index, 'account_branch', e.target.value)}
                                                    className={` text-gray-700 w-full px-4 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors[`account_branch_${index}`] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                                                        }`}
                                                    placeholder="กรุณากรอกชื่อสาขา"
                                                />
                                                {errors[`account_branch_${index}`] && (
                                                    <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
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
                                <p className="text-sm text-red-700 flex items-center space-x-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{errors.submit}</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 rounded-b-xl">
                    <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 font-semibold shadow-lg hover:shadow-lg w-full sm:w-auto"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            className={`px-8 py-3 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold shadow-lg hover:shadow-lg w-full sm:w-auto ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center space-x-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>กำลังสร้าง...</span>
                                </span>
                            ) : (
                                <span className="flex items-center justify-center space-x-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>สร้างผู้จัดจำหน่าย</span>
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}