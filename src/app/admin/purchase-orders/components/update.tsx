'use client';

import { useState, useEffect } from 'react';
import ProductModel from '@/models/product';
import PurchaseOrderModel from '@/models/purchase-order';
import { Product } from '@/types/product';
import { PurchaseOrder } from '@/types/purchase-order';

interface PurchaseOrderItemForm {
    id: string;
    purchase_order_list_id?: number;
    product_id: string;
    purchase_order_list_qty: number;
    purchase_order_list_price: number;
    isNew?: boolean;
}

interface UpdatePurchaseOrderFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData: PurchaseOrder;
}

const productModel = new ProductModel();
const purchaseOrderModel = new PurchaseOrderModel();

export default function UpdatePurchaseOrderForm({
    isOpen,
    onClose,
    onSuccess,
    initialData,
}: UpdatePurchaseOrderFormProps) {
    const [purchaseOrderName, setPurchaseOrderName] = useState('');
    const [purchaseOrderDetail, setPurchaseOrderDetail] = useState('');
    const [items, setItems] = useState<PurchaseOrderItemForm[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (isOpen && initialData) {
            setPurchaseOrderName(initialData.purchase_order_name);
            setPurchaseOrderDetail(initialData.purchase_order_detail);

            // Convert existing items to form format
            if (initialData.items && initialData.items.length > 0) {
                setItems(initialData.items.map(item => ({
                    id: crypto.randomUUID(),
                    purchase_order_list_id: item.purchase_order_list_id,
                    product_id: item.product_id,
                    purchase_order_list_qty: item.purchase_order_list_qty,
                    purchase_order_list_price: item.purchase_order_list_price,
                    isNew: false,
                })));
            } else {
                setItems([{
                    id: crypto.randomUUID(),
                    product_id: '',
                    purchase_order_list_qty: 1,
                    purchase_order_list_price: 0,
                    isNew: true,
                }]);
            }

            fetchProducts();
        }
    }, [isOpen, initialData]);

    const fetchProducts = async () => {
        try {
            const response = await productModel.getProducts(1, 1000);
            setProducts(response.data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    };

    const addItem = () => {
        setItems([
            ...items,
            {
                id: crypto.randomUUID(),
                product_id: '',
                purchase_order_list_qty: 1,
                purchase_order_list_price: 0,
                isNew: true,
            }
        ]);
    };

    const removeItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItem = (id: string, field: keyof PurchaseOrderItemForm, value: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };

                // Auto-fill price when product is selected
                if (field === 'product_id') {
                    const selectedProduct = products.find(p => p.product_id === value);
                    if (selectedProduct) {
                        updatedItem.purchase_order_list_price = selectedProduct.price;
                    }
                }

                return updatedItem;
            }
            return item;
        }));
    };

    const calculateItemTotal = (item: PurchaseOrderItemForm) => {
        return Number(item.purchase_order_list_qty) * Number(item.purchase_order_list_price);
    };

    const calculateGrandTotal = () => {
        return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    };

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (!purchaseOrderName.trim()) {
            newErrors.purchaseOrderName = 'กรุณากรอกเลขที่ใบสั่งซื้อ';
        }

        if (!purchaseOrderDetail.trim()) {
            newErrors.purchaseOrderDetail = 'กรุณากรอกรายละเอียด';
        }

        items.forEach((item, index) => {
            if (!item.product_id || item.product_id === '') {
                newErrors[`item_${index}_product`] = 'กรุณาเลือกสินค้า';
            }
            if (item.purchase_order_list_qty <= 0) {
                newErrors[`item_${index}_qty`] = 'จำนวนต้องมากกว่า 0';
            }
            if (item.purchase_order_list_price <= 0) {
                newErrors[`item_${index}_price`] = 'ราคาต้องมากกว่า 0';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            await purchaseOrderModel.updatePurchaseOrder({
                purchase_order_id: initialData.purchase_order_id,
                purchase_order_name: purchaseOrderName,
                purchase_order_detail: purchaseOrderDetail,
                purchaseOrderLists: items.map(item => ({
                    product_id: item.product_id,
                    purchase_order_list_qty: item.purchase_order_list_qty,
                    purchase_order_list_price: item.purchase_order_list_price,
                    purchase_order_list_total: calculateItemTotal(item),
                })),
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to update purchase order:', error);
            alert('เกิดข้อผิดพลาดในการแก้ไขใบสั่งซื้อ');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setErrors({});
            onClose();
        }
    };

    if (!isOpen) return null;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full my-8 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 px-6 py-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white bg-opacity-20 p-2 rounded-lg backdrop-blur-sm">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white">แก้ไขใบสั่งซื้อ</h2>
                        </div>
                        <button
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="text-white hover:text-black hover:bg-white hover:bg-opacity-25 rounded-xl p-2 transition-all duration-200 disabled:opacity-50 hover:scale-105"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
                    {/* Purchase Order Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <span className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                    </svg>
                                    เลขที่ใบสั่งซื้อ <span className="text-red-500">*</span>
                                </span>
                            </label>
                            <input
                                type="text"
                                value={purchaseOrderName}
                                onChange={(e) => setPurchaseOrderName(e.target.value)}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm transition-all text-gray-800 ${errors.purchaseOrderName ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-orange-400'
                                    }`}
                                placeholder="PO-20260130-001"
                                disabled={isSubmitting}
                            />
                            {errors.purchaseOrderName && (
                                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errors.purchaseOrderName}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <span className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    วันที่สร้าง
                                </span>
                            </label>
                            <input
                                type="text"
                                value={new Date(initialData.purchase_date).toLocaleDateString('th-TH')}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 shadow-sm"
                                disabled
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                </svg>
                                รายละเอียด <span className="text-red-500">*</span>
                            </span>
                        </label>
                        <textarea
                            value={purchaseOrderDetail}
                            onChange={(e) => setPurchaseOrderDetail(e.target.value)}
                            rows={3}
                            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm transition-all resize-none text-gray-800 ${errors.purchaseOrderDetail ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-orange-400'
                                }`}
                            placeholder="ระบุรายละเอียดใบสั่งซื้อ..."
                            disabled={isSubmitting}
                        />
                        {errors.purchaseOrderDetail && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.purchaseOrderDetail}
                            </p>
                        )}
                    </div>

                    {/* Items Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <div className="bg-orange-100 p-2 rounded-lg">
                                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </div>
                                รายการสินค้า
                            </h3>
                            <button
                                type="button"
                                onClick={addItem}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl hover:from-green-700 hover:to-green-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 font-medium"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                เพิ่มสินค้า
                            </button>
                        </div>

                        <div className="space-y-5">
                            {items.map((item, index) => (
                                <div key={item.id} className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-orange-100 text-orange-600 font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-900">รายการที่ {index + 1}</h4>
                                                {item.isNew && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                        ใหม่
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.id)}
                                                disabled={isSubmitting}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all disabled:opacity-50"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                สินค้า <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={item.product_id}
                                                onChange={(e) => updateItem(item.id, 'product_id', e.target.value)}
                                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm transition-all text-gray-800 ${errors[`item_${index}_product`] ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-orange-400'
                                                    }`}
                                                disabled={isSubmitting}
                                            >
                                                <option value={0}>เลือกสินค้า</option>
                                                {products.map((product) => (
                                                    <option key={product.product_id} value={product.product_id}>
                                                        {product.product_name} (฿{product.price})
                                                    </option>
                                                ))}
                                            </select>
                                            {errors[`item_${index}_product`] && (
                                                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    {errors[`item_${index}_product`]}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                จำนวน <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.purchase_order_list_qty}
                                                onChange={(e) => updateItem(item.id, 'purchase_order_list_qty', Number(e.target.value))}
                                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm transition-all text-gray-800 ${errors[`item_${index}_qty`] ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-orange-400'
                                                    }`}
                                                disabled={isSubmitting}
                                            />
                                            {errors[`item_${index}_qty`] && (
                                                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    {errors[`item_${index}_qty`]}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                ราคา/หน่วย <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.purchase_order_list_price}
                                                onChange={(e) => updateItem(item.id, 'purchase_order_list_price', Number(e.target.value))}
                                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm transition-all text-gray-800 ${errors[`item_${index}_price`] ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-orange-400'
                                                    }`}
                                                disabled={isSubmitting}
                                            />
                                            {errors[`item_${index}_price`] && (
                                                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    {errors[`item_${index}_price`]}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t-2 border-gray-200">
                                        <div className="flex justify-between items-center bg-gradient-to-r from-orange-50 to-red-50 p-3 rounded-lg">
                                            <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                ยอดรวมรายการนี้:
                                            </span>
                                            <span className="text-xl font-bold text-orange-600">
                                                ฿{formatCurrency(calculateItemTotal(item))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Grand Total */}
                        <div className="mt-6 bg-gradient-to-r from-orange-600 to-red-500 p-6 rounded-2xl shadow-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-white flex items-center gap-3">
                                    <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    ยอดรวมทั้งสิ้น:
                                </span>
                                <span className="text-3xl font-bold text-white">
                                    ฿{formatCurrency(calculateGrandTotal())}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t-2 border-gray-200">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-semibold disabled:opacity-50 border-2 border-gray-200 hover:border-gray-300"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3.5 bg-gradient-to-r from-orange-600 to-red-500 text-white rounded-xl hover:from-orange-700 hover:to-red-600 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    กำลังบันทึก...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    บันทึกการแก้ไข
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
