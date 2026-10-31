import type { Product } from '@/types/product';

export const getPrimaryVariant = (product: Product) => {
  const variants = product.product_variants || product.productVariants || [];
  return variants[0];
};

// The API writes 'in stock' (job order closed) or 'available' (sale order stock
// change) when quantity remains, and 'out stock' when none does. A product is
// in stock when any of its variants has such a row. Stock rows only exist once
// a job order has been closed, so a product without any has nothing in stock.
export const STOCK_STATUS_LABELS: Record<string, string> = {
  'in stock': 'มีสินค้า',
  'out stock': 'สินค้าหมด',
};

export const getStockStatus = (product: Product): string => {
  const rows = (product.product_variants || product.productVariants || []).flatMap(
    (variant) => variant.stockProducts || [],
  );
  const inStock = rows.some((row) =>
    ['in stock', 'available'].includes((row.stock_product_status || '').toLowerCase()),
  );
  return inStock ? 'in stock' : 'out stock';
};
