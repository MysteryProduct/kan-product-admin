const ROUTE_MENU_MAP: Record<string, string> = {
  '/admin/purchase-orders': 'purchase_orders',
  '/admin/products': 'products',
  '/admin/colors': 'colors',
  '/admin/categories': 'categories',
  '/admin/product-unit': 'product_unit',
  '/admin/suppliers': 'suppliers',
  '/admin/license': 'license',
};

export function getMenuNameFromPath(pathname: string): string | null {
  const sortedPrefixes = Object.keys(ROUTE_MENU_MAP).sort((a, b) => b.length - a.length);
  const matchedPrefix = sortedPrefixes.find((prefix) => pathname.startsWith(prefix));

  if (!matchedPrefix) {
    return null;
  }

  return ROUTE_MENU_MAP[matchedPrefix];
}
