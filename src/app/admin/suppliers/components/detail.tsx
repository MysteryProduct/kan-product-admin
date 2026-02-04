'use client';
import { SupplierWithPayment } from '@/types/supplier';

interface SupplierDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: SupplierWithPayment;
}

export default function SupplierDetailModal({ isOpen, onClose, supplier }: SupplierDetailModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-6xl h-[95vh] relative overflow-hidden">
                
                {/* Fixed Header */}
                <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl shadow-lg border-b border-blue-500">
                    <div className="flex justify-between items-center p-4 sm:p-6 lg:p-8">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white">รายละเอียดผู้จัดจำหน่าย</h2>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg flex-shrink-0 transition-all duration-200"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="absolute top-0 left-0 right-0 bottom-0 overflow-y-auto pt-24 sm:pt-28 lg:pt-32 pb-8">
                    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
                        {/* Supplier Information */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200 shadow-sm">
                            <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                                <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-md">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg sm:text-xl font-semibold text-gray-800">ข้อมูลผู้จัดจำหน่าย</h3>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            <span className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span>เลขประจำตัวผู้เสียภาษี</span>
                                            </span>
                                        </label>
                                        <div className="w-full px-4 py-3 bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl text-gray-700 font-mono text-lg shadow-sm">
                                            {supplier.tax_id}
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            <span className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                                <span>ชื่อผู้จัดจำหน่าย</span>
                                            </span>
                                        </label>
                                        <div className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 shadow-sm">
                                            {supplier.supplier_name}
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            <span className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                <span>ผู้ติดต่อ</span>
                                            </span>
                                        </label>
                                        <div className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 shadow-sm">
                                            {supplier.supplier_contact}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            <span className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                <span>เบอร์โทรศัพท์</span>
                                            </span>
                                        </label>
                                        <div className="w-full px-4 py-3 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-xl text-gray-700 font-mono text-lg shadow-sm">
                                            {supplier.supplier_phone}
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 lg:col-span-1">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            <span className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span>ที่อยู่</span>
                                            </span>
                                        </label>
                                        <div className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 min-h-[120px] shadow-sm">
                                            <div className="whitespace-pre-line leading-relaxed">{supplier.supplier_address}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Information */}
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 sm:p-6 border border-emerald-200 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center space-x-3">
                                    <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl shadow-md">
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-semibold text-gray-800">ข้อมูลการชำระเงิน</h3>
                                        <p className="text-emerald-700 text-sm hidden sm:block">รายละเอียดบัญชีธนาคารและวิธีการชำระเงิน</p>
                                    </div>
                                </div>
                                {supplier.payments && supplier.payments.length > 0 && (
                                    <div className="bg-emerald-100 text-emerald-800 text-sm font-semibold px-4 py-2 rounded-xl shadow-sm">
                                        {supplier.payments.length} วิธี{supplier.payments.length > 1 ? 'การ' : ''}
                                    </div>
                                )}
                            </div>
                            
                            {supplier.payments && supplier.payments.length > 0 ? (
                                <div className="space-y-6">
                                    {supplier.payments.map((payment, index) => (
                                        <div key={payment.payment_id} className="bg-white rounded-xl p-4 sm:p-6 border border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-300">
                                            <div className="flex items-center justify-between mb-4 sm:mb-6">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-800 text-base sm:text-lg">วิธีการชำระเงิน {index + 1}</h4>
                                                        <p className="text-emerald-600 text-sm hidden sm:block">ข้อมูลบัญชีธนาคาร</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-semibold text-gray-700">
                                                        <span className="flex items-center space-x-2">
                                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                            </svg>
                                                            <span>หมายเลขบัญชี</span>
                                                        </span>
                                                    </label>
                                                    <div className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 font-mono">
                                                        {payment.account_number}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="block text-sm font-semibold text-gray-700">
                                                        <span className="flex items-center space-x-2">
                                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                                            </svg>
                                                            <span>ชื่อธนาคาร</span>
                                                        </span>
                                                    </label>
                                                    <div className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                                                        {payment.bank_name}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-semibold text-gray-700">
                                                        <span className="flex items-center space-x-2">
                                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                            <span>ชื่อบัญชี</span>
                                                        </span>
                                                    </label>
                                                    <div className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                                                        {payment.account_name}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-semibold text-gray-700">
                                                        <span className="flex items-center space-x-2">
                                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                            </svg>
                                                            <span>สาขา</span>
                                                        </span>
                                                    </label>
                                                    <div className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                                                        {payment.account_branch}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
                                    <div className="flex flex-col items-center space-y-4">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold text-gray-600">No Payment Information</p>
                                            <p className="text-sm text-gray-500 mt-1">No payment methods have been configured for this supplier</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
