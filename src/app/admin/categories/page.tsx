'use client';
import { useEffect, useState } from 'react';

import { PaginationMeta } from '@/types/pagination';
import { Category } from '@/types/category';
import CategoryModel from '@/models/category';
import CategoryForm from '../categories/components/insert';
import UpdateCategoryForm from '../categories/components/update';
import ConfirmDialog from '@/components/ConfirmDialog';
export default function CategoryPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [meta, setMeta] = useState<PaginationMeta | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
    const [isUpdateFormOpen, setIsUpdateFormOpen] = useState<boolean>(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoryModel = new CategoryModel();
                const result = await categoryModel.getCategories(currentPage, 10, searchQuery);
                setCategories(result.data);
                setMeta(result.meta);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, [currentPage, searchQuery]);

    const handleRefreshCategories = async () => {
        setLoading(true);
        try {
            const categoryModel = new CategoryModel();
            const result = await categoryModel.getCategories(currentPage, 10, searchQuery);
            setCategories(result.data);
            setMeta(result.meta);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }
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
                                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">Category Id</th>
                                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">
                                    Category Name
                                </th>
                                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 lg:w-50 md:w-40 ">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category, index) => (
                                <tr
                                    key={category.category_id}
                                    className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                >
                                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden sm:table-cell">{category.category_id}</td>
                                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-900">{category.category_name}</td>
                                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                                        <button
                                            onClick={() => {
                                                setSelectedCategory(category);
                                                setIsUpdateFormOpen(true);
                                            }}
                                            className="text-gray-400 hover:text-blue-500 transition-colors mr-4"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
                                            </svg>
                                        </button>
                                        <button className="text-gray-400 hover:text-red-500 transition-colors"
                                            onClick={() => {
                                                setCategoryToDelete(category);
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-gray-100">
                    <div className="flex items-center justify-center gap-1 sm:gap-2">

                        {/* ปุ่มย้อนกลับ: ปิดใช้งานถ้าอยู่หน้าแรก */}
                        <button
                            className="w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        {/* แสดงปุ่มตัวเลขหน้า */}
                        {meta && Array.from({ length: meta.last_page }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                // ใช้ meta.page แทน currentPage ในการตรวจสอบ active state
                                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${meta.page === page
                                    ? 'bg-blue-500 text-white'
                                    : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}

                        {/* ส่วน ... และปุ่มหน้าสุดท้ายถูกลบออก เพราะเราสร้างปุ่มตามจำนวนหน้าจริงแล้ว */}

                        {/* ปุ่มถัดไป: ปิดใช้งานถ้าอยู่หน้าสุดท้าย */}
                        <button
                            className="w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={meta ? currentPage === meta.last_page : true}
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <CategoryForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={() => {
                    setIsFormOpen(false);
                    handleRefreshCategories();
                }}
            />
            <UpdateCategoryForm
                isOpen={isUpdateFormOpen}
                onClose={() => setIsUpdateFormOpen(false)}
                onSuccess={() => {
                    setIsUpdateFormOpen(false);
                    handleRefreshCategories();
                }}
                initialData={selectedCategory || { category_id: 0, category_name: '' }}
            />
            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onConfirm={async () => {
                    if (!categoryToDelete) return;
                    
                    const categoryModel = new CategoryModel();
                    try {
                        await categoryModel.deleteCategory(categoryToDelete.category_id);
                        handleRefreshCategories();
                    } catch (error) {
                        console.error('Failed to delete category:', error);
                    }
                }}
                onCancel={() => {
                    setIsDeleteDialogOpen(false);
                    setCategoryToDelete(null);
                }}
                message={`คุณต้องการลบประเภท "${categoryToDelete?.category_name}" ใช่หรือไม่?`}
            />
        </div>
    );
}

