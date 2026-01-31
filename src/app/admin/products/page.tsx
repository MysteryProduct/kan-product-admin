'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import ProductForm from '../products/components/insert';
import UpdateProductForm from '../products/components/update';

import ProductModel from '@/models/product';
import { Product, ProductResponse } from '@/types/product';
import { PaginationMeta } from '@/types/pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import StockModel from '@/models/stocks';
import Pagination from '@/components/Pagination';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'out_stock'>('all');

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };


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
        <div className="overflow-x-auto -mx-2 sm:mx-0 p-3">
          <table className="w-full ">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">ลำดับ</th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">ชื่อสินค้า</th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">ประเภทสินค้า</th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">สีสินค้า</th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">
                  <button
                    onClick={() => handleSort('adddate')}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    วันที่เพิ่ม
                    <SortIcon field="adddate" />
                  </button>
                </th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">
                  <button
                    onClick={() => handleSort('price')}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    ราคา
                    <SortIcon field="price" />
                  </button>
                </th>
                <th className='text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell'>
                  <div className="relative inline-flex items-center">
                    <svg className="absolute left-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'all' | 'in_stock' | 'out_stock')}
                      className="pl-8 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-xs font-semibold cursor-pointer hover:border-blue-400 transition-colors appearance-none bg-no-repeat bg-right"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.5rem center',
                        backgroundSize: '1.5em 1.5em'
                      }}
                    >
                      <option value="all">ทั้งหมด</option>
                      <option value="in stock">✓ มีสินค้า</option>
                      <option value="out stock">✗ สินค้าหมด</option>
                    </select>
                  </div>
                </th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products && products.data.length > 0 ? (
                products.data.map((product, index) => (
                  <tr key={product.product_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden sm:table-cell">{ (currentPage - 1) * 10 + (index + 1)}</td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 flex items-center gap-3">
                      <span className="text-gray-900 font-medium">{product.product_name}</span>
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell">
                      {product.category.category_name}
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell">
                      {product.color.color_name}
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell">
                      {new Date(product.adddate).toLocaleDateString()}
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell">
                      {product.price}
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell">
                      {product.stock.stock_status}
                    </td>
                    <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
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
                          setProductToDelete(product);
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
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    ไม่พบสินค้าที่ค้นหา
                  </td>
                </tr>
              )}

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
