'use client';
import { useEffect, useMemo, useState } from 'react';
import { Supplier, SupplierWithPayment } from '@/types/supplier';
import { PaginationMeta } from '@/types/pagination';
import SupplierModel from '@/models/supplier';
import SupplierInsertForm from './components/insert';
import SupplierUpdateForm from './components/update';
import SupplierDetailModal from './components/detail';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import ActionResultDialog from '@/components/ActionResultDialog';
import { VAT_TYPE_LABELS } from '@/lib/vat';

type SupplierTableRow = SupplierWithPayment & {
    rowNumber: number;
};

type SortField = 'supplier_name' | 'supplier_contact' | 'supplier_phone' | 'tax_id' | null;
type SortOrder = 'ASC' | 'DESC';

export default function SupplierPage() {
    const { can } = usePermissions();
    const canAddSupplier = can('suppliers', 'add');
    const canEditSupplier = can('suppliers', 'edit');
    const canDeleteSupplier = can('suppliers', 'delete');

    const [suppliers, setSuppliers] = useState<SupplierWithPayment[]>([]);
    const [meta, setMeta] = useState<PaginationMeta | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
    const [isUpdateFormOpen, setIsUpdateFormOpen] = useState<boolean>(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
    const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithPayment | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
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
        fetchSuppliers();
    }, [currentPage, sortField, sortOrder, appliedSearchQuery]);

    const handleSearch = () => {
        setCurrentPage(1);
        setAppliedSearchQuery(searchQuery.trim());
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setAppliedSearchQuery('');
        setCurrentPage(1);
    };

    const fetchSuppliers = async (page = currentPage, activeFilters = filters) => {
        setLoading(true);
        try {
            const supplierModel = new SupplierModel();
            const result = await supplierModel.getSuppliers(page, 10, appliedSearchQuery, sortField, sortOrder, activeFilters);
            setSuppliers(result.data);
            setMeta(result.meta);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshSuppliers = async (checkPageAfterDelete = false) => {
        setLoading(true);
        try {
            let targetPage = currentPage;
            if (checkPageAfterDelete && currentPage > 1 && suppliers.length === 1) {
                targetPage = currentPage - 1;
                setCurrentPage(targetPage);
            }
            await fetchSuppliers(targetPage);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
        if (!sort) {
            setSortField(null);
            setSortOrder('ASC');
            setCurrentPage(1);
            return;
        }

        const nextField = sort.key as SortField;
        if (!['supplier_name', 'supplier_contact', 'supplier_phone', 'tax_id'].includes(nextField || '')) {
            setSortField(null);
            setSortOrder('ASC');
            setCurrentPage(1);
            return;
        }

        setSortField(nextField);
        setSortOrder(sort.direction);
        setCurrentPage(1);
    };

    const handleDataTableFilterChange = (tableFilters: Record<string, string | string[]>) => {
        const updatedFilters: Record<string, string> = {};

        for (const columnKey in tableFilters) {
            const value = tableFilters[columnKey];
            if (Array.isArray(value)) {
                if (value.length > 0) {
                    updatedFilters[columnKey] = JSON.stringify(value);
                }
            } else if (value.trim()) {
                updatedFilters[columnKey] = value;
            }
        }

        setCurrentPage(1);
        setFilters(updatedFilters);
    };

    const handleEdit = (supplier: SupplierWithPayment) => {
        setSelectedSupplier(supplier);
        setIsUpdateFormOpen(true);
    };

    const handleDelete = (supplier: Supplier) => {
        setSupplierToDelete(supplier);
        setIsDeleteDialogOpen(true);
    };

    const handleViewDetail = (supplier: SupplierWithPayment) => {
        setSelectedSupplier(supplier);
        setIsDetailModalOpen(true);
    };

    const confirmDelete = async () => {
        if (supplierToDelete) {
            try {
                const supplierModel = new SupplierModel();
                await supplierModel.deleteSupplier(supplierToDelete.supplier_id);
                await handleRefreshSuppliers(true);
                setResultDialog({
                    isOpen: true,
                    status: 'success',
                    message: 'ลบผู้จัดจำหน่ายสำเร็จ',
                });
            } catch (err: any) {
                setError(err.message);
                setResultDialog({
                    isOpen: true,
                    status: 'error',
                    message: err?.message || 'เกิดข้อผิดพลาดในการลบผู้จัดจำหน่าย',
                });
            } finally {
                setIsDeleteDialogOpen(false);
                setSupplierToDelete(null);
            }
        }
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const tableData = useMemo<SupplierTableRow[]>(() => {
        return suppliers.map((supplier, index) => ({
            ...supplier,
            rowNumber: index + 1 + (currentPage - 1) * 10,
        }));
    }, [suppliers, currentPage]);

    const columns = useMemo<DataTableColumn<SupplierTableRow>[]>(
        () => [
            {
                key: 'rowNumber',
                label: 'ลำดับ',
                width: '110px',
                render: (value) => (
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                            {value as number}
                        </div>
                    </div>
                ),
            },
            {
                key: 'supplier_name',
                label: 'ชื่อผู้จัดจำหน่าย',
                sortable: true,
                render: (value) => (
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                        {value as string}
                    </div>
                ),
            },
            {
                key: 'supplier_contact',
                label: 'ติดต่อ',
                sortable: true,
                render: (value) => (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                            {value as string}
                        </div>
                    </div>
                ),
            },
            {
                key: 'supplier_phone',
                label: 'โทรศัพท์',
                sortable: true,
                render: (value) => (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                            {value as string}
                        </div>
                    </div>
                ),
            },
            {
                key: 'supplier_address',
                label: 'ที่อยู่',
                width: '320px',
                render: (value) => (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-100 dark:from-purple-900 to-pink-100 dark:to-pink-900 rounded-lg flex items-center justify-center shadow-sm">
                            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" />
                            </svg>
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 max-w-[250px] truncate" title={value as string}>
                            {value as string}
                        </div>
                    </div>
                ),
            },
            {
                key: 'tax_id',
                label: 'เลขประจำตัวผู้เสียภาษี',
                sortable: true,
                render: (value) => (
                    <div className="font-mono text-gray-700 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-lg inline-block border border-yellow-200 dark:border-yellow-800">
                        {value as string}
                    </div>
                ),
            },
            {
                key: 'vat_type',
                label: 'VAT',
                render: (value) => (
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {VAT_TYPE_LABELS[(value as SupplierWithPayment['vat_type']) || 'none']}
                    </span>
                ),
            },
            {
                key: 'supplier_id',
                label: 'การกระทำ',
                width: '180px',
                render: (_, row) => (
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={() => handleViewDetail(row)}
                            className="group/btn p-2 text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                            title="View Details"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        {canEditSupplier && (
                            <button
                                onClick={() => handleEdit(row)}
                                className="group/btn p-2 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                                title="Edit"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                        )}
                        {canDeleteSupplier && (
                            <button
                                onClick={() => handleDelete(row)}
                                className="group/btn p-2 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                                title="Delete"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        )}
                    </div>
                ),
            },
        ],
        [canDeleteSupplier, canEditSupplier]
    );

    if (loading) {
        return (
            <div className="flex-1 bg-gray-50 p-8">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 bg-gray-50 p-8">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-gradient-to-br from-slate-50 dark:from-gray-900 via-blue-50 dark:via-gray-800 to-indigo-50 dark:to-gray-900 p-2 sm:p-4 md:p-6 lg:p-8 min-h-screen">
            {/* Header Section */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                    ผู้จัดจำหน่าย
                </h1>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="group relative bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm font-medium mb-1">ผู้จัดจำหน่ายทั้งหมด</p>
                            <p className="text-3xl font-bold text-white">{meta?.total || 0}</p>
                            <div className="flex items-center mt-2 text-blue-100 text-xs">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                                Active records
                            </div>
                        </div>
                        <div className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
                            <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* <div className="group relative bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-100 text-sm font-medium mb-1">Pending Orders</p>
                            <p className="text-3xl font-bold text-white">12</p>
                            <div className="flex items-center mt-2 text-amber-100 text-xs">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                Awaiting approval
                            </div>
                        </div>
                        <div className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
                            <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="group relative bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm font-medium mb-1">This Month</p>
                            <p className="text-3xl font-bold text-white">+{Math.floor(Math.random() * 10) + 1}</p>
                            <div className="flex items-center mt-2 text-purple-100 text-xs">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                                New suppliers
                            </div>
                        </div>
                        <div className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
                            <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                    </div>
                </div> */}
            </div>

            {/* Main Content Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 border border-white dark:border-gray-700 border-opacity-20">
                {/* Search Bar and Add Button */}
                <div className="p-6 bg-gradient-to-r from-gray-50 dark:from-gray-700 to-blue-50 dark:to-gray-700 border-b border-gray-100 dark:border-gray-600">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-stretch gap-1 w-full sm:w-auto sm:flex-1 sm:max-w-xl">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Search suppliers by name, contact, or phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch();
                                        }
                                    }}
                                    className="w-full px-4 py-3 pl-11 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-700 shadow-sm transition-all duration-200"
                                />
                                <svg
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500"
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
                                {(searchQuery || appliedSearchQuery) && (
                                    <button
                                        onClick={handleClearSearch}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleSearch}
                                className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors font-medium shadow-lg hover:shadow-xl whitespace-nowrap"
                            >
                                ค้นหา
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {canAddSupplier && (
                                <button
                                    onClick={() => setIsFormOpen(true)}
                                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>เพิ่มผู้จัดจำหน่าย</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <DataTable
                    data={tableData}
                    columns={columns}
                    keyField="supplier_id"
                    className="bg-white dark:bg-gray-800 p-1"
                    headerClassName="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600"
                    rowClassName="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    paginationMeta={meta}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    onFilterChange={handleDataTableFilterChange}
                    onSortChange={handleSortChange}
                />
            </div>

            {/* Modals and Forms */}
            {canAddSupplier && isFormOpen && (
                <SupplierInsertForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={handleRefreshSuppliers}
                />
            )}

            {canEditSupplier && isUpdateFormOpen && selectedSupplier && (
                <SupplierUpdateForm
                    isOpen={isUpdateFormOpen}
                    onClose={() => setIsUpdateFormOpen(false)}
                    onUpdate={handleRefreshSuppliers}
                    supplierId={selectedSupplier.supplier_id}
                />
            )}

            {isDetailModalOpen && selectedSupplier && (
                <SupplierDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    supplier={selectedSupplier}
                />
            )}

            {canDeleteSupplier && isDeleteDialogOpen && supplierToDelete && (
                <ConfirmDialog
                    isOpen={isDeleteDialogOpen}
                    title="Delete Supplier"
                    message={`Are you sure you want to delete supplier "${supplierToDelete.supplier_name}"? This action cannot be undone.`}
                    onConfirm={confirmDelete}
                    onCancel={() => {
                        setIsDeleteDialogOpen(false);
                        setSupplierToDelete(null);
                    }}
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