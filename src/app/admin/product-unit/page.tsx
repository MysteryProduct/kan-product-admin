'use client';
import { useEffect, useState } from 'react';
import { ApiProductUnitResponse, ProductUnit } from '@/types/product-unit';
import { ProductUnitModel } from '@/models/product-unit';

import Pagination from '@/components/Pagination';
import { PaginationMeta } from '@/types/pagination';
import ProductUnitForm from './components/insert';
import UpdateProductUnitForm from './components/update';
import ConfirmDialog from '@/components/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';
import ActionResultDialog from '@/components/ActionResultDialog';
import LoadingTableSkeleton from '@/components/LoadingTableSkeleton';

const productUnitModel = new ProductUnitModel();
const ProductUnitPage = () => {
    const { can } = usePermissions();
    const canAddProductUnit = can('product_unit', 'add');
    const canEditProductUnit = can('product_unit', 'edit');
    const canDeleteProductUnit = can('product_unit', 'delete');

    const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
    const [limit, setLimit] = useState<number>(10);
    const [editingProductUnit, setEditingProductUnit] = useState<ProductUnit | null>(null);
    const [isEditFormOpen, setIsEditFormOpen] = useState<boolean>(false);
    const [meta, setMeta] = useState<PaginationMeta | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [appliedSearchQuery, setAppliedSearchQuery] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
    const [productUnitToDelete, setProductUnitToDelete] = useState<ProductUnit | null>(null);
    const [loading, setLoading] = useState(true);
    const [resultDialog, setResultDialog] = useState<{
        isOpen: boolean;
        status: 'success' | 'error';
        message: string;
    }>({
        isOpen: false,
        status: 'success',
        message: '',
    });

    const fetchProductUnits = async () => {
        try {
            setLoading(true);
            const response: ApiProductUnitResponse = await productUnitModel.getProductUnits(
                currentPage,
                limit,
                appliedSearchQuery
            );
            setProductUnits(response.data);
            setMeta(response.meta);
        } catch (error) {
            console.error('Error fetching product units:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProductUnits();
    }, [currentPage, appliedSearchQuery]);

    const handleSearch = () => {
        setCurrentPage(1);
        setAppliedSearchQuery(searchQuery.trim());
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setAppliedSearchQuery('');
        setCurrentPage(1);
    };


    const fetchProductUnitsOnDelete = async () => {
        try {
            setLoading(true);
            const pageToFetch = (productUnits.length === 1 && currentPage > 1)
                ? currentPage - 1
                : currentPage;

            const data = await productUnitModel.getProductUnits(pageToFetch, limit, appliedSearchQuery);
            setProductUnits(data.data);
            setMeta(data.meta);
            if (pageToFetch !== currentPage) {
                setCurrentPage(pageToFetch);
            }
        } catch (error) {
            console.error('Error fetching product units:', error);
        } finally {
            setLoading(false);
        }
    };
    const confirmDelete = async () => {
        if (productUnitToDelete !== null) {
            try {
                await productUnitModel.deleteProductUnit(productUnitToDelete.product_unit_id);
                fetchProductUnitsOnDelete();
                setResultDialog({
                    isOpen: true,
                    status: 'success',
                    message: 'ลบหน่วยสินค้าสำเร็จ',
                });
            } catch (error: any) {
                console.error('Error deleting product unit:', error);
                setResultDialog({
                    isOpen: true,
                    status: 'error',
                    message: error?.message || 'เกิดข้อผิดพลาดในการลบหน่วยสินค้า',
                });
            }
            setIsDeleteDialogOpen(false);
            setProductUnitToDelete(null);
        }
    };
    return (
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-2 sm:p-4 md:p-6 lg:p-8">
            {/* Statistics Cards */}

            {/* Main Content Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
                {/* Search Bar and Add Button */}
                <div className="p-3 sm:p-4 md:p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex flex-col sm:flex-row items-stretch gap-1 w-full sm:w-auto sm:flex-1 sm:max-w-md">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Search"
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

                        {canAddProductUnit && (
                            <button
                                onClick={() => setIsFormOpen(true)}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>เพิ่มข้อมูล</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Loading Skeleton or Table */}
                {loading ? (
                    <LoadingTableSkeleton rows={5} columns={3} />
                ) : (
                    <>
                        <div className="overflow-x-auto -mx-2 sm:mx-0 p-3">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                                        <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">รหัสหน่วยสินค้า</th>
                                        <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            ชื่อหน่วยสินค้า
                                        </th>
                                        <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 lg:w-50 md:w-40 ">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productUnits && productUnits.length > 0 ? (productUnits.map((productUnit, index) => (
                                        <tr
                                            key={productUnit.product_unit_id}
                                            className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden sm:table-cell">{productUnit.product_unit_id}</td>
                                            <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-900">{productUnit.product_unit_name}</td>
                                            <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                                                {canEditProductUnit && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingProductUnit(productUnit)
                                                            setIsEditFormOpen(true);
                                                        }}
                                                        className="text-gray-400 hover:text-blue-500 transition-colors mr-4"
                                                    >
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
                                                        </svg>
                                                    </button>
                                                )}
                                                {canDeleteProductUnit && (
                                                    <button className="text-gray-400 hover:text-red-500 transition-colors"
                                                        onClick={() => {
                                                            setProductUnitToDelete(productUnit);
                                                            setIsDeleteDialogOpen(true);
                                                        }}
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
                                    </td>
                                </tr>
                            ))) : (
                                <tr>
                                    <td colSpan={3} className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-center text-sm text-gray-500">
                                        ไม่พบข้อมูลหน่วยสินค้า
                                    </td>
                                </tr>
                            )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Pagination */}
                {meta && meta.last_page > 1 && (
                    <div className="px-6 py-4 bg-gradient-to-r from-gray-50 dark:from-gray-800 to-blue-50 dark:to-gray-700 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
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

            {/* Insert / Update Form Modal */}
            {canAddProductUnit && (
                <ProductUnitForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={() => fetchProductUnits()}
                />
            )}
            {canEditProductUnit && (
                <UpdateProductUnitForm
                    isOpen={isEditFormOpen}
                    onClose={() => {
                        setEditingProductUnit(null);
                        setIsEditFormOpen(false);
                    }}
                    initialData={editingProductUnit || { product_unit_id: 0, product_unit_name: '' }}
                    onSuccess={() => {
                        fetchProductUnits();
                        setEditingProductUnit(null);
                    }}
                />
            )}
            {/* Confirm Delete Dialog */}
            
        </div>
    )
};
export default ProductUnitPage; 