'use client';
import { useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { PaginationMeta } from '@/types/pagination';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { usePermissions } from '@/hooks/usePermissions';
import PurchaseOrderModel from '@/models/purchase-order';
import { PurchaseOrder, PurchaseOrderResponse } from '@/types/purchase-order';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import { PurchaseReceipt, PurchaseReceiptResponse } from '@/types/purchase-receipt';
import InsertPurchaseReceiptForm from './components/insert';
import UpdatePurchaseReceiptForm from './components/update';
import PurchaseReceiptDetailModal from './components/detail';
import ConfirmDialog from '@/components/ConfirmDialog';
import ActionResultDialog from '@/components/ActionResultDialog';
import { formatThaiDate } from '@/lib/date-format';
import { VAT_TYPE_LABELS } from '@/lib/vat';
import { PURCHASE_ORDER_STATUS_TONE } from '@/lib/status-tones';
import StatusBadge from '@/components/StatusBadge';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';

const purchaseOrderModel = new PurchaseOrderModel();
const purchaseReceiptModel = new PurchaseReceiptModel();

type PurchaseOrderSortField = 'purchase_date' | 'purchase_order_total' | null;
type PurchaseReceiptSortField = 'entry_date' | 'purchase_receipt_total' | null;
type SortOrder = 'ASC' | 'DESC';

export default function PurchaseReceiptPage() {
    const { can } = usePermissions();
    const canAddPurchaseReceipt = can('purchase_receipt', 'add');
    const canEditPurchaseReceipt = can('purchase_receipt', 'edit');
    const canDeletePurchaseReceipt = can('purchase_receipt', 'delete');

    const [purchaseOrderPage, setPurchaseOrderPage] = useState(1);
    const [purchaseReceiptPage, setPurchaseReceiptPage] = useState(1);

    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderResponse | null>(null);
    const [purchaseReceipts, setPurchaseReceipts] = useState<PurchaseReceiptResponse | null>(null);

    const [purchaseOrderMeta, setPurchaseOrderMeta] = useState<PaginationMeta | null>(null);
    const [purchaseReceiptMeta, setPurchaseReceiptMeta] = useState<PaginationMeta | null>(null);

    const [loading, setLoading] = useState(false);
    const [receiptsError, setReceiptsError] = useState<string | null>(null);
    const [purchaseOrdersError, setPurchaseOrdersError] = useState<string | null>(null);

    const [purchaseOrderSortField, setPurchaseOrderSortField] = useState<PurchaseOrderSortField>(null);
    const [purchaseOrderSortOrder, setPurchaseOrderSortOrder] = useState<SortOrder>('ASC');

    const [purchaseReceiptSortField, setPurchaseReceiptSortField] = useState<PurchaseReceiptSortField>(null);
    const [purchaseReceiptSortOrder, setPurchaseReceiptSortOrder] = useState<SortOrder>('ASC');

    const [isInsertOpen, setIsInsertOpen] = useState(false);
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
    const [selectedPurchaseReceipt, setSelectedPurchaseReceipt] = useState<PurchaseReceipt | null>(null);
    const [purchaseReceiptToDelete, setPurchaseReceiptToDelete] = useState<PurchaseReceipt | null>(null);

    const [resultDialog, setResultDialog] = useState<{
        isOpen: boolean;
        status: 'success' | 'error';
        message: string;
    }>({
        isOpen: false,
        status: 'success',
        message: '',
    });

    useEffect(() => {
        void fetchPurchaseOrders();
    }, [purchaseOrderPage, purchaseOrderSortField, purchaseOrderSortOrder]);

    useEffect(() => {
        void fetchPurchaseReceipts();
    }, [purchaseReceiptPage, purchaseReceiptSortField, purchaseReceiptSortOrder]);

    const fetchPurchaseOrders = async () => {
        try {
            setLoading(true);
            setPurchaseOrdersError(null);
            const purchase = await purchaseOrderModel.advisePurchaseOrders(
                purchaseOrderPage,
                10,
                '',
                purchaseOrderSortField,
                purchaseOrderSortOrder,
            );
            setPurchaseOrders(purchase);
            setPurchaseOrderMeta(purchase.meta);
        } catch (error) {
            console.error('Failed to fetch purchase orders:', error);
            setPurchaseOrdersError(loadErrorText('รายการใบสั่งซื้อ', error));
        } finally {
            setLoading(false);
        }
    };

    const fetchPurchaseReceipts = async () => {
        try {
            setLoading(true);
            setReceiptsError(null);
            const receipt = await purchaseReceiptModel.getPurchaseReceipts(
                purchaseReceiptPage,
                10,
                '',
                purchaseReceiptSortField,
                purchaseReceiptSortOrder,
            );
            setPurchaseReceipts(receipt);
            setPurchaseReceiptMeta(receipt.meta);
        } catch (error) {
            console.error('Failed to fetch purchase receipts:', error);
            setReceiptsError(loadErrorText('รายการใบรับสินค้า', error));
        } finally {
            setLoading(false);
        }
    };

    const handlePurchaseOrderSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
        if (!sort) {
            setPurchaseOrderSortField(null);
            setPurchaseOrderSortOrder('ASC');
            return;
        }

        const nextField = sort.key as PurchaseOrderSortField;
        if (nextField !== 'purchase_date' && nextField !== 'purchase_order_total') {
            setPurchaseOrderSortField(null);
            setPurchaseOrderSortOrder('ASC');
            return;
        }

        setPurchaseOrderSortField(nextField);
        setPurchaseOrderSortOrder(sort.direction);
    };

    const handlePurchaseReceiptSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
        if (!sort) {
            setPurchaseReceiptSortField(null);
            setPurchaseReceiptSortOrder('ASC');
            return;
        }

        const nextField = sort.key as PurchaseReceiptSortField;
        if (nextField !== 'entry_date' && nextField !== 'purchase_receipt_total') {
            setPurchaseReceiptSortField(null);
            setPurchaseReceiptSortOrder('ASC');
            return;
        }

        setPurchaseReceiptSortField(nextField);
        setPurchaseReceiptSortOrder(sort.direction);
    };

    const handleDeletePurchaseReceipt = async () => {
        if (!purchaseReceiptToDelete) {
            return;
        }

        try {
            await purchaseReceiptModel.deletePurchaseReceipt(purchaseReceiptToDelete.purchase_receipt_id);
            setResultDialog({
                isOpen: true,
                status: 'success',
                message: 'ลบใบรับสินค้าสำเร็จ',
            });
            setIsDeleteDialogOpen(false);
            setPurchaseReceiptToDelete(null);

            if (purchaseReceiptPage > 1 && (purchaseReceipts?.data.length || 0) === 1) {
                setPurchaseReceiptPage((prev) => prev - 1);
            } else {
                await fetchPurchaseOrders();
                await fetchPurchaseReceipts();
            }
        } catch (error) {
            setResultDialog({
                isOpen: true,
                status: 'error',
                message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบใบรับสินค้า',
            });
        }
    };

    const openReceiptDetail = async (receipt: PurchaseReceipt) => {
        try {
            const detail = await purchaseReceiptModel.getPurchaseReceiptById(receipt.purchase_receipt_id);
            setSelectedPurchaseReceipt(detail);
            setIsDetailOpen(true);
        } catch (error) {
            console.error('Failed to load purchase receipt detail:', error);
            setResultDialog({
                isOpen: true,
                status: 'error',
                message: error instanceof Error ? error.message : 'ไม่สามารถโหลดรายละเอียดใบรับสินค้าได้',
            });
        }
    };

    const openReceiptUpdate = async (receipt: PurchaseReceipt) => {
        try {
            const detail = await purchaseReceiptModel.getPurchaseReceiptById(receipt.purchase_receipt_id);
            setSelectedPurchaseReceipt(detail);
            setIsUpdateOpen(true);
        } catch (error) {
            console.error('Failed to load purchase receipt for update:', error);
            setResultDialog({
                isOpen: true,
                status: 'error',
                message: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลเพื่อแก้ไขใบรับสินค้าได้',
            });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const purchaseOrderColumns: DataTableColumn<PurchaseOrder>[] = [
        {
            key: 'purchase_order_code',
            label: 'รหัสใบสั่งซื้อ',
            width: '220px',
        },
        {
            key: 'purchase_order_name',
            label: 'ชื่อใบสั่งซื้อ',
        },
        {
            key: 'supplier_name' as any,
            label: 'ผู้จัดจำหน่าย',
            render: (_, row) => row.supplier?.supplier_name || '-',
        },
        {
            key: 'purchase_date',
            label: 'วันที่สั่งซื้อ',
            sortable: true,
            render: (value) => formatThaiDate(value as Date),
        },
        {
            key: 'purchase_order_total',
            label: 'ยอดรวมใบสั่งซื้อ',
            sortable: true,
            render: (value) => `฿${formatCurrency(Number(value || 0))}`,
        },
        {
            key: 'vat_type',
            label: 'VAT',
            render: (value) => VAT_TYPE_LABELS[(value as PurchaseOrder['vat_type']) || 'none'],
        },
        {
            key: 'purchase_order_status',
            label: 'สถานะ',
            render: (_, row) => {
                const status = row.purchase_order_status || 'unknown';
                return (
                    <StatusBadge tone={PURCHASE_ORDER_STATUS_TONE[status]}>{status}</StatusBadge>
                );
            },
        },
        {
            key: 'purchase_order_id',
            label: 'เพิ่มใบรับสินค้า',
            width: '180px',
            render: (_, row) => (
                <button
                    onClick={() => {
                        setSelectedPurchaseOrder(row);
                        setIsInsertOpen(true);
                    }}
                    disabled={!canAddPurchaseReceipt}
                    className="ka-btn ka-btn--primary"
                    type="button"
                >
                    เพิ่มใบรับสินค้า
                </button>
            ),
        },
    ];

    const purchaseReceiptColumns: DataTableColumn<PurchaseReceipt>[] = [
        {
            key: 'purchase_receipt_code' as any,
            label: 'รหัสใบรับสินค้า',
            width: '220px',
            render: (_, row) => row.purchase_receipt_code || '-',
        },
        {
            key: 'purchase_order_id',
            label: 'ใบสั่งซื้อ',
            render: (_, row) => row.purchaseOrder?.purchase_order_code || '-',
        },
        {
            key: 'supplier_id',
            label: 'ผู้จัดจำหน่าย',
            render: (_, row) => row.supplier?.supplier_name || '-',
        },
        {
            key: 'entry_date',
            label: 'วันที่รับสินค้า',
            sortable: true,
            render: (value) => formatThaiDate(value as Date),
        },
        {
            key: 'purchase_receipt_total',
            label: 'ยอดรวมใบรับสินค้า',
            sortable: true,
            render: (value) => `฿${formatCurrency(Number(value || 0))}`,
        },
        {
            key: 'vat_type',
            label: 'VAT',
            render: (value) => VAT_TYPE_LABELS[(value as PurchaseReceipt['vat_type']) || 'none'],
        },
        {
            key: 'purchase_receipt_id',
            label: 'การจัดการ',
            width: '180px',
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => void openReceiptDetail(row)}
                        className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--success)]"
                        type="button"
                        title="ดูรายละเอียด"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>

                    {canEditPurchaseReceipt && row.purchase_receipt_status === 'pending' && (
                        <button
                            onClick={() => void openReceiptUpdate(row)}
                            className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--brand-ink)]"
                            type="button"
                            title="แก้ไข"
                        >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
                            </svg>
                        </button>
                    )}

                    {canDeletePurchaseReceipt && row.purchase_receipt_status === 'pending' && (
                        <button
                            onClick={() => {
                                setPurchaseReceiptToDelete(row);
                                setIsDeleteDialogOpen(true);
                            }}
                            className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--danger)]"
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
        <div className="min-h-full bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
            <LoadErrorBanner message={purchaseOrdersError} onRetry={() => void fetchPurchaseOrders()} className="mb-4" />
            <LoadErrorBanner message={receiptsError} onRetry={() => void fetchPurchaseReceipts()} className="mb-4" />
            {loading && <LoadingSkeletonProps />}
            <div className="space-y-6">
                <section className="rounded-2xl bg-[var(--bg-surface)] shadow-sm ring-1 ring-black/5">
                    <div className="border-b border-[var(--border)] p-4">
                        <h2 className="text-lg font-semibold text-[var(--ink)]">
                            รายการใบสั่งซื้อ (สำหรับสร้างใบรับสินค้า)
                        </h2>
                        <p className="mt-1 text-sm text-[var(--ink-muted)]">
                            เลือกใบสั่งซื้อจากตารางนี้ แล้วกดปุ่มเพิ่มใบรับสินค้า
                        </p>
                    </div>
                    <div className="p-2">
                        
                        <DataTable
                            data={purchaseOrders?.data || []}
                            columns={purchaseOrderColumns}
                            keyField="purchase_order_id"
                            className="bg-[var(--bg-surface)]"
                            paginationMeta={purchaseOrderMeta}
                            currentPage={purchaseOrderPage}
                            onPageChange={setPurchaseOrderPage}
                            onSortChange={handlePurchaseOrderSortChange}
                        />
                    </div>
                </section>

                <section className="rounded-2xl bg-[var(--bg-surface)] shadow-sm ring-1 ring-black/5">
                    <div className="border-b border-[var(--border)] p-4">
                        <h2 className="text-lg font-semibold text-[var(--ink)]">รายการใบรับสินค้า</h2>
                        <p className="mt-1 text-sm text-[var(--ink-muted)]">
                            ตารางใบรับสินค้าทั้งหมด พร้อมดูรายละเอียด แก้ไข และลบ
                        </p>
                    </div>
                    <div className="p-2">
                        <DataTable
                            data={purchaseReceipts?.data || []}
                            columns={purchaseReceiptColumns}
                            keyField="purchase_receipt_id"
                            className="bg-[var(--bg-surface)]"
                            paginationMeta={purchaseReceiptMeta}
                            currentPage={purchaseReceiptPage}
                            onPageChange={setPurchaseReceiptPage}
                            onSortChange={handlePurchaseReceiptSortChange}
                        />
                    </div>
                </section>
            </div>

            {canAddPurchaseReceipt && (
                <InsertPurchaseReceiptForm
                    isOpen={isInsertOpen}
                    onClose={() => {
                        setIsInsertOpen(false);
                        setSelectedPurchaseOrder(null);
                    }}
                    onSuccess={async () => {
                        await fetchPurchaseReceipts();
                        await fetchPurchaseOrders();
                    }}
                    purchaseOrder={selectedPurchaseOrder}
                />
            )}

            {canEditPurchaseReceipt && selectedPurchaseReceipt && (
                <UpdatePurchaseReceiptForm
                    isOpen={isUpdateOpen}
                    onClose={() => {
                        setIsUpdateOpen(false);
                        setSelectedPurchaseReceipt(null);
                    }}
                    onSuccess={async () => {
                        await fetchPurchaseReceipts();
                        await fetchPurchaseOrders();
                    }}
                    initialData={selectedPurchaseReceipt}
                />
            )}

            {selectedPurchaseReceipt && (
                <PurchaseReceiptDetailModal
                    isOpen={isDetailOpen}
                    onClose={() => {
                        setIsDetailOpen(false);
                        setSelectedPurchaseReceipt(null);
                    }}
                    purchaseReceipt={selectedPurchaseReceipt}
                    onSuccess={async () => {
                        await fetchPurchaseReceipts();
                        await fetchPurchaseOrders();
                    }}
                />
            )}

            <ConfirmDialog
                isOpen={canDeletePurchaseReceipt && isDeleteDialogOpen}
                title="ยืนยันการลบใบรับสินค้า"
                message={`คุณแน่ใจหรือไม่ว่าต้องการลบใบรับสินค้า${purchaseReceiptToDelete?.purchase_receipt_code ? ` "${purchaseReceiptToDelete.purchase_receipt_code}"` : 'นี้'}?`}
                onCancel={() => {
                    setIsDeleteDialogOpen(false);
                    setPurchaseReceiptToDelete(null);
                }}
                onConfirm={handleDeletePurchaseReceipt}
            />

            <ActionResultDialog
                isOpen={resultDialog.isOpen}
                status={resultDialog.status}
                action="delete"
                message={resultDialog.message}
                onClose={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
            />
        </div>
    )
}
