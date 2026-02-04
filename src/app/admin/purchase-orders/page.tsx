'use client';

import { useEffect, useState } from 'react';
import PurchaseOrderModel from '@/models/purchase-order';
import { PurchaseOrder } from '@/types/purchase-order';
import { PaginationMeta } from '@/types/pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import InsertPurchaseOrderForm from './components/insert';
import UpdatePurchaseOrderForm from './components/update';
import Pagination from '@/components/Pagination';

const purchaseOrderModel = new PurchaseOrderModel();

export default function PurchaseOrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isInsertFormOpen, setIsInsertFormOpen] = useState(false);
  const [isUpdateFormOpen, setIsUpdateFormOpen] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [currentPage, searchQuery]);

  const fetchPurchaseOrders = async () => {
    try {
    //   const data = await purchaseOrderModel.getPurchaseOrders(
    //     currentPage,
    //     10,
    //     searchQuery
    //   );
    //   setPurchaseOrders(data.data);
    //   setMeta(data.meta);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    }
  };

  const handleDelete = async () => {
    if (orderToDelete) {
      try {
        // await purchaseOrderModel.deletePurchaseOrder(orderToDelete.purchase_order_id);
        // fetchPurchaseOrders();
        // setIsDeleteDialogOpen(false);
        // setOrderToDelete(null);
      } catch (error) {
        console.error('Failed to delete purchase order:', error);
      }
    }
  };

  const handleViewDetails = async (order: PurchaseOrder) => {
    try {
      const fullOrder = await purchaseOrderModel.getPurchaseOrderById(order.purchase_order_id);
      setSelectedOrder(fullOrder);
      setIsViewDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const totalOrders = purchaseOrders.length;
  const totalAmount = purchaseOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

  return (
    <div className="bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="relative flex-1 max-w-full sm:max-w-xs">
              <input
                type="text"
                placeholder="ค้นหาใบสั่งซื้อ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              />
              <svg
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
              onClick={() => setIsInsertFormOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>สร้างใบสั่งซื้อ</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">
                  ลำดับ
                </th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">
                  เลขที่ใบสั่งซื้อ
                </th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">
                  รายละเอียด
                </th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">
                  วันที่สร้าง
                </th>
                <th className="text-right px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden lg:table-cell">
                  จำนวนรายการ
                </th>
                <th className="text-right px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">
                  มูลค่ารวม
                </th>
                <th className="text-center px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">
                  การจัดการ
                </th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders && purchaseOrders.length > 0 ? (
                purchaseOrders.map((order, index) => (
                  <tr key={order.purchase_order_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">
                      {(currentPage - 1) * 10 + index + 1}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <span className="text-gray-900 font-medium">{order.purchase_order_name}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell max-w-xs truncate">
                      {order.purchase_order_detail}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell">
                      {new Date(order.purchase_date).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 text-right hidden lg:table-cell">
                      {order.total_items || 0} รายการ
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-semibold text-gray-900 text-right">
                      ฿{formatCurrency(order.total_amount || 0)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          title="ดูรายละเอียด"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={async () => {
                            const fullOrder = await purchaseOrderModel.getPurchaseOrderById(order.purchase_order_id);
                            setOrderToUpdate(fullOrder);
                            setIsUpdateFormOpen(true);
                          }}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          title="แก้ไข"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setOrderToDelete(order);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="ลบ"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium">ไม่พบข้อมูลใบสั่งซื้อ</p>
                      <p className="text-sm text-gray-400 mt-1">เริ่มต้นสร้างใบสั่งซื้อใหม่</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, meta.total)} of {meta.total} results
              </div>
              <Pagination
                currentPage={currentPage}
                meta={meta}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>

      {/* View Details Dialog */}
      {isViewDialogOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">รายละเอียดใบสั่งซื้อ</h3>
                <button
                  onClick={() => setIsViewDialogOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">เลขที่ใบสั่งซื้อ</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedOrder.purchase_order_name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">วันที่สร้าง</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(selectedOrder.purchase_date).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-600 mb-1">รายละเอียด</p>
                <p className="text-gray-900">{selectedOrder.purchase_order_detail}</p>
              </div>

              <div className="mb-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">รายการสินค้า</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">สินค้า</th>
                        <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">จำนวน</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">ราคา/หน่วย</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        selectedOrder.items.map((item, index) => (
                          <tr key={item.purchase_order_list_id} className="border-t border-gray-200">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.product?.product_name || `สินค้า #${item.product_id}`}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-center">
                              {item.purchase_order_list_qty}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              ฿{formatCurrency(item.purchase_order_list_price)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              ฿{formatCurrency(item.purchase_order_list_total)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                            ไม่มีรายการสินค้า
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {selectedOrder.items && selectedOrder.items.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900">
                            รวมทั้งสิ้น:
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">
                            ฿{formatCurrency(selectedOrder.total_amount || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <button
                onClick={() => setIsViewDialogOpen(false)}
                className="w-full sm:w-auto px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="ยืนยันการลบใบสั่งซื้อ"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบใบสั่งซื้อ "${orderToDelete?.purchase_order_name}"? การกระทำนี้ไม่สามารถย้อนกลับได้และจะลบรายการสินค้าทั้งหมดในใบสั่งซื้อนี้ด้วย`}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setOrderToDelete(null);
        }}
        onConfirm={handleDelete}
      />

      {/* Insert Form */}
      <InsertPurchaseOrderForm
        isOpen={isInsertFormOpen}
        onClose={() => setIsInsertFormOpen(false)}
        onSuccess={fetchPurchaseOrders}
      />

      {/* Update Form */}
      {orderToUpdate && (
        <UpdatePurchaseOrderForm
          isOpen={isUpdateFormOpen}
          onClose={() => {
            setIsUpdateFormOpen(false);
            setOrderToUpdate(null);
          }}
          onSuccess={fetchPurchaseOrders}
          initialData={orderToUpdate}
        />
      )}
      
    </div>
  );
}
