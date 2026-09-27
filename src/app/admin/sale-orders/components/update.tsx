'use client';

import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import Pagination from '@/components/Pagination';
import SaleOrderModel from '@/models/sale-order';
import { FetchSaleOrder, FetchSaleOrderResponse, SaleOrder, SaleOrderList } from '@/types/sale-order';
import { PaginationMeta } from '@/types/pagination';
import { calculateVatSummary, VAT_TYPE_OPTIONS, VatType } from '@/lib/vat';
import useVatRate from '@/hooks/useVatRate';

interface SaleOrderItemForm {
    id: string;
    fetch_sale_order_id: string;
    product_name: string;
    sale_order_list_qty: number;
    sale_order_list_price: number;
    sale_order_list_cost: number;
    max_qty: number;
    job_order_id: string;
}

interface UpdateSaleOrderFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData: SaleOrder;
}

const saleOrderModel = new SaleOrderModel();

const mapListToFormItem = (item: SaleOrderList): SaleOrderItemForm => ({
    id: crypto.randomUUID(),
    job_order_id: item.job_order_id || '',
    fetch_sale_order_id: item.fetch_sale_order_id || '',
    product_name: item.product_name,
    sale_order_list_qty: Number(item.sale_order_list_qty || 0),
    sale_order_list_price: Number(item.sale_order_list_price || 0),
    sale_order_list_cost: Number(item.sale_order_list_cost || 0),
    max_qty: Number(item.sale_order_list_qty || 0),
});

const mapFetchToFormItem = (item: FetchSaleOrder): SaleOrderItemForm => ({
    id: crypto.randomUUID(),
    job_order_id: item.job_order_id,
    fetch_sale_order_id: item.fetch_sale_order_id,
    product_name: item.fetch_sale_order_name,
    sale_order_list_qty: Number(item.fetch_sale_order_qty || 0),
    sale_order_list_price: Number(item.fetch_sale_order_price || 0),
    sale_order_list_cost: Number(item.fetch_sale_order_cost || 0),
    max_qty: Number(item.fetch_sale_order_qty || 0),
});

export default function UpdateSaleOrderForm({ isOpen, onClose, onSuccess, initialData }: UpdateSaleOrderFormProps) {
    const settingsVatRate = useVatRate();
    // The API recalculates an edited order at its own stored rate and keeps
    // its shipping (TASK-0038), so the preview uses the same figures.
    const vatRate =
        initialData.vat_rate !== undefined && initialData.vat_rate !== null
            ? Number(initialData.vat_rate)
            : settingsVatRate;
    const shippingFee = Number(initialData.sale_order_shipping_fee ?? 0);
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
        action: 'update',
        message: '',
    });

    const existingFetchIds = useMemo(() => new Set(items.map((item) => item.fetch_sale_order_id).filter(Boolean)), [items]);

    useEffect(() => {
        if (!isOpen || !initialData) return;
        setSaleOrderName(initialData.sale_order_name || '');
        setSaleOrderDetail(initialData.sale_order_detail || '');
        setShippingAddressName(initialData.shipping_address_name || '');
        setSaleOrderType(initialData.sale_order_type || 'order');
        setVatType(initialData.vat_type || 'none');
        setItems((initialData.saleOrderLists || []).map(mapListToFormItem));
        setErrors({});
    }, [isOpen, initialData?.sale_order_id]);

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

    const itemsTotal = useMemo(() => items.reduce((sum, item) => sum + calculateItemTotal(item), 0), [items]);
    const grandTotal = itemsTotal + shippingFee;
    const vatSummary = useMemo(() => calculateVatSummary(grandTotal, vatType, vatRate), [grandTotal, vatType, vatRate]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            const user = Cookies.get('user') ? JSON.parse(Cookies.get('user') as string) : null;
            if (!user) throw new Error('User not authenticated');

            await saleOrderModel.updateSaleOrder({
                sale_order_id: initialData.sale_order_id,
                sale_order_name: saleOrderName,
                sale_order_detail: saleOrderDetail,
                shipping_address_name: shippingAddressName,
                sale_order_type: saleOrderType,
                vat_type: vatType,
                sale_order_subtotal: vatSummary.subtotal,
                sale_order_vat_amount: vatSummary.vatAmount,
                sale_order_total: vatSummary.total,
                create_by: initialData.create_by,
                update_by: user.employee_id,
                saleOrderLists: items.map((item) => ({
                    fetch_sale_order_id: item.fetch_sale_order_id || undefined,
                    product_name: item.product_name,
                    sale_order_list_qty: Number(item.sale_order_list_qty),
                    sale_order_list_price: Number(item.sale_order_list_price),
                    sale_order_list_total: calculateItemTotal(item),
                    sale_order_list_cost: Number(item.sale_order_list_cost),
                    job_order_id : item.job_order_id
                })),
            });

            setResultDialog({ isOpen: true, status: 'success', action: 'update', message: 'แก้ไขใบขายสินค้าสำเร็จ' });
        } catch (error) {
            console.error('Failed to update sale order:', error);
            setResultDialog({
                isOpen: true,
                status: 'error',
                action: 'update',
                message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการแก้ไขใบขายสินค้า',
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
            onClose();
        }
    };

    if (!isOpen) return null;

    const selectedCount = Object.keys(selectedFetchItems).length;
    const showSelectionPagination = (selectionMeta?.total || 0) > 10 && (selectionMeta?.last_page || 0) > 1;
    const allCurrentPageSelected =
        selectionRows.length > 0 && selectionRows.every((row) => selectedFetchItems[row.fetch_sale_order_id]);

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm">
                <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-[var(--color-bg-primary)] overlay-surface">
                    <div className="border-b border-[var(--border)] px-6 py-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--ink)]">แก้ไขใบขายสินค้า</h2>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                aria-label="ปิดหน้าต่าง"
                                className="ka-btn ka-btn--icon"
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
                                <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รหัสใบขายสินค้า</label>
                                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--ink)] shadow-sm">
                                    {initialData.sale_order_code || initialData.sale_order_id}
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                                    ชื่อใบขายสินค้า <span className="text-[var(--danger)]">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={saleOrderName}
                                    onChange={(e) => setSaleOrderName(e.target.value)}
                                    placeholder="กรอกชื่อใบขายสินค้า"
                                    className="ka-input h-11 w-full"
                                    disabled={isSubmitting}
                                />
                                {errors.sale_order_name && (
                                    <p className="mt-1 text-[13px] text-[var(--danger)]">{errors.sale_order_name}</p>
                                )}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รูปแบบ VAT</label>
                                <select
                                    value={vatType}
                                    onChange={(e) => setVatType(e.target.value as VatType)}
                                    className="ka-input h-11 w-full"
                                    disabled={isSubmitting}
                                >
                                    {VAT_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">ประเภท</label>
                                <select
                                    value={saleOrderType}
                                    onChange={(e) => setSaleOrderType(e.target.value)}
                                    className="ka-input h-11 w-full"
                                    disabled={true}
                                >
                                    <option value="online">ขายบนเว็บไซต์</option>
                                    <option value="order">ขายจากการสั่งซื้อ</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">ที่อยู่จัดส่ง</label>
                                <textarea
                                    value={shippingAddressName}
                                    onChange={(e) => setShippingAddressName(e.target.value)}
                                    placeholder="กรอกที่อยู่จัดส่ง"
                                    rows={3}
                                    className="ka-textarea w-full resize-y"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">รายละเอียด</label>
                                <textarea
                                    value={saleOrderDetail}
                                    onChange={(e) => setSaleOrderDetail(e.target.value)}
                                    placeholder="กรอกรายละเอียด"
                                    rows={2}
                                    className="ka-textarea w-full resize-y"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-[var(--ink)]">รายการสินค้า</h3>
                            <button
                                type="button"
                                onClick={openSelectModal}
                                disabled={isSubmitting}
                                className="ka-btn ka-btn--primary min-h-11 flex items-center gap-2"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                เพิ่มรายการสินค้า
                            </button>
                        </div>

                        {errors.items && <p className="mb-3 text-sm text-[var(--danger)]">{errors.items}</p>}

                        <div className="space-y-3">
                            {items.length > 0 ? (
                                items.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl border border-[var(--border)] bg-[var(--color-bg-secondary)] p-4"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand-ink)]">
                                                {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(item.id)}
                                                disabled={isSubmitting}
                                                className="ka-btn ka-btn--ghost ka-btn--icon hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                                                title="ลบรายการ"
                                            >
                                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                            <div>
                                                <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">ชื่อสินค้า</label>
                                                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--ink)]">
                                                    {item.product_name}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">
                                                    จำนวน (สูงสุด {item.max_qty})
                                                </label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={item.max_qty}
                                                    value={item.sale_order_list_qty}
                                                    onChange={(e) => updateItem(item.id, 'sale_order_list_qty', e.target.valueAsNumber)}
                                                    className="ka-input w-full"
                                                    disabled={isSubmitting}
                                                />
                                                {errors[`item_${index}_qty`] && (
                                                    <p className="mt-1 text-[13px] text-[var(--danger)]">{errors[`item_${index}_qty`]}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[13px] font-semibold text-[var(--ink-muted)]">ราคา/หน่วย</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={item.sale_order_list_price}
                                                    onChange={(e) => updateItem(item.id, 'sale_order_list_price', e.target.valueAsNumber)}
                                                    className="ka-input w-full"
                                                    disabled={isSubmitting}
                                                />
                                                {errors[`item_${index}_price`] && (
                                                    <p className="mt-1 text-[13px] text-[var(--danger)]">{errors[`item_${index}_price`]}</p>
                                                )}
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
                                    ยังไม่มีรายการสินค้า กรุณากดเพิ่มรายการสินค้า
                                </div>
                            )}
                        </div>

                        {/* VAT Summary */}
                        {items.length > 0 && (
                            <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 text-[var(--color-text-primary)]">
                                <div className="space-y-2">
                                    {shippingFee > 0 && (
                                        <>
                                            <div className="flex items-center justify-between text-sm md:text-base">
                                                <span>ยอดสินค้า</span>
                                                <span>฿{formatCurrency(itemsTotal)}</span>
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
                                        <span>VAT {vatRate}%</span>
                                        <span>฿{formatCurrency(vatSummary.vatAmount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                                        <span className="text-lg font-semibold">ยอดรวมทั้งสิ้น</span>
                                        <span className="text-2xl font-bold">฿{formatCurrency(vatSummary.total)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer Buttons */}
                        <div className="mt-6 flex gap-3 border-t border-[var(--border)] pt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="ka-btn flex-1"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || items.length === 0}
                                className="ka-btn ka-btn--primary min-h-11 flex-1"
                            >
                                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Selection Modal */}
            {isSelectModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm">
                    <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-[var(--color-bg-primary)] overlay-surface">
                        <div className="border-b border-[var(--border)] px-6 py-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-[var(--ink)]">เลือกสินค้า</h3>
                                <button
                                    onClick={() => setIsSelectModalOpen(false)}
                                    aria-label="ปิดหน้าต่าง"
                                    className="ka-btn ka-btn--icon"
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
                                    className="ka-input flex-1"
                                />
                                <button
                                    onClick={handleSelectionSearch}
                                    className="ka-btn ka-btn--primary min-h-11"
                                    type="button"
                                >
                                    ค้นหา
                                </button>
                                {selectionAppliedSearch && (
                                    <button
                                        onClick={handleSelectionClearSearch}
                                        className="ka-btn"
                                        type="button"
                                    >
                                        ล้าง
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {isSelectionLoading ? (
                                <div className="p-8 text-center text-[var(--ink-muted)]">กำลังโหลด...</div>
                            ) : selectionRows.length === 0 ? (
                                <div className="p-8 text-center text-[var(--ink-muted)]">ไม่พบรายการสินค้า</div>
                            ) : (
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-[var(--bg-subtle)]">
                                        <tr>
                                            <th className="w-12 px-4 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={allCurrentPageSelected}
                                                    onChange={toggleSelectAllCurrentPage}
                                                    className="ka-check"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--ink)]">ชื่อสินค้า</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-[var(--ink)]">จำนวน</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-[var(--ink)]">ราคา/หน่วย</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {selectionRows.map((row) => {
                                            const isSelected = !!selectedFetchItems[row.fetch_sale_order_id];
                                            return (
                                                <tr
                                                    key={row.fetch_sale_order_id}
                                                    onClick={() => toggleFetchItemSelection(row)}
                                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-[var(--brand-soft)] ' : 'hover:bg-[var(--bg-subtle)] '}`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleFetchItemSelection(row)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="ka-check"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-[var(--ink)]">{row.fetch_sale_order_name}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-[var(--ink)]">{row.fetch_sale_order_qty}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-[var(--ink)]">฿{formatCurrency(Number(row.fetch_sale_order_price))}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {showSelectionPagination && (
                            <div className="border-t border-[var(--border)] p-3">
                                <Pagination meta={selectionMeta!} currentPage={selectionPage} onPageChange={setSelectionPage} />
                            </div>
                        )}

                        <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4">
                            <span className="text-sm text-[var(--ink-muted)]">เลือกแล้ว {selectedCount} รายการ</span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsSelectModalOpen(false)}
                                    className="ka-btn"
                                    type="button"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={addSelectedItems}
                                    disabled={selectedCount === 0}
                                    className="ka-btn ka-btn--primary min-h-11"
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
