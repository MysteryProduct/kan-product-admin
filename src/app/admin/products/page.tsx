'use client';

import { useEffect, useState } from 'react';
import ProductForm from '../products/components/insert';
import UpdateProductForm from '../products/components/update';

import ProductModel from '@/models/product';
import { Product, ProductResponse } from '@/types/product';
import { PaginationMeta } from '@/types/pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import StockModel from '@/models/stocks';
import Pagination from '@/components/Pagination';
import { DataTable, DataTableColumn } from '@/components/DataTable';
const productModel = new ProductModel();
const stockModel = new StockModel();

type SortField = 'adddate' | 'price' | null;
type SortOrder = 'asc' | 'desc';

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [products, setProducts] = useState<ProductResponse | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isUpdateFormOpen, setIsUpdateFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [inStock, setInStock] = useState(0);
  const [outStock, setOutStock] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in stock' | 'out stock'>('all');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        let data = await productModel.getProducts(currentPage, 10, searchQuery, sortField, sortOrder, statusFilter === 'all' ? undefined : statusFilter);
        let stockStatuses = await stockModel.getStockStatuses();
        setProducts(data);
        setMeta(data.meta);
        setInStock(stockStatuses.in_stock);
        setOutStock(stockStatuses.out_stock);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };

    fetchProducts();
  }, [currentPage, searchQuery, sortField, sortOrder, statusFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle sort order if clicking the same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleDataTableFilterChange = (filters: Record<string, string | string[]>) => {
    console.log('All filters:', filters);
    
    // Handle stock filter changes
    if (filters.stock) {
      const stockValue = filters.stock;
      if (Array.isArray(stockValue)) {
        if (stockValue.length === 0) {
          setStatusFilter('all');
        } else if (stockValue.includes('in stock') && !stockValue.includes('out stock') && !stockValue.includes('test')) {
          setStatusFilter('in stock');
        } else if (stockValue.includes('out stock') && !stockValue.includes('in stock') && !stockValue.includes('test')) {
          setStatusFilter('out stock');
        } else {
          // Multiple selected, show all
          setStatusFilter('all');
        }
      }
    } else {
      // No stock filter, reset to all
      setStatusFilter('all');
    }
    
    // You can also handle other filters here, for example:
    // if (filters.color) {
    //   console.log('Color filters:', filters.color);
    // }
    // if (filters.category) {
    //   console.log('Category filters:', filters.category);
    // }
    
    // Refresh products after filter change
    setTimeout(() => handleRefreshProduct(), 0);
  };

  // Define DataTable columns
  const columns: DataTableColumn<Product>[] = [
    {
      key: 'product_name' as keyof Product,
      label: 'ชื่อสินค้า',
      filterable: true,
      filterType: 'text',
      filterValue: (row) => row.product_name,
    },
    {
      key: 'category' as any as keyof Product,
      label: 'ประเภทสินค้า',
      filterable: true,
      filterType: 'multi-select',
      filterOptions: [
        { label: 'แม่นือ', value: 'แม่นือ' },
        { label: 'เม็ดแนว', value: 'เม็ดแนว' },
      ],
      filterValue: (row) => row.category?.category_name || '',
      render: (value: any) => value?.category_name,
    },
    {
      key: 'color' as any as keyof Product,
      label: 'สีสินค้า',
      filterable: true,
      filterType: 'multi-select',
      filterOptions: [
        { label: 'สีขาว', value: 'สีขาว' },
        { label: 'สีดำ', value: 'สีดำ' },
        { label: 'สีแดง', value: 'สีแดง' },
      ],
      filterValue: (row) => row.color?.color_name || '',
      render: (value: any) => value?.color_name,
    },
    {
      key: 'adddate' as keyof Product,
      label: 'วันที่เพิ่ม',
      sortable: true,
      render: (value) => new Date(value as string).toLocaleDateString(),
    },
    {
      key: 'price' as keyof Product,
      label: 'ราคา',
      sortable: true,
    },
    {
      key: 'stock' as any as keyof Product,
      label: 'สถานะสินค้า',
      filterable: true,
      filterType: 'multi-select',
      filterOptions: [
        { label: 'มีสินค้า', value: 'in stock' },
        { label: 'สินค้าหมด', value: 'out stock' },
        { label: 'test', value: 'test' },

      ],
      filterValue: (row) => row.stock?.stock_status || '',
      render: (value: any) => {
        if (value?.stock_status === 'in stock') return 'มีสินค้า';
        if (value?.stock_status === 'out stock') return 'สินค้าหมด';
        if (value?.stock_status === 'test') return 'test';
        return value?.stock_status;
      },
    },
    {
      key: 'product_id' as keyof Product,
      label: 'การจัดการ',
      render: (value, row: Product) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedProduct(row);
              setIsUpdateFormOpen(true);
            }}
            className="text-gray-400 hover:text-blue-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
            </svg>
          </button>
          <button 
            className="text-gray-400 hover:text-red-500 transition-colors"
            onClick={() => {
              setProductToDelete(row);
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
        </div>
      ),
    },
  ];


  const totalProducts = products ? products.data.length : 0;


  const handleRefreshProduct = async (checkPageAfterDelete = false) => {
    // รีเฟรชข้อมูลสินค้าเมื่อมีการเพิ่มสินค้าใหม่
    try {
      // คำนวณหน้าที่จะใช้ก่อนเรียก API
      let targetPage = currentPage;

      // ถ้าเป็นการลบข้อมูลและไม่ใช่หน้าแรก และหน้าปัจจุบันมีเพียง 1 รายการ
      // ให้ลดหน้าลงมา 1 หน้า
      if (checkPageAfterDelete && currentPage > 1 && products?.data.length === 1) {
        targetPage = currentPage - 1;
        setCurrentPage(targetPage);
      }

      let data = await productModel.getProducts(targetPage, 10, searchQuery, sortField, sortOrder, statusFilter === 'all' ? undefined : statusFilter);
      let stockStatuses = await stockModel.getStockStatuses();

      setProducts(data);
      setMeta(data.meta);
      setInStock(stockStatuses.in_stock);
      setOutStock(stockStatuses.out_stock);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };
  return (
    <div className="bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">{totalProducts}</div>
          <div className="text-xs sm:text-sm text-blue-700 font-medium">Total Products</div>
        </div>

        {/* <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-orange-600 mb-1 sm:mb-2">{pendingProducts}</div>
          <div className="text-xs sm:text-sm text-orange-700 font-medium">Pending Products</div>
        </div> */}

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-1 sm:mb-2">{inStock}</div>
          <div className="text-xs sm:text-sm text-green-700 font-medium">In Stock</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-red-600 mb-1 sm:mb-2">{outStock}</div>
          <div className="text-xs sm:text-sm text-red-700 font-medium">Out of Stock</div>
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
        <DataTable
          data={products?.data || []}
          columns={columns}
          keyField="product_id"
          className="bg-white"
          headerClassName="bg-gray-50 border-b border-gray-100"
          rowClassName="border-b border-gray-100 hover:bg-gray-50"
          onFilterChange={handleDataTableFilterChange}
        />


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
      <ProductForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleRefreshProduct}
      />
      {/* Update Product Form */}
      {selectedProduct && (
        <UpdateProductForm
          isOpen={isUpdateFormOpen}
          onClose={() => {
            setIsUpdateFormOpen(false);
            setSelectedProduct(null);
          }}
          onSuccess={handleRefreshProduct}
          initialData={selectedProduct}
        />
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="ยืนยันการลบสินค้า"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า "${productToDelete?.product_name}"? การกระทำนี้ไม่สามารถย้อนกลับได้.`}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={async () => {
          if (productToDelete) {
            try {
              await productModel.deleteProduct(productToDelete.product_id);
              // รีเฟรชข้อมูลสินค้า และตรวจสอบว่าหน้านี้ยังมีข้อมูลหรือไม่
              handleRefreshProduct(true);
            } catch (error) {
              console.error('Failed to delete product:', error);
            }
            setIsDeleteDialogOpen(false);
            setProductToDelete(null);
          }
        }}
      />

    </div>
  );
}
