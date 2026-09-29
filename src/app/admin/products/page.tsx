'use client';

import { useEffect, useState } from 'react';
import ProductForm from './components/insert';
import UpdateProductForm from './components/update';
import ProductDetailModal from './components/detail';

import ProductModel from '@/models/product';
import { Product, ProductResponse } from '@/types/product';
import { PaginationMeta } from '@/types/pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import ActionResultDialog from '@/components/ActionResultDialog';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import { formatThaiDate } from '@/lib/date-format';
import { toNameOptions } from '@/lib/filter-options';
import CategoryModel from '@/models/category';
import ColorModel from '@/models/color';
const productModel = new ProductModel();
const categoryModel = new CategoryModel();
const colorModel = new ColorModel();
import StorePolicy from './components/store-policy';

type SortField = 'adddate' | 'product_variant_price' | null;
type SortOrder = 'ASC' | 'DESC';

const getPrimaryVariant = (product: Product) => {
  const variants = product.product_variants || product.productVariants || [];
  return variants[0];
};

// The API writes 'in stock' (job order closed) or 'available' (sale order stock
// change) when quantity remains, and 'out stock' when none does. A product is
// in stock when any of its variants has such a row.
const STOCK_STATUS_LABELS: Record<string, string> = {
  'in stock': 'มีสินค้า',
  'out stock': 'สินค้าหมด',
};

const getStockStatus = (product: Product): string => {
  const rows = (product.product_variants || product.productVariants || []).flatMap(
    (variant) => variant.stockProducts || [],
  );
  if (rows.length === 0) return '';
  const inStock = rows.some((row) =>
    ['in stock', 'available'].includes((row.stock_product_status || '').toLowerCase()),
  );
  return inStock ? 'in stock' : 'out stock';
};

export default function ProductsPage() {
  const { can } = usePermissions();
  const canAddProduct = can('products', 'add');
  const canEditProduct = can('products', 'edit');
  const canDeleteProduct = can('products', 'delete');

  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [products, setProducts] = useState<ProductResponse | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);
  const [isUpdateFormOpen, setIsUpdateFormOpen] = useState(false);
  const [isDetailFormOpen, setIsDetailFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [colorOptions, setColorOptions] = useState<{ label: string; value: string }[]>([]);
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

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [categories, colors] = await Promise.all([
          categoryModel.getCategories(1, 200),
          colorModel.getColors(1, 200),
        ]);
        setCategoryOptions(toNameOptions(categories.data.map((category) => category.category_name)));
        setColorOptions(toNameOptions(colors.data.map((color) => color.color_name)));
      } catch (error) {
        console.error('Failed to fetch category or color options:', error);
      }
    };
    void fetchOptions();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await productModel.getProducts(currentPage, 10, appliedSearchQuery, sortField, sortOrder, filters);
        setProducts(data);
        setMeta(data.meta);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, appliedSearchQuery, sortField, sortOrder, filters]);

  const handleSearch = () => {
    setCurrentPage(1);
    setAppliedSearchQuery(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAppliedSearchQuery('');
    setCurrentPage(1);
  };

  const handleSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
    if (!sort) {
      setSortField(null);
      setSortOrder('ASC');
      return;
    }

    const nextField = (sort.key === 'product_variant_price' ? 'product_variant_price' : sort.key) as SortField;
    if (nextField !== 'adddate' && nextField !== 'product_variant_price') {
      setSortField(null);
      setSortOrder('ASC');
      return;
    }

    setSortField(nextField);
    setSortOrder(sort.direction);
  };

  const handleDataTableFilterChange = (filters: Record<string, string | string[]>) => {
    const updatedFilters: Record<string, string> = {};
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
    setCurrentPage(1);
    setFilters(updatedFilters);
  };

  // Define DataTable columns
  const columns: DataTableColumn<Product>[] = [
    {
      // Display-only column, like 'category' and 'stock' below: the key is the
      // column's identity in the table, so it must not repeat another column's.
      // It previously reused 'product_id', which the actions column already
      // uses, and React saw two children with the same key on every row.
      key: 'store_policy' as keyof Product,
      label: 'หน้าร้านออนไลน์',
      render: (_, row) => <StorePolicy id={row.product_id} editable={canEditProduct} />,
    },
    {
      key: 'product_name' as keyof Product,
      label: 'ชื่อสินค้า',
      width: '250px',
    },
    {
      key: 'category' as keyof Product,
      label: 'ประเภทสินค้า',
      filterable: true,
      filterType: 'multi-select',
      filterOptions: categoryOptions,
      filterValue: (row) => row.category?.category_name || '',
      render: (value) => (value as Product['category'])?.category_name,
    },
    {
      key: 'color' as keyof Product,
      label: 'สีสินค้า',
      filterable: true,
      filterType: 'multi-select',
      filterOptions: colorOptions,
      filterValue: (row) => row.color?.color_name || getPrimaryVariant(row)?.color?.color_name || '',
      render: (value, row) =>
        (value as Product['color'])?.color_name ||
        getPrimaryVariant(row)?.color?.color_name ||
        '-',
    },
    {
      key: 'adddate' as keyof Product,
      label: 'วันที่เพิ่ม',
      sortable: true,
      render: (value) => formatThaiDate(value as string),
    },
    {
      key: 'product_variant_price' as keyof Product,
      label: 'ราคา',
      sortable: true,
      render: (value, row) => {
        // The API returns the decimal price as a string ("390.00").
        const rawPrice = value ?? getPrimaryVariant(row)?.product_variant_price;
        const displayPrice = rawPrice === '' || rawPrice === null ? NaN : Number(rawPrice);

        if (!Number.isFinite(displayPrice)) {
          return '-';
        }

        return new Intl.NumberFormat('th-TH').format(displayPrice);
      },
    },
    {
      key: 'stock' as keyof Product,
      label: 'สถานะสินค้า',
      filterable: true,
      filterType: 'multi-select',
      // The statuses the API writes; it matches 'in stock' to 'available' as well.
      filterOptions: [
        { label: 'มีสินค้า', value: 'in stock' },
        { label: 'สินค้าหมด', value: 'out stock' },
      ],
      filterValue: (row) => getStockStatus(row),
      render: (_value, row) => STOCK_STATUS_LABELS[getStockStatus(row)] ?? '-',
    },
    {
      key: 'product_id' as keyof Product,
      label: 'การจัดการ',
      render: (value, row: Product) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedDetailProduct(row);
              setIsDetailFormOpen(true);
            }}
            className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--brand-ink)]"
            aria-label="ดูรายละเอียด"
            title="ดูรายละเอียด"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
          {canEditProduct && (
            <button
              onClick={() => {
                setSelectedProduct(row);
                setIsUpdateFormOpen(true);
              }}
              className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--brand-ink)]"
              title="แก้ไข"
              aria-label="แก้ไข"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
              </svg>
            </button>
          )}
          {canDeleteProduct && (
            <button
              className="ka-btn ka-btn--ghost ka-btn--icon hover:text-[var(--danger)]"
              title="ลบ"
              aria-label="ลบ"
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
          )}
        </div>
      ),
    },
  ];


  const totalProducts = products ? products.data.length : 0;


  const handleRefreshProduct = async (filters: Record<string, string> = {}, checkPageAfterDelete = false) => {
    // รีเฟรชข้อมูลสินค้าเมื่อมีการเพิ่มสินค้าใหม่
    try {
      // คำนวณหน้าที่จะใช้ก่อนเรียก API
      setLoading(true);
      let targetPage = currentPage;

      // ถ้าเป็นการลบข้อมูลและไม่ใช่หน้าแรก และหน้าปัจจุบันมีเพียง 1 รายการ
      // ให้ลดหน้าลงมา 1 หน้า
      if (checkPageAfterDelete && currentPage > 1 && products?.data.length === 1) {
        targetPage = currentPage - 1;
        setCurrentPage(targetPage);
      }

      const data = await productModel.getProducts(targetPage, 10, appliedSearchQuery, sortField, sortOrder, filters);

      setProducts(data);
      setMeta(data.meta);

    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
    finally {
      setLoading(false);
    }
  };
  return (
    <div className="bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="ka-card p-3 sm:p-6">
          <div className="text-2xl sm:text-4xl font-bold text-[var(--brand-ink)] mb-1 sm:mb-2">{totalProducts}</div>
          <div className="text-[13px] sm:text-sm text-[var(--brand-ink)] font-medium">Total Products</div>
        </div>

        {/* <div className="ka-card p-3 sm:p-6">
          <div className="text-2xl sm:text-4xl font-bold text-[var(--warning)] mb-1 sm:mb-2">{pendingProducts}</div>
          <div className="text-[13px] sm:text-sm text-[var(--warning)] font-medium">Pending Products</div>
        </div> */}

        {/* <div className="ka-card p-3 sm:p-6">
          <div className="text-2xl sm:text-4xl font-bold text-[var(--success)] mb-1 sm:mb-2">{inStock}</div>
          <div className="text-[13px] sm:text-sm text-[var(--success)] font-medium">In Stock</div>
        </div>

        <div className="ka-card p-3 sm:p-6">
          <div className="text-2xl sm:text-4xl font-bold text-[var(--danger)] mb-1 sm:mb-2">{outStock}</div>
          <div className="text-[13px] sm:text-sm text-[var(--danger)] font-medium">Out of Stock</div>
        </div> */}
      </div>

      {/* Main Content Card */}
      <div className="bg-[var(--bg-surface)] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-[var(--border)]">
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
                  className="ka-input w-full"
                />
                <svg
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--ink-subtle)]"
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
                className="ka-btn ka-btn--primary whitespace-nowrap"
              >
                ค้นหา
              </button>
              {(searchQuery || appliedSearchQuery) && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="ka-btn whitespace-nowrap"
                >
                  ล้าง
                </button>
              )}
            </div>

            {canAddProduct && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="ka-btn ka-btn--primary flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>เพิ่มข้อมูล</span>
              </button>
            )}
          </div>
        </div>

        {loading && <LoadingSkeletonProps />}
        <DataTable
          data={products?.data || []}
          columns={columns}
          keyField="product_id"
          disabled={loading}
          className="bg-[var(--bg-surface)] p-1"
          paginationMeta={meta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onFilterChange={handleDataTableFilterChange}
          onSortChange={handleSortChange}
        />


      </div>
      {canAddProduct && (
        <ProductForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={handleRefreshProduct}
        />
      )}
      {/* Update Product Form */}
      {canEditProduct && selectedProduct && (
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
      <ProductDetailModal
        isOpen={isDetailFormOpen}
        onClose={() => {
          setIsDetailFormOpen(false);
          setSelectedDetailProduct(null);
        }}
        product={selectedDetailProduct}
      />
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={canDeleteProduct && isDeleteDialogOpen}
        title="ยืนยันการลบสินค้า"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า "${productToDelete?.product_name}"? ระบบจะลบข้อมูลที่เชื่อมโยงตาม ER (รวมไฟล์สินค้าแบบ Product และ Product Variant) และไม่สามารถย้อนกลับได้.`}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={async () => {
          if (productToDelete) {
            try {
              await productModel.deleteProduct(productToDelete.product_id);
              // รีเฟรชข้อมูลสินค้า และตรวจสอบว่าหน้านี้ยังมีข้อมูลหรือไม่
              await handleRefreshProduct(filters, true);
              setResultDialog({
                isOpen: true,
                status: 'success',
                message: 'ลบสินค้าสำเร็จ',
              });
            } catch (error: unknown) {
              console.error('Failed to delete product:', error);
              const errorWithResponse = error as {
                response?: {
                  data?: {
                    message?: string | string[];
                  };
                };
                message?: string;
              };

              const responseMessage = errorWithResponse.response?.data?.message;

              const errorMessage = Array.isArray(responseMessage)
                ? responseMessage.join(', ')
                : typeof responseMessage === 'string'
                  ? responseMessage
                  : errorWithResponse.message || 'เกิดข้อผิดพลาดในการลบสินค้า';

              setResultDialog({
                isOpen: true,
                status: 'error',
                message: errorMessage,
              });
            }
            setIsDeleteDialogOpen(false);
            setProductToDelete(null);
          }
        }}
      />

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
