'use client';

import { useEffect, useState } from 'react';
import PurchaseOrderModel from '@/models/purchase-order';
import { PurchaseOrder, PurchaseOrderResponse } from '@/types/purchase-order';
import { PaginationMeta } from '@/types/pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import InsertPurchaseOrderForm from './components/insert';
import UpdatePurchaseOrderForm from './components/update';
import PurchaseOrderDetailModal from './components/detail';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import ActionResultDialog from '@/components/ActionResultDialog';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
const purchaseOrderModel = new PurchaseOrderModel();

type SortField = 'purchase_date' | 'purchase_order_total' | null;
type SortOrder = 'ASC' | 'DESC';

export default function PurchaseOrdersPage() {
  const { can } = usePermissions();
  const canAddPurchaseOrder = can('purchase_orders', 'add');
  const canEditPurchaseOrder = can('purchase_orders', 'edit');
  const canDeletePurchaseOrder = can('purchase_orders', 'delete');

  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderResponse | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isInsertFormOpen, setIsInsertFormOpen] = useState(false);
  const [isUpdateFormOpen, setIsUpdateFormOpen] = useState(false);
  const [isDetailFormOpen, setIsDetailFormOpen] = useState(false);
  const [purchaseOrderToUpdate, setPurchaseOrderToUpdate] = useState<PurchaseOrder | null>(null);
  const [purchaseOrderToView, setPurchaseOrderToView] = useState<PurchaseOrder | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [purchaseOrderToDelete, setPurchaseOrderToDelete] = useState<PurchaseOrder | null>(null);
  const [resultDialog, setResultDialog] = useState<{
    isOpen: boolean;
    status: 'success' | 'error';
    message: string;
  }>({
    isOpen: false,
    status: 'success',
    message: '',
  });

  const isValidPurchaseOrder = (value: any): value is PurchaseOrder => {
    return Boolean(value && typeof value === 'object' && value.purchase_order_id);
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, [currentPage, appliedSearchQuery, sortField, sortOrder]);

  const handleSearch = () => {
    setCurrentPage(1);
    setAppliedSearchQuery(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAppliedSearchQuery('');
    setCurrentPage(1);
  };

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      let purchase = await purchaseOrderModel.getPurchaseOrders(currentPage, 10, appliedSearchQuery, sortField, sortOrder, filters);
      setPurchaseOrders(purchase);
      setMeta(purchase.meta);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
    if (!sort) {
      setSortField(null);
      setSortOrder('ASC');
      return;
    }

    const nextField = sort.key as SortField;
    if (nextField !== 'purchase_date' && nextField !== 'purchase_order_total') {
      setSortField(null);
      setSortOrder('ASC');
      return;
    }

    setSortField(nextField);
    setSortOrder(sort.direction);
  };
  const handleDataTableFilterChange = (filters: Record<string, string | string[]>) => {
    let updatedFilters: Record<string, string> = {};
    for (const columnKey in filters) {
      const value = filters[columnKey];
      if (Array.isArray(value)) {
        if (value.length > 0) {
          updatedFilters[columnKey] = JSON.stringify(value);
        }
      } else {
        if (value.trim()) {
          updatedFilters[columnKey] = value;
        }
      }
    }
    setFilters(updatedFilters);
    setTimeout(() => handleRefreshProduct(updatedFilters), 0);
  };
  const handleDelete = async () => {
    if (purchaseOrderToDelete) {
      try {
        await purchaseOrderModel.deletePurchaseOrder(purchaseOrderToDelete.purchase_order_id);
        handleRefreshProduct(filters, true);
        setIsDeleteDialogOpen(false);
        setPurchaseOrderToDelete(null);
        setResultDialog({
          isOpen: true,
          status: 'success',
          message: 'ลบใบสั่งซื้อสำเร็จ',
        });
      } catch (error) {
        console.error('Failed to delete purchase order:', error);
        setResultDialog({
          isOpen: true,
          status: 'error',
          message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบใบสั่งซื้อ',
        });
      }
    }
  };

  const handleRefreshProduct = async (filters: Record<string, string> = {}, checkPageAfterDelete = false) => {
    // รีเฟรชข้อมูลสินค้าเมื่อมีการเพิ่มสินค้าใหม่
    try {
      // คำนวณหน้าที่จะใช้ก่อนเรียก API
      setLoading(true);
      let targetPage = currentPage;

      // ถ้าเป็นการลบข้อมูลและไม่ใช่หน้าแรก และหน้าปัจจุบันมีเพียง 1 รายการ
      // ให้ลดหน้าลงมา 1 หน้า
      if (checkPageAfterDelete && currentPage > 1 && purchaseOrders?.data.length === 1) {
        targetPage = currentPage - 1;
        setCurrentPage(targetPage);
      }

      let purchase = await purchaseOrderModel.getPurchaseOrders(targetPage, 10, appliedSearchQuery, sortField, sortOrder, filters);
      setPurchaseOrders(purchase);
      setMeta(purchase.meta);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Define DataTable columns
  const columns: DataTableColumn<PurchaseOrder>[] = [
    {
      key: 'purchase_order_code' as keyof PurchaseOrder,
      label: 'รหัสใบสั่งซื้อ',
      width: '250px',
    },
    {
      key: 'purchase_order_name' as any as keyof PurchaseOrder,
      label: 'ชื่อใบสั่งซื้อ',
    },
    {
      key: 'supplier_name' as any as keyof PurchaseOrder['supplier'],
      label: 'ชื่อผู้จัดจำหน่าย',
      render: (value, row: PurchaseOrder) => row.supplier?.supplier_name || '',
    },
    {
      key: 'purchase_order_status' as any as keyof PurchaseOrder,
      label: 'สถานะใบสั่งซื้อ',
      filterable: true,
      filterType: 'multi-select',
      filterOptions: [
        { label: "pending", value: 'pending' },
        { label: 'active', value: 'active' },
        { label: 'inactive', value: 'inactive' },
        { label: 'completed', value: 'completed' },
        { label: 'partial', value: 'partial' },
      ],
      filterValue: (row) => row.purchase_order_status || '',
      render: (value) => {
        const status = value as PurchaseOrder['purchase_order_status'] | undefined;
        if (status === 'pending') return 'รออนุมัติ';
        if (status === 'active') return 'ใช้งานอยู่';
        if (status === 'inactive') return 'ยกเลิก';
        if (status === 'partial') return 'รับสินค้าบางส่วน';
        if (status === 'completed') return 'รับสินค้าครบแล้ว';
        return status;
      },
    },
    {
      key: 'purchase_date' as keyof PurchaseOrder,
      label: 'วันที่เพิ่ม',
      sortable: true,
      render: (value) => new Date(value as string).toLocaleDateString(),
    },
    {
      key: 'purchase_order_total' as keyof PurchaseOrder,
      label: 'ราคา',
      sortable: true,
    },
    {
      key: 'purchase_order_id' as keyof PurchaseOrder,
      label: 'การจัดการ',
      render: (value, row: PurchaseOrder) => (
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const purchaseOrderDetail = await purchaseOrderModel.getPurchaseOrderById(row.purchase_order_id);

              if (isValidPurchaseOrder(purchaseOrderDetail)) {
                setPurchaseOrderToView(purchaseOrderDetail);
                setIsDetailFormOpen(true);
              }
            }}
            className="text-gray-400 hover:text-green-500 transition-colors"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          {canEditPurchaseOrder && (
            <button
              onClick={async () => {
                const purchaseOrderDetail = await purchaseOrderModel.getPurchaseOrderById(row.purchase_order_id);
                if (isValidPurchaseOrder(purchaseOrderDetail)) {
                  setPurchaseOrderToUpdate(purchaseOrderDetail);
                  setIsUpdateFormOpen(true);
                }

              }}
              className="text-gray-400 hover:text-blue-500 transition-colors"
              type="button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
              </svg>
            </button>
          )}
          {canDeletePurchaseOrder && (
            <button
              className="text-gray-400 hover:text-red-500 transition-colors"
              onClick={() => {
                setPurchaseOrderToDelete(row);
                setIsDeleteDialogOpen(true);
              }}
              type="button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
    <div className="bg-gray-50 dark:bg-gray-900 p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Statistics Cards */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1">
                {totalOrders}
              </div>
              <div className="text-xs sm:text-sm text-blue-700 font-medium">
                ใบสั่งซื้อทั้งหมด
              </div>
            </div>
            <div className="bg-blue-200 p-3 rounded-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-1">
                ฿{formatCurrency(totalAmount)}
              </div>
              <div className="text-xs sm:text-sm text-green-700 font-medium">
                มูลค่ารวม
              </div>
            </div>
            <div className="bg-green-200 p-3 rounded-lg">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl sm:text-4xl font-bold text-purple-600 mb-1">
                {meta?.total || 0}
              </div>
              <div className="text-xs sm:text-sm text-purple-700 font-medium">
                รายการทั้งหมดในระบบ
              </div>
            </div>
            <div className="bg-purple-200 p-3 rounded-lg">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
          </div>
        </div>
      </div> */}

      {/* Main Content Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-stretch gap-1 w-full sm:w-auto sm:flex-1 sm:max-w-md">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="ค้นหาใบสั่งซื้อ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-700"
                />
                <svg
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors font-medium whitespace-nowrap"
              >
                ค้นหา
              </button>
              {(searchQuery || appliedSearchQuery) && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                >
                  ล้าง
                </button>
              )}
            </div>

            {canAddPurchaseOrder && (
              <button
                onClick={() => setIsInsertFormOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>สร้างใบสั่งซื้อ</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <LoadingSkeletonProps />}
      <div className="relative">
        <DataTable
          data={purchaseOrders?.data || []}
          columns={columns}
          keyField="purchase_order_id"
          disabled={loading}
          className="bg-white dark:bg-gray-800 p-1"
          headerClassName="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600"
          rowClassName="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          paginationMeta={meta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onFilterChange={handleDataTableFilterChange}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={canDeletePurchaseOrder && isDeleteDialogOpen}
        title="ยืนยันการลบใบสั่งซื้อ"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบใบสั่งซื้อ "${purchaseOrderToDelete?.purchase_order_name}"? การกระทำนี้ไม่สามารถย้อนกลับได้และจะลบรายการสินค้าทั้งหมดในใบสั่งซื้อนี้ด้วย`}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setPurchaseOrderToDelete(null);
        }}
        onConfirm={handleDelete}
      />

      {/* Insert Form */}
      {canAddPurchaseOrder && (
        <InsertPurchaseOrderForm
          isOpen={isInsertFormOpen}
          onClose={() => setIsInsertFormOpen(false)}
          onSuccess={fetchPurchaseOrders}
        />
      )}

      {/* Update Form */}
      {canEditPurchaseOrder && purchaseOrderToUpdate && (
        <UpdatePurchaseOrderForm
          isOpen={isUpdateFormOpen}
          onClose={() => {
            setIsUpdateFormOpen(false);
            setPurchaseOrderToUpdate(null);
          }}
          onSuccess={fetchPurchaseOrders}
          initialData={purchaseOrderToUpdate}
        />
      )}

      {/* Detail Modal */}
      {purchaseOrderToView && (
        <PurchaseOrderDetailModal
          isOpen={isDetailFormOpen}
          onClose={() => {
            setIsDetailFormOpen(false);
            setPurchaseOrderToView(null);
          }}
          onSuccess={fetchPurchaseOrders}
          purchaseOrder={purchaseOrderToView}
        />
      )}

      <ActionResultDialog
        isOpen={resultDialog.isOpen}
        status={resultDialog.status}
        action="delete"
        message={resultDialog.message}
        onClose={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}