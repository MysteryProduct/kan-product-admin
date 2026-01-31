'use client';
import { useEffect, useState } from 'react';
import { ApiProductUnitResponse, ProductUnit } from '@/types/product-unit';
import { ProductUnitModel } from '@/models/product-unit';

import Pagination from '@/components/Pagination';
import { PaginationMeta } from '@/types/pagination';
import category from '@/models/category';


const productUnitModel = new ProductUnitModel();
const ProductUnitPage = () => {
    const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(10);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [search, setSearch] = useState<string>('');
    const [showForm, setShowForm] = useState<boolean>(false);
    const [editingProductUnit, setEditingProductUnit] = useState<ProductUnit | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
    const [deletingProductUnitId, setDeletingProductUnitId] = useState<number | null>(null);
    const [meta, setMeta] = useState<PaginationMeta | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
    const fetchProductUnits = async () => {
        setLoading(true);
        try {
            const response: ApiProductUnitResponse = await productUnitModel.getProductUnits(
                page,
                limit,
                search
            );
            setProductUnits(response.data);
            setMeta(response.meta);
        } catch (error) {
            console.error('Error fetching product units:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchProductUnits();
    }, [page, limit, search]);
    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1); // Reset to first page on new search
    }
    const handleEdit = (productUnit: ProductUnit) => {
        setEditingProductUnit(productUnit);
        setShowForm(true);
    };
    const handleDelete = (productUnitId: number) => {
        setDeletingProductUnitId(productUnitId);
        setShowConfirmDialog(true);
    };
    const confirmDelete = async () => {
        if (deletingProductUnitId !== null) {
            try {
                await productUnitModel.deleteProductUnit(deletingProductUnitId);
                fetchProductUnits();
            } catch (error) {
                console.error('Error deleting product unit:', error);
            }
            setShowConfirmDialog(false);
            setDeletingProductUnitId(null);
        }
    };
    return (
        <div className="flex-1 bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8">
            {/* Statistics Cards */}

            {/* Main Content Card */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
                {/* Search Bar and Add Button */}
                <div className="p-3 sm:p-4 md:p-6 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="relative flex-1 max-w-full sm:max-w-xs">
                            <input
                                type="text"
                                placeholder="Search"
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
                            onClick={() => setIsFormOpen(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>เพิ่มข้อมูล</span>
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto -mx-2 sm:mx-0 p-3">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">รหัสหน่วยสินค้า</th>
                                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">
                                    ชื่อหน่วยสินค้า
                                </th>
                                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 lg:w-50 md:w-40 ">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productUnits.map((productUnit, index) => (
                                <tr
                                    key={productUnit.product_unit_id}
                                    className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                >
                                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden sm:table-cell">{productUnit.product_unit_id}</td>
                                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-900">{productUnit.product_unit_name}</td>
                                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                                        <button
                                            // onClick={() => {
                                            //     setSelectedCategory(category);
                                            //     setIsUpdateFormOpen(true);
                                            // }}
                                            className="text-gray-400 hover:text-blue-500 transition-colors mr-4"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
                                            </svg>
                                        </button>
                                        <button className="text-gray-400 hover:text-red-500 transition-colors"
                                            onClick={() => {
                                                // setCategoryToDelete(category);
                                                // setIsDeleteDialogOpen(true);
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <Pagination
                    meta={meta}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            </div>


        </div>
    )
};
export default ProductUnitPage; 