'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ProductDetailModal from './components/detail';

import ProductModel, { StorePolicyState } from '@/models/product';
import { Product, ProductResponse } from '@/types/product';
import { PaginationMeta } from '@/types/pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { usePermissions } from '@/hooks/usePermissions';
import ActionResultDialog from '@/components/ActionResultDialog';
import BulkBar, { BulkAction } from '@/components/BulkBar';
import FilterChip from '@/components/FilterChip';
import RowMenu from '@/components/RowMenu';
import StatusBadge from '@/components/StatusBadge';
import { formatThaiDate } from '@/lib/date-format';
import { toNameOptions } from '@/lib/filter-options';
import CategoryModel from '@/models/category';
import ColorModel from '@/models/color';
const productModel = new ProductModel();
const categoryModel = new CategoryModel();
const colorModel = new ColorModel();
import StorePolicy from './components/store-policy';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import BulkDialog, { BulkMode } from './components/bulk-dialog';
import QuickEdit from './components/quick-edit';
import ColumnMenu, { ColumnChoice } from './components/column-menu';
import { useAuth } from '@/contexts/AuthContext';
import { createLatestGate } from '@/lib/latest-request';
import { selectedProducts } from '@/lib/product-bulk';
import { browserStorage, loadHiddenColumns, preferenceKey, saveHiddenColumns } from '@/lib/table-preferences';

// Columns the employee may hide. The product (name and code) and the row commands always stay.
const HIDEABLE_COLUMNS: { key: string; label: string }[] = [
  { key: 'category', label: 'ประเภท' },
  { key: 'color', label: 'สี' },
  { key: 'product_variant_price', label: 'ราคา' },
  { key: 'stock', label: 'สถานะ' },
  { key: 'store_policy', label: 'หน้าร้าน' },
  { key: 'adddate', label: 'เพิ่มเมื่อ' },
];
const REQUIRED_COLUMNS: { key: string; label: string }[] = [
  { key: 'product_name', label: 'สินค้า' },
  { key: 'product_id', label: 'จัดการ' },
];

// The tabs are the stock filter the API already knows; each count is the API's own total for it.
type StockTab = 'all' | 'in' | 'out';
const STOCK_TABS: { key: StockTab; label: string; value?: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'in', label: 'มีสินค้า', value: 'in stock' },
  { key: 'out', label: 'สินค้าหมด', value: 'out stock' },
];
const SEARCH_DELAY_MS = 300;
const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);
const HIDEABLE_KEYS = HIDEABLE_COLUMNS.map((c) => c.key);
const REQUIRED_KEYS = REQUIRED_COLUMNS.map((c) => c.key);

type SortField = 'adddate' | 'product_variant_price' | null;
type SortOrder = 'ASC' | 'DESC';

const getPrimaryVariant = (product: Product) => {
  const variants = product.product_variants || product.productVariants || [];
  return variants[0];
};

// The API writes 'in stock' (job order closed) or 'available' (sale order stock
// change) when quantity remains, and 'out stock' when none does. A product is
// in stock when any of its variants has such a row. Stock rows only exist once
// a job order has been closed, so a product without any has nothing in stock.
const STOCK_STATUS_LABELS: Record<string, string> = {
  'in stock': 'มีสินค้า',
  'out stock': 'สินค้าหมด',
};

const getStockStatus = (product: Product): string => {
  const rows = (product.product_variants || product.productVariants || []).flatMap(
    (variant) => variant.stockProducts || [],
  );
  const inStock = rows.some((row) =>
    ['in stock', 'available'].includes((row.stock_product_status || '').toLowerCase()),
  );
  return inStock ? 'in stock' : 'out stock';
};

export default function ProductsPage() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const canAddProduct = can('products', 'add');
  const canEditProduct = can('products', 'edit');
  const canDeleteProduct = can('products', 'delete');

  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [stockTab, setStockTab] = useState<StockTab>('all');
  const [chipFilters, setChipFilters] = useState<{ category: string[]; color: string[] }>({ category: [], color: [] });
  const [counts, setCounts] = useState<Partial<Record<StockTab, number>>>({});
  const [colorHexes, setColorHexes] = useState<Map<string, string>>(new Map());
  const [products, setProducts] = useState<ProductResponse | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);
  const [isDetailFormOpen, setIsDetailFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [colorOptions, setColorOptions] = useState<{ label: string; value: string }[]>([]);
  // Categories by id, for the commands that write a category (the filter above compares names).
  const [categoryChoices, setCategoryChoices] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [resultDialog, setResultDialog] = useState<{
    isOpen: boolean;
    status: 'success' | 'error';
    action: 'delete' | 'update';
    message: string;
  }>({
    isOpen: false,
    status: 'success',
    action: 'delete',
    message: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [policies, setPolicies] = useState<Map<string, StorePolicyState>>(new Map());
  const [policiesLoaded, setPoliciesLoaded] = useState(false);
  const [policiesFailed, setPoliciesFailed] = useState(false);
  const [bulk, setBulk] = useState<{ mode: BulkMode; targets: Product[] } | null>(null);
  // Deleting many uses the one-product endpoint in turn (the API has no bulk delete).
  const [bulkDelete, setBulkDelete] = useState<Product[] | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [preferenceSaved, setPreferenceSaved] = useState(true);
  // Only the newest list / policy request may apply its result.
  const listGate = useRef(createLatestGate());
  const policyGate = useRef(createLatestGate());
  const preferenceStorageKey = preferenceKey('products', user?.employee_id);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setOptionsError(null);
        const [categories, colors] = await Promise.all([
          categoryModel.getAllCategories(),
          colorModel.getAllColors(),
        ]);
        setCategoryOptions(toNameOptions(categories.data.map((category) => category.category_name)));
        setCategoryChoices(
          categories.data.map((category) => ({
            label: category.category_name,
            value: String(category.category_id),
          })),
        );
        setColorOptions(toNameOptions(colors.data.map((color) => color.color_name)));
        setColorHexes(new Map(colors.data.map((color) => [color.color_name, color.color_hex])));
      } catch (error) {
        console.error('Failed to fetch category or color options:', error);
        setOptionsError(loadErrorText('ตัวเลือกประเภทและสี', error));
      }
    };
    void fetchOptions();
  }, []);

  // Store policy of the rows on the page, in one request (never one per row).
  const loadPolicies = useCallback(async (ids: string[]) => {
    const ticket = policyGate.current.begin();
    setPoliciesFailed(false);
    setPoliciesLoaded(false);
    if (ids.length === 0) {
      setPolicies(new Map());
      setPoliciesLoaded(true);
      return;
    }
    try {
      const rows = await productModel.getStorePolicies(ids);
      if (!policyGate.current.isLatest(ticket)) return;
      setPolicies(new Map(rows.map((row) => [row.product_id, row])));
      setPoliciesLoaded(true);
    } catch (error) {
      if (!policyGate.current.isLatest(ticket)) return;
      console.error('Failed to fetch store policies:', error);
      setPolicies(new Map());
      setPoliciesFailed(true);
    }
  }, []);

  // The filters the API takes, in the shape the column filters used to send (names as JSON arrays).
  const filters = useMemo(() => {
    const next: Record<string, string> = {};
    if (chipFilters.category.length) next.category = JSON.stringify(chipFilters.category);
    if (chipFilters.color.length) next.color = JSON.stringify(chipFilters.color);
    const tab = STOCK_TABS.find((item) => item.key === stockTab);
    if (tab?.value) next.stock = JSON.stringify([tab.value]);
    return next;
  }, [chipFilters, stockTab]);

  // The number behind each tab: the API's total for the same search and chips, one small request per tab.
  const loadCounts = useCallback(async () => {
    const base: Record<string, string> = { ...filters };
    delete base.stock;
    try {
      const results = await Promise.all(
        STOCK_TABS.map((tab) =>
          productModel.getProducts(1, 1, appliedSearchQuery, null, 'ASC', tab.value ? { ...base, stock: JSON.stringify([tab.value]) } : base),
        ),
      );
      setCounts(Object.fromEntries(STOCK_TABS.map((tab, index) => [tab.key, results[index].meta.total])));
    } catch {
      setCounts({});
    }
  }, [appliedSearchQuery, filters]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  // The search asks the server after a pause, so one request is not sent per key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearchQuery((current) => {
        const next = searchQuery.trim();
        if (next !== current) {
          setSelectedIds(new Set());
          setCurrentPage(1);
        }
        return next;
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadProducts = useCallback(
    async (page: number) => {
      const ticket = listGate.current.begin();
      try {
        setLoading(true);
        setListError(null);
        const data = await productModel.getProducts(page, 10, appliedSearchQuery, sortField, sortOrder, filters);
        // A slower answer to an older query must not replace the current one.
        if (!listGate.current.isLatest(ticket)) return;
        setProducts(data);
        setMeta(data.meta);
        const present = new Set(data.data.map((product) => product.product_id));
        setSelectedIds((prev) => {
          const kept = new Set([...prev].filter((id) => present.has(id)));
          return kept.size === prev.size ? prev : kept;
        });
        void loadPolicies(data.data.map((product) => product.product_id));
      } catch (error) {
        if (!listGate.current.isLatest(ticket)) return;
        console.error('Failed to fetch products:', error);
        setListError(loadErrorText('รายการสินค้า', error));
      } finally {
        if (listGate.current.isLatest(ticket)) setLoading(false);
      }
    },
    [appliedSearchQuery, sortField, sortOrder, filters, loadPolicies],
  );

  useEffect(() => {
    void loadProducts(currentPage);
  }, [currentPage, loadProducts]);

  // Column preferences are read after mount (the server cannot see storage) and per employee.
  useEffect(() => {
    setHiddenColumns(loadHiddenColumns(browserStorage(), preferenceStorageKey, HIDEABLE_KEYS, REQUIRED_KEYS));
  }, [preferenceStorageKey]);

  // The selection belongs to the rows of one query and page.
  const clearSelection = () => setSelectedIds(new Set());

  const changePage = (page: number) => {
    clearSelection();
    setCurrentPage(page);
  };

  const handleSortChange = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
    clearSelection();
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

  const setChip = (key: 'category' | 'color', values: string[]) => {
    clearSelection();
    setCurrentPage(1);
    setChipFilters((prev) => ({ ...prev, [key]: values }));
  };
  const clearAllFilters = () => {
    clearSelection();
    setCurrentPage(1);
    setSearchQuery('');
    setChipFilters({ category: [], color: [] });
  };

  const setColumnHidden = (hidden: string[]) => {
    setHiddenColumns(hidden);
    setPreferenceSaved(saveHiddenColumns(browserStorage(), preferenceStorageKey, hidden));
  };
  const hiddenSet = new Set(hiddenColumns);
  // A column with an active filter stays visible, so a filter is never left on a column nobody can see.
  const filteredColumns = new Set(Object.keys(filters));
  // The same holds for the active sort, whose control lives in that column's header.
  const columnChoices: ColumnChoice[] = [
    ...REQUIRED_COLUMNS.map((c) => ({ ...c, required: true })),
    ...HIDEABLE_COLUMNS.map((c) => {
      const filtered = filteredColumns.has(c.key);
      const sorted = sortField === c.key;
      return {
        ...c,
        required: filtered || sorted,
        note: filtered ? 'กำลังกรองอยู่' : sorted ? 'กำลังเรียงอยู่' : undefined,
      };
    }),
  ];

  // Define DataTable columns. Filters and sorting are driven by the chips and the header, not by
  // per-column menus, so no column is `filterable` here.
  const columns: DataTableColumn<Product>[] = [
    {
      key: 'product_name' as keyof Product,
      label: 'สินค้า',
      alwaysVisible: true,
      render: (_, row) => {
        const image = row.files?.find((file) => file.product_file_category === 'image');
        return (
          <span className="ka-prod">
            <span className="ka-prod__thumb" aria-hidden="true">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- the API serves uploads outside the image loader
                <img src={`${process.env.NEXT_PUBLIC_API_URL ?? ''}${image.product_file_name}`} alt="" />
              ) : (
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{row.product_name}</span>
              <span className="ka-todo__cap numeric block">{row.product_code || '-'}</span>
            </span>
          </span>
        );
      },
    },
    {
      key: 'product_code',
      label: 'รหัสสินค้า',
      // Shown on the card list as the row's name; in the table the code sits under the product name.
      defaultHidden: true,
      alwaysVisible: false,
      render: (_, row) => <span className="numeric">{row.product_code || '-'}</span>,
    },
    {
      key: 'category' as keyof Product,
      label: 'ประเภท',
      render: (value) => (value as Product['category'])?.category_name ?? '-',
    },
    {
      key: 'color' as keyof Product,
      label: 'สี',
      render: (value, row) => {
        const name = (value as Product['color'])?.color_name || getPrimaryVariant(row)?.color?.color_name;
        if (!name) return '-';
        const hex = colorHexes.get(name);
        return (
          <span className="inline-flex items-center gap-1.5">
            {hex && <i className="ka-swatch" style={{ background: hex, marginRight: 0 }} aria-hidden="true" />}
            {name}
          </span>
        );
      },
    },
    {
      key: 'product_variant_price' as keyof Product,
      label: 'ราคา (บาท)',
      sortable: true,
      render: (value, row) => {
        // The API returns the decimal price as a string ("390.00").
        const rawPrice = value ?? getPrimaryVariant(row)?.product_variant_price;
        const displayPrice = rawPrice === '' || rawPrice === null || rawPrice === undefined ? NaN : Number(rawPrice);
        if (!Number.isFinite(displayPrice)) return <span className="block text-right">-</span>;
        return <span className="numeric block text-right font-semibold">{new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayPrice)}</span>;
      },
    },
    {
      key: 'stock' as keyof Product,
      label: 'สถานะ',
      render: (_value, row) => {
        const status = getStockStatus(row);
        return <StatusBadge tone={status === 'in stock' ? 'success' : 'danger'}>{STOCK_STATUS_LABELS[status] ?? '-'}</StatusBadge>;
      },
    },
    {
      // Display-only column: the key is the column's identity in the table, so it must not repeat another column's.
      key: 'store_policy' as keyof Product,
      label: 'หน้าร้าน',
      render: (_, row) => (
        <StorePolicy
          id={row.product_id}
          editable={canEditProduct}
          policy={policies.get(row.product_id)}
          failed={policiesFailed || (policiesLoaded && !policies.has(row.product_id))}
          onRetry={() => void loadPolicies((products?.data ?? []).map((product) => product.product_id))}
          onChanged={(policy) =>
            setPolicies((prev) => new Map(prev).set(policy.product_id, policy))
          }
        />
      ),
    },
    {
      key: 'adddate' as keyof Product,
      label: 'เพิ่มเมื่อ',
      sortable: true,
      render: (value) => <span className="ka-todo__cap numeric">{formatThaiDate(value as string)}</span>,
    },
    {
      key: 'product_id' as keyof Product,
      label: 'จัดการ',
      alwaysVisible: true,
      render: (_value, row: Product) => (
        <span className="ka-row-actions">
          <button
            type="button"
            onClick={() => {
              setSelectedDetailProduct(row);
              setIsDetailFormOpen(true);
            }}
            className="ka-btn ka-btn--ghost ka-btn--sm ka-btn--icon"
            aria-label={`ดูรายละเอียด ${row.product_name}`}
            title="ดูรายละเอียด"
          >
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          {canEditProduct && (
            <Link
              href={`/admin/products/${row.product_id}/edit`}
              className="ka-btn ka-btn--ghost ka-btn--sm ka-btn--icon"
              aria-label={`แก้ไข ${row.product_name}`}
              title="แก้ไข"
            >
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Link>
          )}
          {(canEditProduct || canDeleteProduct) && (
            <RowMenu
              label={`ตัวเลือกเพิ่มเติม ${row.product_code ?? ''} ${row.product_name}`}
              items={[
                ...(canEditProduct
                  ? [
                      { label: 'แก้ไขด่วน (ชื่อ/หมวดหมู่)', onSelect: () => setQuickEditProduct(row) },
                      { label: 'เปลี่ยนสถานะตัวเลือก', onSelect: () => openBulk('status', [row]) },
                    ]
                  : []),
                ...(canDeleteProduct
                  ? [
                      {
                        label: 'ลบสินค้า',
                        tone: 'danger' as const,
                        onSelect: () => {
                          setProductToDelete(row);
                          setIsDeleteDialogOpen(true);
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </span>
      ),
    },
  ];

  // Reloads the current query (search, sort and filters included) after a change.
  const handleRefreshProduct = async (checkPageAfterDelete = false) => {
    let targetPage = currentPage;
    // After a delete, a page left empty steps back one page.
    if (checkPageAfterDelete && currentPage > 1 && products?.data.length === 1) {
      targetPage = currentPage - 1;
      clearSelection();
      setCurrentPage(targetPage);
    }
    await loadProducts(targetPage);
    void loadCounts();
  };

  const pageProducts = products?.data ?? [];
  const chosenProducts = selectedProducts(pageProducts, selectedIds);
  const visibleColumns = columns.filter((column) => !hiddenSet.has(String(column.key)));

  const openBulk = (mode: BulkMode, targets: Product[]) => {
    if (targets.length > 0) setBulk({ mode, targets });
  };
  // The API has confirmed the change: reload what the table shows and drop the
  // selection, which pointed at the rows as they were before.
  const finishCommand = (message: string) => {
    setBulk(null);
    setQuickEditProduct(null);
    clearSelection();
    setResultDialog({ isOpen: true, status: 'success', action: 'update', message });
    void handleRefreshProduct();
  };

  // ConfirmDialog closes itself after confirm, so the targets are taken before that; the
  // BulkBar shows the progress and stays disabled until the loop and the reload are done.
  const runBulkDelete = async () => {
    const targets = bulkDelete;
    if (!targets || bulkDeleting) return;
    setBulkDelete(null);
    setBulkDeleting(true);
    const failed: string[] = [];
    for (const product of targets) {
      try {
        await productModel.deleteProduct(product.product_id);
      } catch {
        failed.push(product.product_name);
      }
    }
    clearSelection();
    await handleRefreshProduct(true);
    setBulkDeleting(false);
    const done = targets.length - failed.length;
    setResultDialog({
      isOpen: true,
      status: failed.length === 0 ? 'success' : 'error',
      action: 'delete',
      message:
        failed.length === 0
          ? `ลบสินค้าแล้ว ${count(done)} รายการ`
          : `ลบแล้ว ${count(done)} รายการ ลบไม่ได้ ${count(failed.length)} รายการ: ${failed.join(', ')}`,
    });
  };

  const activeFilterCount = chipFilters.category.length + chipFilters.color.length + (searchQuery.trim() ? 1 : 0);
  const chipOptions = (options: { label: string; value: string }[]) => options.map((option) => ({ value: option.value, label: option.label }));

  return (
    <div className="ka-page-body">
      <div className="ka-ph">
        <div>
          <h1 className="ka-ph__title">รายการสินค้า</h1>
          <p className="ka-ph__lead">
            {counts.all === undefined ? 'กำลังนับ…' : `${count(counts.all)} สินค้า`}
            {counts.in !== undefined && counts.out !== undefined ? ` · มีสินค้า ${count(counts.in)} · สินค้าหมด ${count(counts.out)}` : ''}
          </p>
        </div>
        {canAddProduct && (
          <Link href="/admin/products/new" className="ka-btn ka-btn--primary">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            เพิ่มสินค้า
          </Link>
        )}
      </div>

      <LoadErrorBanner message={optionsError} className="mb-4" />
      <LoadErrorBanner message={listError} onRetry={() => void handleRefreshProduct()} className="mb-4" />

      <section className="ka-card ka-table-card" aria-label="ตารางสินค้า">
        <nav className="ka-tabs" aria-label="สถานะสินค้า">
          {STOCK_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={stockTab === tab.key ? 'true' : undefined}
              onClick={() => {
                clearSelection();
                setCurrentPage(1);
                setStockTab(tab.key);
              }}
            >
              {tab.label}
              {counts[tab.key] !== undefined && <span className="numeric">{count(counts[tab.key] as number)}</span>}
            </button>
          ))}
        </nav>

        <div className="ka-fbar">
          <div className="ka-input-wrap ka-fbar__search">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              className="ka-input"
              aria-label="ค้นหาสินค้า"
              placeholder="ชื่อหรือรหัสสินค้า"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <FilterChip
            label="ประเภท"
            options={chipOptions(categoryOptions)}
            selected={chipFilters.category}
            onChange={(values) => setChip('category', values)}
          />
          <FilterChip
            label="สี"
            options={chipOptions(colorOptions)}
            selected={chipFilters.color}
            onChange={(values) => setChip('color', values)}
          />
          {activeFilterCount > 0 && (
            <button type="button" className="ka-btn ka-btn--ghost" onClick={clearAllFilters}>
              ล้างตัวกรอง
            </button>
          )}
          <span className="ka-table-tools__spacer" />
          <span className="max-sm:hidden">
            <ColumnMenu
              columns={columnChoices}
              hidden={hiddenSet}
              saved={preferenceSaved}
              onToggle={(key, visible) =>
                setColumnHidden(visible ? hiddenColumns.filter((k) => k !== key) : [...hiddenColumns, key])
              }
              onReset={() => setColumnHidden([])}
            />
          </span>
        </div>

        {canEditProduct && chosenProducts.length > 0 && (
          <div className="px-4 pt-3">
            <BulkBar count={chosenProducts.length} onClear={clearSelection}>
              {bulkDeleting ? (
                <span role="status" className="ka-bulk__count">กำลังลบ {count(chosenProducts.length)} รายการ…</span>
              ) : (
                <>
                  <BulkAction disabled={loading} onClick={() => openBulk('category', chosenProducts)}>เปลี่ยนหมวดหมู่</BulkAction>
                  <BulkAction disabled={loading} onClick={() => openBulk('policy', chosenProducts)}>ตั้งค่าหน้าร้าน</BulkAction>
                  <BulkAction disabled={loading} onClick={() => openBulk('status', chosenProducts)}>เปลี่ยนสถานะตัวเลือก</BulkAction>
                  {canDeleteProduct && (
                    <BulkAction tone="danger" disabled={loading} onClick={() => setBulkDelete(chosenProducts)}>ลบ</BulkAction>
                  )}
                </>
              )}
            </BulkBar>
          </div>
        )}

        <DataTable
          data={pageProducts}
          columns={visibleColumns}
          keyField="product_id"
          cardTitleKey="product_name"
          loading={loading && !products}
          disabled={loading}
          className="ka-table-flat"
          paginationMeta={meta}
          currentPage={currentPage}
          onPageChange={changePage}
          selection={
            canEditProduct
              ? {
                  selectedKeys: selectedIds,
                  onChange: setSelectedIds,
                  getRowLabel: (row) => row.product_name,
                  disabled: bulk !== null,
                }
              : undefined
          }
          onSortChange={handleSortChange}
          emptyHint={activeFilterCount > 0 || stockTab !== 'all' ? 'ไม่พบสินค้าที่ตรงกับตัวกรอง ลองล้างตัวกรองหรือเลือกแท็บอื่น' : 'ยังไม่มีสินค้า กดเพิ่มสินค้าเพื่อเริ่ม'}
        />
      </section>

      <ProductDetailModal
        isOpen={isDetailFormOpen}
        onClose={() => {
          setIsDetailFormOpen(false);
          setSelectedDetailProduct(null);
        }}
        product={selectedDetailProduct}
      />
      {bulk && canEditProduct && (
        <BulkDialog
          key={bulk.mode}
          mode={bulk.mode}
          products={bulk.targets}
          policies={policies}
          categories={categoryChoices}
          onClose={() => setBulk(null)}
          onSaved={finishCommand}
        />
      )}
      {quickEditProduct && canEditProduct && !bulk && (
        <QuickEdit
          key={quickEditProduct.product_id}
          product={quickEditProduct}
          categories={categoryChoices}
          onClose={() => setQuickEditProduct(null)}
          onSaved={finishCommand}
          onEditVariants={() => {
            const product = quickEditProduct;
            setQuickEditProduct(null);
            openBulk('status', [product]);
          }}
        />
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={canDeleteProduct && isDeleteDialogOpen}
        title={`ลบ “${productToDelete?.product_name ?? ''}”?`}
        message="สินค้านี้และทุกแบบจะหายจากหน้าร้านทันที ระบบจะลบข้อมูลที่เชื่อมโยง (รวมไฟล์สินค้าและแบบสินค้า) และย้อนกลับไม่ได้ ใบขายเดิมยังเก็บไว้ครบ"
        confirmLabel="ลบสินค้า"
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={async () => {
          if (productToDelete) {
            try {
              await productModel.deleteProduct(productToDelete.product_id);
              // รีเฟรชข้อมูลสินค้า และตรวจสอบว่าหน้านี้ยังมีข้อมูลหรือไม่
              await handleRefreshProduct(true);
              setResultDialog({
                isOpen: true,
                status: 'success',
                action: 'delete',
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
                action: 'delete',
                message: errorMessage,
              });
            }
            setIsDeleteDialogOpen(false);
            setProductToDelete(null);
          }
        }}
      />

      <ConfirmDialog
        isOpen={canDeleteProduct && bulkDelete !== null}
        title={`ลบสินค้า ${count(bulkDelete?.length ?? 0)} รายการ?`}
        message={`${(bulkDelete ?? []).slice(0, 5).map((product) => product.product_name).join(', ')}${(bulkDelete?.length ?? 0) > 5 ? ` และอีก ${count((bulkDelete?.length ?? 0) - 5)} รายการ` : ''} จะหายจากหน้าร้านทันที ระบบลบทีละรายการและย้อนกลับไม่ได้ ใบขายเดิมยังเก็บไว้ครบ`}
        confirmLabel={`ลบ ${count(bulkDelete?.length ?? 0)} รายการ`}
        onCancel={() => setBulkDelete(null)}
        onConfirm={() => void runBulkDelete()}
      />

      <ActionResultDialog
        isOpen={resultDialog.isOpen}
        status={resultDialog.status}
        action={resultDialog.action}
        message={resultDialog.message}
        onClose={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
