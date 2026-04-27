'use client';

import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import Pagination from '@/components/Pagination';
import SaleOrderModel from '@/models/sale-order';
import { FetchSaleOrder, FetchSaleOrderResponse } from '@/types/sale-order';
import { PaginationMeta } from '@/types/pagination';
import { calculateVatSummary, VAT_TYPE_OPTIONS, VatType } from '@/lib/vat';

interface SaleOrderItemForm {
    id: string;
    fetch_sale_order_id: string;
    job_order_id: string;
    product_name: string;
    sale_order_list_qty: number;
    sale_order_list_price: number;
    sale_order_list_cost: number;
    max_qty: number;
}

interface InsertSaleOrderFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialFetchSaleOrder: FetchSaleOrder | null;
}

const saleOrderModel = new SaleOrderModel();

const mapFetchToFormItem = (item: FetchSaleOrder): SaleOrderItemForm => ({
    id: crypto.randomUUID(),
    fetch_sale_order_id: item.fetch_sale_order_id,
    job_order_id: item.job_order_id,
    product_name: item.fetch_sale_order_name,
    sale_order_list_qty: Number(item.fetch_sale_order_qty || 0),
    sale_order_list_price: Number(item.fetch_sale_order_price || 0),
    sale_order_list_cost: Number(item.fetch_sale_order_cost || 0),
    max_qty: Number(item.fetch_sale_order_qty || 0),
});

export default function InsertSaleOrderForm({ isOpen, onClose, onSuccess, initialFetchSaleOrder }: InsertSaleOrderFormProps) {
    const [saleOrderName, setSaleOrderName] = useState('');
    const [saleOrderDetail, setSaleOrderDetail] = useState('');
    const [shippingAddressName, setShippingAddressName] = useState('');
    const [saleOrderType, setSaleOrderType] = useState('order');
    const [vatType, setVatType] = useState<VatType>('none');
    const [items, setItems] = useState<SaleOrderItemForm[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
    const [selectionRows, setSelectionRows] = useState<FetchSaleOrder[]>([]);
    const [selectionMeta, setSelectionMeta] = useState<PaginationMeta | null>(null);
    const [selectionPage, setSelectionPage] = useState(1);
    const [selectionSearch, setSelectionSearch] = useState('');
    const [selectionAppliedSearch, setSelectionAppliedSearch] = useState('');
    const [isSelectionLoading, setIsSelectionLoading] = useState(false);
    const [selectedFetchItems, setSelectedFetchItems] = useState<Record<string, FetchSaleOrder>>({});

    const [resultDialog, setResultDialog] = useState<{
        isOpen: boolean;
        status: 'success' | 'error';
        action: ActionResultDialogAction;
        message: string;
    }>({
        isOpen: false,
        status: 'success',
        action: 'insert',
        message: '',
    });

    const existingFetchIds = useMemo(() => new Set(items.map((item) => item.fetch_sale_order_id)), [items]);

    useEffect(() => {
        if (isOpen) {
            setSaleOrderName('');
            setSaleOrderDetail('');
            setShippingAddressName('');
            setSaleOrderType('order');
            setVatType('none');
            setErrors({});
            if (initialFetchSaleOrder) {
                setItems([mapFetchToFormItem(initialFetchSaleOrder)]);
            } else {
                setItems([]);
            }
        }
    }, [isOpen, initialFetchSaleOrder?.fetch_sale_order_id]);

    useEffect(() => {
        if (!isSelectModalOpen) return;
        void fetchSelectionItems();
    }, [isSelectModalOpen, selectionPage, selectionAppliedSearch, items]);

    const fetchSelectionItems = async () => {
        try {
            setIsSelectionLoading(true);
            const response: FetchSaleOrderResponse = await saleOrderModel.getFetchSaleOrders(
                selectionPage,
                10,
                selectionAppliedSearch,
            );
            setSelectionRows((response.data || []).filter((row) => !existingFetchIds.has(row.fetch_sale_order_id)));
            setSelectionMeta(response.meta || null);
        } catch (error) {
            console.error('Failed to fetch selectable fetch-sale-orders:', error);
            setSelectionRows([]);
            setSelectionMeta(null);
        } finally {
            setIsSelectionLoading(false);
        }
    };

    const calculateItemTotal = (item: SaleOrderItemForm) =>
        Number(item.sale_order_list_qty) * Number(item.sale_order_list_price);

    const grandTotal = useMemo(() => items.reduce((sum, item) => sum + calculateItemTotal(item), 0), [items]);
    const vatSummary = useMemo(() => calculateVatSummary(grandTotal, vatType), [grandTotal, vatType]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);

    const updateItem = (id: string, field: 'sale_order_list_qty' | 'sale_order_list_price', value: number) => {
        setItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                if (field === 'sale_order_list_qty') {
                    const nextQty = Number.isNaN(value) ? 0 : Math.min(value, item.max_qty);
                    return { ...item, sale_order_list_qty: nextQty };
                }
                return { ...item, [field]: Number.isNaN(value) ? 0 : value };
            }),
        );
    };

    const handleRemoveItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const openSelectModal = () => {
        setSelectionPage(1);
        setSelectionSearch('');
        setSelectionAppliedSearch('');
        setSelectedFetchItems({});
        setIsSelectModalOpen(true);
    };

    const toggleFetchItemSelection = (item: FetchSaleOrder) => {
        const itemId = item.fetch_sale_order_id;
        setSelectedFetchItems((prev) => {
            if (prev[itemId]) {
                const next = { ...prev };
                delete next[itemId];
                return next;
            }
            return { ...prev, [itemId]: item };
        });
    };

    const toggleSelectAllCurrentPage = () => {
        const currentIds = selectionRows.map((row) => row.fetch_sale_order_id);
        const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedFetchItems[id]);
        setSelectedFetchItems((prev) => {
            const next = { ...prev };
            if (allSelected) {
                currentIds.forEach((id) => delete next[id]);
                return next;
            }
            selectionRows.forEach((row) => {
                next[row.fetch_sale_order_id] = row;
            });
            return next;
        });
    };

    const addSelectedItems = () => {
        const selectedValues = Object.values(selectedFetchItems).filter(
            (item) => !existingFetchIds.has(item.fetch_sale_order_id),
        );
        if (selectedValues.length === 0) return;
        setItems((prev) => [...prev, ...selectedValues.map(mapFetchToFormItem)]);
        setIsSelectModalOpen(false);
        setSelectedFetchItems({});
    };

    const handleSelectionSearch = () => {
        setSelectionPage(1);
        setSelectionAppliedSearch(selectionSearch.trim());
    };

    const handleSelectionClearSearch = () => {
        setSelectionSearch('');
        setSelectionAppliedSearch('');
        setSelectionPage(1);
    };

    const validate = () => {
        const nextErrors: Record<string, string> = {};
        if (!saleOrderName.trim()) {
            nextErrors.sale_order_name = 'กรุณากรอกชื่อใบขายสินค้า';
        }
        if (items.length === 0) {
            nextErrors.items = 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ';
        }
        items.forEach((item, index) => {
            if (item.sale_order_list_qty <= 0) {
                nextErrors[`item_${index}_qty`] = 'จำนวนต้องมากกว่า 0';
            }
            if (item.sale_order_list_price < 0) {
                nextErrors[`item_${index}_price`] = 'ราคาต้องไม่ติดลบ';
            }
        });
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const resetAndClose = () => {
        setSaleOrderName('');
        setSaleOrderDetail('');
        setShippingAddressName('');
        setSaleOrderType('order');
        setVatType('none');
        setItems([]);
        setSelectedFetchItems({});
        setIsSelectModalOpen(false);
        setErrors({});
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
            if (!user) throw new Error('User not authenticated');

            await saleOrderModel.createSaleOrder({
                sale_order_name: saleOrderName,
                sale_order_detail: saleOrderDetail,
                shipping_address_name: shippingAddressName,
                sale_order_type: saleOrderType,
                vat_type: vatType,
                sale_order_subtotal: vatSummary.subtotal,
                sale_order_vat_amount: vatSummary.vatAmount,
                sale_order_total: vatSummary.total,
                create_by: user.employee_id,
                saleOrderLists: items.map((item) => ({
                    fetch_sale_order_id: item.fetch_sale_order_id,
                    product_name: item.product_name,
                    sale_order_list_qty: Number(item.sale_order_list_qty),
                    sale_order_list_price: Number(item.sale_order_list_price),
                    sale_order_list_total: calculateItemTotal(item),
                    sale_order_list_cost: Number(item.sale_order_list_cost),
                    job_order_id : item.job_order_id
                })),
            });

            setResultDialog({ isOpen: true, status: 'success', action: 'insert', message: 'สร้างใบขายสินค้าสำเร็จ' });
        } catch (error) {
            console.error('Failed to create sale order:', error);
            setResultDialog({
                isOpen: true,
                status: 'error',
                action: 'insert',
                message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างใบขายสินค้า',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResultDialogClose = () => {
        const isSuccess = resultDialog.status === 'success';
        setResultDialog((prev) => ({ ...prev, isOpen: false }));
        if (isSuccess) {
            onSuccess();
            resetAndClose();
        }
    };

    if (!isOpen) return null;

    const selectedCount = Object.keys(selectedFetchItems).length;
    const showSelectionPagination = (selectionMeta?.total || 0) > 10 && (selectionMeta?.last_page || 0) > 1;
    const allCurrentPageSelected =
        selectionRows.length > 0 && selectionRows.every((row) => selectedFetchItems[row.fetch_sale_order_id]);

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-300/40 p-4 backdrop-blur-sm">
                <div className="w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-800">
                    <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-5 shadow-lg">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-2xl font-bold text-white">สร้างใบขายสินค้า</h2>
                            <button
                                onClick={resetAndClose}
                                disabled={isSubmitting}
                                className="rounded-xl p-2 text-white transition-all duration-200 hover:bg-white/20 hover:text-black disabled:opacity-50"
                                type="button"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="max-h-[calc(90vh-160px)] overflow-y-auto p-6">
                        {/* Header Fields */}
                        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                                    ชื่อใบขายสินค้า <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={saleOrderName}
                                    onChange={(e) => setSaleOrderName(e.target.value)}
                                    placeholder="กรอกชื่อใบขายสินค้า"
                                    className="h-11 w-full rounded-xl border border-gray-300 px-4 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                                    disabled={isSubmitting}
                                />
                                {errors.sale_order_name && (
                                    <p className="mt-1 text-xs text-red-500">{errors.sale_order_name}</p>
                                )}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รูปแบบ VAT</label>
                                <select
                                    value={vatType}
                                    onChange={(e) => setVatType(e.target.value as VatType)}
                                    className="h-11 w-full rounded-xl border border-gray-300 px-4 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                    disabled={isSubmitting}
                                >
                                    {VAT_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">ที่อยู่จัดส่ง</label>
                                <textarea
                                    value={shippingAddressName}
                                    onChange={(e) => setShippingAddressName(e.target.value)}
                                    placeholder="กรอกที่อยู่จัดส่ง"
                                    rows={3}
                                    className="w-full resize-y rounded-xl border border-gray-300 px-4 py-2 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">ประเภท</label>
                                <select
                                    value={saleOrderType}
                                    onChange={(e) => setSaleOrderType(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-gray-300 px-4 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                    disabled={true}
                                >
                                    <option value="online">ขายบนเว็บไซต์</option>
                                    <option value="order">ขายจากการสั่งซื้อ</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">รายละเอียด</label>
                                <textarea
                                    value={saleOrderDetail}
                                    onChange={(e) => setSaleOrderDetail(e.target.value)}
                                    placeholder="กรอกรายละเอียด"
                                    rows={2}
                                    className="w-full resize-y rounded-xl border border-gray-300 px-4 py-2 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">รายการสินค้า</h3>
                            <button
                                type="button"
                                onClick={openSelectModal}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                เพิ่มรายการสินค้า
                            </button>
                        </div>

                        {errors.items && (
                            <p className="mb-3 text-sm text-red-500">{errors.items}</p>
                        )}

                        <div className="space-y-3">
                            {items.length > 0 ? (
                                items.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-900"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(item.id)}
                                                disabled={isSubmitting}
                                                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                                title="ลบรายการ"
                                            >
                                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ชื่อสินค้า</label>
                                                <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                                    {item.product_name}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">
                                                    จำนวน (สูงสุด {item.max_qty})
                                                </label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={item.max_qty}
                                                    value={item.sale_order_list_qty}
                                                    onChange={(e) => updateItem(item.id, 'sale_order_list_qty', e.target.valueAsNumber)}
                                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                                    disabled={isSubmitting}
                                                />
                                                {errors[`item_${index}_qty`] && (
                                                    <p className="mt-1 text-xs text-red-500">{errors[`item_${index}_qty`]}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">ราคา/หน่วย</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={item.sale_order_list_price}
                                                    onChange={(e) => updateItem(item.id, 'sale_order_list_price', e.target.valueAsNumber)}
                                                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                                    disabled={isSubmitting}
                                                />
                                                {errors[`item_${index}_price`] && (
                                                    <p className="mt-1 text-xs text-red-500">{errors[`item_${index}_price`]}</p>
                                                )}
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
                                    ยังไม่มีรายการสินค้า กรุณากดเพิ่มรายการสินค้า
                                </div>
                            )}
                        </div>

                        {/* VAT Summary */}
                        {items.length > 0 && (
                            <div className="mt-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-lg">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm md:text-base">
                                        <span>ยอดก่อน VAT</span>
                                        <span>฿{formatCurrency(vatSummary.subtotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm md:text-base">
                                        <span>VAT 7%</span>
                                        <span>฿{formatCurrency(vatSummary.vatAmount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-white/30 pt-2">
                                        <span className="text-lg font-semibold">ยอดรวมทั้งสิ้น</span>
                                        <span className="text-2xl font-bold">฿{formatCurrency(vatSummary.total)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer Buttons */}
                        <div className="mt-6 flex gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={resetAndClose}
                                disabled={isSubmitting}
                                className="flex-1 rounded-xl border-2 border-gray-200 bg-gray-100 px-6 py-3.5 font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || items.length === 0}
                                className="flex-1 rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? 'กำลังบันทึก...' : 'สร้างใบขายสินค้า'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Selection Modal */}
            {isSelectModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-300/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
                        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">เลือกสินค้า</h3>
                                <button
                                    onClick={() => setIsSelectModalOpen(false)}
                                    className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                                    type="button"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="mt-3 flex gap-2">
                                <input
                                    type="text"
                                    value={selectionSearch}
                                    onChange={(e) => setSelectionSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSelectionSearch()}
                                    placeholder="ค้นหาสินค้า..."
                                    className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                                />
                                <button
                                    onClick={handleSelectionSearch}
                                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                    type="button"
                                >
                                    ค้นหา
                                </button>
                                {selectionAppliedSearch && (
                                    <button
                                        onClick={handleSelectionClearSearch}
                                        className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                                        type="button"
                                    >
                                        ล้าง
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {isSelectionLoading ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">กำลังโหลด...</div>
                            ) : selectionRows.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">ไม่พบรายการสินค้า</div>
                            ) : (
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="w-12 px-4 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={allCurrentPageSelected}
                                                    onChange={toggleSelectAllCurrentPage}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">ชื่อสินค้า</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-200">จำนวน</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-200">ราคา/หน่วย</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {selectionRows.map((row) => {
                                            const isSelected = !!selectedFetchItems[row.fetch_sale_order_id];
                                            return (
                                                <tr
                                                    key={row.fetch_sale_order_id}
                                                    onClick={() => toggleFetchItemSelection(row)}
                                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleFetchItemSelection(row)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-100">{row.fetch_sale_order_name}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-gray-800 dark:text-gray-100">{row.fetch_sale_order_qty}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-gray-800 dark:text-gray-100">฿{formatCurrency(Number(row.fetch_sale_order_price))}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {showSelectionPagination && (
                            <div className="border-t border-gray-200 p-3 dark:border-gray-700">
                                <Pagination
                                    meta={selectionMeta!}
                                    currentPage={selectionPage}
                                    onPageChange={setSelectionPage}
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                เลือกแล้ว {selectedCount} รายการ
                            </span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsSelectModalOpen(false)}
                                    className="rounded-xl border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                    type="button"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={addSelectedItems}
                                    disabled={selectedCount === 0}
                                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    type="button"
                                >
                                    เพิ่ม {selectedCount > 0 ? `(${selectedCount})` : ''}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ActionResultDialog
                isOpen={resultDialog.isOpen}
                status={resultDialog.status}
                action={resultDialog.action}
                message={resultDialog.message}
                onClose={handleResultDialogClose}
            />
        </>
    );
}
