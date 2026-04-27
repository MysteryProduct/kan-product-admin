'use client';
import { useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { PaginationMeta } from '@/types/pagination';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import SaleOrderModel from '@/models/sale-order';
import { FetchSaleOrder, FetchSaleOrderResponse, SaleOrder, SaleOrderResponse } from '@/types/sale-order';
import InsertSaleOrderForm from './components/insert';
import UpdateSaleOrderForm from './components/update';
import SaleOrderDetailModal from './components/detail';
import ConfirmDialog from '@/components/ConfirmDialog';
import ActionResultDialog, { ActionResultDialogAction } from '@/components/ActionResultDialog';
import { formatThaiDate } from '@/lib/date-format';
import { VAT_TYPE_LABELS } from '@/lib/vat';

const saleOrderModel = new SaleOrderModel();

type SaleOrderSortField = 'sale_order_total' | null;
type SortOrder = 'ASC' | 'DESC';

export default function SaleOrderPage() {
    const { can } = usePermissions();
    const canAddSaleOrder = can('sale_orders', 'add');
    const canEditSaleOrder = can('sale_orders', 'edit');
    const canDeleteSaleOrder = can('sale_orders', 'delete');

    const [fetchSaleOrderPage, setFetchSaleOrderPage] = useState(1);
    const [saleOrderPage, setSaleOrderPage] = useState(1);

    const [fetchSaleOrders, setFetchSaleOrders] = useState<FetchSaleOrderResponse | null>(null);
    const [saleOrders, setSaleOrders] = useState<SaleOrderResponse | null>(null);

    const [fetchSaleOrderMeta, setFetchSaleOrderMeta] = useState<PaginationMeta | null>(null);
    const [saleOrderMeta, setSaleOrderMeta] = useState<PaginationMeta | null>(null);

    const [loading, setLoading] = useState(false);

    const [saleOrderSortField, setSaleOrderSortField] = useState<SaleOrderSortField>(null);
    const [saleOrderSortOrder, setSaleOrderSortOrder] = useState<SortOrder>('ASC');
    const [fetchSaleOrderSearch, setFetchSaleOrderSearch] = useState('');
    const [fetchSaleOrderAppliedSearch, setFetchSaleOrderAppliedSearch] = useState('');
    const [saleOrderSearch, setSaleOrderSearch] = useState('');
    const [saleOrderAppliedSearch, setSaleOrderAppliedSearch] = useState('');

    const [isInsertOpen, setIsInsertOpen] = useState(false);
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [selectedFetchSaleOrder, setSelectedFetchSaleOrder] = useState<FetchSaleOrder | null>(null);
    const [selectedSaleOrder, setSelectedSaleOrder] = useState<SaleOrder | null>(null);
    const [saleOrderToDelete, setSaleOrderToDelete] = useState<SaleOrder | null>(null);

    const [resultDialog, setResultDialog] = useState<{
        isOpen: boolean;
        status: 'success' | 'error';
        action: ActionResultDialogAction;
        message: string;
    }>({
        isOpen: false,
        status: 'success',
        action: 'delete',
        message: '',
    });

    useEffect(() => {
        void loadFetchSaleOrders();
    }, [fetchSaleOrderPage, fetchSaleOrderAppliedSearch]);

    useEffect(() => {
        void loadSaleOrders();
    }, [saleOrderPage, saleOrderAppliedSearch, saleOrderSortField, saleOrderSortOrder]);

    const loadFetchSaleOrders = async (page = fetchSaleOrderPage, search = fetchSaleOrderAppliedSearch) => {
        try {
            setLoading(true);
            const result = await saleOrderModel.getFetchSaleOrders(page, 10, search);
            setFetchSaleOrders(result);
            setFetchSaleOrderMeta(result.meta);
        } catch (error) {
            console.error('Failed to fetch fetch-sale-orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSaleOrders = async (
        page = saleOrderPage,
        search = saleOrderAppliedSearch,
        sortField = saleOrderSortField,
        sortOrder = saleOrderSortOrder,
    ) => {
        try {
            setLoading(true);
            const result = await saleOrderModel.getSaleOrders(page, 10, search, sortField, sortOrder);
            setSaleOrders(result);
            setSaleOrderMeta(result.meta);
        } catch (error) {
            console.error('Failed to fetch sale orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaleOrderSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
        if (!sort) {
            setSaleOrderSortField(null);
            setSaleOrderSortOrder('ASC');
            return;
        }
        const nextField = sort.key as SaleOrderSortField;
        if (nextField !== 'sale_order_total') {
            setSaleOrderSortField(null);
            setSaleOrderSortOrder('ASC');
            return;
        }
        setSaleOrderSortField(nextField);
        setSaleOrderSortOrder(sort.direction);
    };

    const handleFetchSaleOrderSearch = () => {
        setFetchSaleOrderPage(1);
        setFetchSaleOrderAppliedSearch(fetchSaleOrderSearch.trim());
    };

    const handleFetchSaleOrderClearSearch = () => {
        setFetchSaleOrderSearch('');
        setFetchSaleOrderAppliedSearch('');
        setFetchSaleOrderPage(1);
    };

    const handleSaleOrderSearch = () => {
        setSaleOrderPage(1);
        setSaleOrderAppliedSearch(saleOrderSearch.trim());
    };

    const handleSaleOrderClearSearch = () => {
        setSaleOrderSearch('');
        setSaleOrderAppliedSearch('');
        setSaleOrderPage(1);
    };

    const handleDeleteSaleOrder = async () => {
        if (!saleOrderToDelete) return;
        try {
            await saleOrderModel.deleteSaleOrder(saleOrderToDelete.sale_order_id);
            setResultDialog({ isOpen: true, status: 'success', action: 'delete', message: 'ลบใบขายสินค้าสำเร็จ' });
            setIsDeleteDialogOpen(false);
            setSaleOrderToDelete(null);

            const nextSaleOrderPage =
                saleOrderPage > 1 && (saleOrders?.data.length || 0) === 1 ? saleOrderPage - 1 : saleOrderPage;

            if (nextSaleOrderPage !== saleOrderPage) {
                setSaleOrderPage(nextSaleOrderPage);
            }

            await Promise.all([
                loadSaleOrders(nextSaleOrderPage, saleOrderAppliedSearch, saleOrderSortField, saleOrderSortOrder),
                loadFetchSaleOrders(fetchSaleOrderPage, fetchSaleOrderAppliedSearch),
            ]);
        } catch (error) {
            setResultDialog({
                isOpen: true,
                status: 'error',
                action: 'delete',
                message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบใบขายสินค้า',
            });
        }
    };

    const openSaleOrderDetail = async (saleOrder: SaleOrder) => {
        try {
            const detail = await saleOrderModel.getSaleOrderById(saleOrder.sale_order_id);
            setSelectedSaleOrder(detail);
            setIsDetailOpen(true);
        } catch (error) {
            console.error('Failed to load sale order detail:', error);
            setResultDialog({
                isOpen: true,
                status: 'error',
                action: 'delete',
                message: error instanceof Error ? error.message : 'ไม่สามารถโหลดรายละเอียดใบขายสินค้าได้',
            });
        }
    };

    const openSaleOrderUpdate = async (saleOrder: SaleOrder) => {
        try {
            const detail = await saleOrderModel.getSaleOrderById(saleOrder.sale_order_id);
            setSelectedSaleOrder(detail);
            setIsUpdateOpen(true);
        } catch (error) {
            console.error('Failed to load sale order for update:', error);
            setResultDialog({
                isOpen: true,
                status: 'error',
                action: 'delete',
                message: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลเพื่อแก้ไขใบขายสินค้าได้',
            });
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);

    const fetchSaleOrderColumns: DataTableColumn<FetchSaleOrder>[] = [
        {
            key: 'fetch_sale_order_name',
            label: 'ชื่อสินค้า',
        },
        {
            key: 'fetch_sale_order_qty',
            label: 'จำนวน',
            render: (value) => String(Number(value || 0)),
        },
        {
            key: 'fetch_sale_order_price',
            label: 'ราคา/หน่วย',
            render: (value) => `฿${formatCurrency(Number(value || 0))}`,
        },
        {
            key: 'fetch_sale_order_cost',
            label: 'ต้นทุน/หน่วย',
            render: (value) => `฿${formatCurrency(Number(value || 0))}`,
        },
        {
            key: 'create_date',
            label: 'วันที่',
            render: (value) => formatThaiDate(value as Date),
        },
        {
            key: 'fetch_sale_order_id',
            label: 'สร้างใบขายสินค้า',
            width: '180px',
            render: (_, row) => (
                <button
                    onClick={() => {
                        setSelectedFetchSaleOrder(row);
                        setIsInsertOpen(true);
                    }}
                    disabled={!canAddSaleOrder}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                >
                    สร้างใบขายสินค้า
                </button>
            ),
        },
    ];

    const saleOrderColumns: DataTableColumn<SaleOrder>[] = [
        {
            key: 'sale_order_code',
            label: 'รหัสใบขายสินค้า',
            width: '200px',
            render: (_, row) => row.sale_order_code || row.sale_order_id,
        },
        {
            key: 'sale_order_name',
            label: 'ชื่อใบขายสินค้า',
        },
        {
            key: 'shipping_address_name',
            label: 'ที่อยู่จัดส่ง',
            render: (value) => (value as string) || '-',
        },
        {
            key: 'sale_order_total',
            label: 'ยอดรวม',
            sortable: true,
            render: (value) => `฿${formatCurrency(Number(value || 0))}`,
        },
        {
            key: 'vat_type',
            label: 'VAT',
            render: (value) => VAT_TYPE_LABELS[(value as SaleOrder['vat_type']) || 'none'],
        },
        {
            key: 'sale_order_status',
            label: 'สถานะ',
            render: (_, row) => {
                const status = row.sale_order_status || 'unknown';
                const statusColors: Record<string, string> = {
                    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
                    approved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
                    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
                    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
                };
                const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
                const statusLabels: Record<string, string> = {
                    pending: 'รอดำเนินการ',
                    approved: 'อนุมัติแล้ว',
                    rejected: 'ปฏิเสธ',
                    completed: 'เสร็จสิ้น',
                };
                return (
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colorClass}`}>
                        {statusLabels[status] || status}
                    </span>
                );
            },
        },
        {
            key: 'sale_order_id',
            label: 'การจัดการ',
            width: '160px',
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => void openSaleOrderDetail(row)}
                        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-green-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-green-400"
                        type="button"
                        title="ดูรายละเอียด"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>

                    {canEditSaleOrder && row.sale_order_status === 'pending' && (
                        <button
                            onClick={() => void openSaleOrderUpdate(row)}
                            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                            type="button"
                            title="แก้ไข"
                        >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
                            </svg>
                        </button>
                    )}

                    {canDeleteSaleOrder && row.sale_order_status === 'pending' && (
                        <button
                            onClick={() => {
                                setSaleOrderToDelete(row);
                                setIsDeleteDialogOpen(true);
                            }}
                            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
                            type="button"
                            title="ลบ"
                        >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="bg-gray-50 p-2 dark:bg-gray-900 sm:p-4 md:p-6 lg:p-8">
            {loading && <LoadingSkeletonProps />}
            <div className="space-y-6">
                {/* Section 1: Fetch Sale Orders */}
                <section className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
                    <div className="border-b border-gray-100 p-4 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            รายการสินค้าพร้อมขาย (สำหรับสร้างใบขายสินค้า)
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            เลือกรายการสินค้าจากตารางนี้ แล้วกดปุ่มสร้างใบขายสินค้า
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                                type="text"
                                value={fetchSaleOrderSearch}
                                onChange={(e) => setFetchSaleOrderSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleFetchSaleOrderSearch();
                                    }
                                }}
                                placeholder="ค้นหาสินค้าพร้อมขายด้วย keyword"
                                className="h-10 flex-1 rounded-xl border border-gray-300 px-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleFetchSaleOrderSearch}
                                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                                >
                                    ค้นหา
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFetchSaleOrderClearSearch}
                                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                >
                                    ล้าง
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-2">
                        <DataTable
                            data={fetchSaleOrders?.data || []}
                            columns={fetchSaleOrderColumns}
                            keyField="fetch_sale_order_id"
                            className="bg-white dark:bg-gray-800"
                            paginationMeta={fetchSaleOrderMeta}
                            currentPage={fetchSaleOrderPage}
                            onPageChange={setFetchSaleOrderPage}
                        />
                    </div>
                </section>

                {/* Section 2: Sale Orders */}
                <section className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
                    <div className="border-b border-gray-100 p-4 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">รายการใบขายสินค้า</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            ตารางใบขายสินค้าทั้งหมด พร้อมดูรายละเอียด แก้ไข และลบ
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                                type="text"
                                value={saleOrderSearch}
                                onChange={(e) => setSaleOrderSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaleOrderSearch();
                                    }
                                }}
                                placeholder="ค้นหาใบขายสินค้าด้วย keyword"
                                className="h-10 flex-1 rounded-xl border border-gray-300 px-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaleOrderSearch}
                                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                                >
                                    ค้นหา
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaleOrderClearSearch}
                                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                >
                                    ล้าง
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-2">
                        <DataTable
                            data={saleOrders?.data || []}
                            columns={saleOrderColumns}
                            keyField="sale_order_id"
                            className="bg-white dark:bg-gray-800"
                            paginationMeta={saleOrderMeta}
                            currentPage={saleOrderPage}
                            onPageChange={setSaleOrderPage}
                            onSortChange={handleSaleOrderSortChange}
                        />
                    </div>
                </section>
            </div>

            {canAddSaleOrder && (
                <InsertSaleOrderForm
                    isOpen={isInsertOpen}
                    onClose={() => {
                        setIsInsertOpen(false);
                        setSelectedFetchSaleOrder(null);
                    }}
                    onSuccess={async () => {
                        await loadSaleOrders();
                        await loadFetchSaleOrders();
                    }}
                    initialFetchSaleOrder={selectedFetchSaleOrder}
                />
            )}

            {canEditSaleOrder && selectedSaleOrder && (
                <UpdateSaleOrderForm
                    isOpen={isUpdateOpen}
                    onClose={() => {
                        setIsUpdateOpen(false);
                        setSelectedSaleOrder(null);
                    }}
                    onSuccess={async () => {
                        await loadSaleOrders();
                    }}
                    initialData={selectedSaleOrder}
                />
            )}

            {selectedSaleOrder && (
                <SaleOrderDetailModal
                    isOpen={isDetailOpen}
                    onClose={() => {
                        setIsDetailOpen(false);
                        setSelectedSaleOrder(null);
                    }}
                    onSuccess={async () => {
                        await loadSaleOrders();
                    }}
                    saleOrder={selectedSaleOrder}
                />
            )}

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                title="ยืนยันการลบ"
                message={`คุณแน่ใจหรือไม่ว่าต้องการลบใบขายสินค้า "${saleOrderToDelete?.sale_order_name || ''}"?`}
                onConfirm={handleDeleteSaleOrder}
                onCancel={() => {
                    setIsDeleteDialogOpen(false);
                    setSaleOrderToDelete(null);
                }}
            />

            <ActionResultDialog
                isOpen={resultDialog.isOpen}
                status={resultDialog.status}
                action={resultDialog.action}
                message={resultDialog.message}
                onClose={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
