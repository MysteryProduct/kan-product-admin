/** The stock menu opens with any one of these (G9); each tab then checks its own. */
export const STOCK_MENUS = ['stock_material', 'stock_product', 'store_fulfillment'];

const ROUTE_MENU_MAP: Record<string, string> = {
  '/admin/purchase-orders': 'purchase_orders',
  '/admin/purchase-receipt': 'purchase_receipt',
  '/admin/invoice-supplier': 'invoice_supplier',
  '/admin/materials': 'materials',
  '/admin/job-orders': 'job_orders',
  '/admin/custom-review': 'job_orders',
  '/admin/products': 'products',
  '/admin/custom-templates': 'products',
  '/admin/colors': 'colors',
  '/admin/sizes': 'sizes',
  '/admin/categories': 'categories',
  '/admin/product-unit': 'product_unit',
  '/admin/suppliers': 'suppliers',
  '/admin/bank-account': 'bank_accounts',
  '/admin/settings': 'settings',
  '/admin/sale-orders': 'sale_orders',
  '/admin/payment-receipts': 'payment_receipts',
  '/admin/contact-requests': 'contact_requests',
  '/admin/store-fulfillment': 'store_fulfillment',
  '/admin/license': 'employee_licenses',
  '/admin/employees': 'employees',
  '/admin/access-logs': 'access_logs',
};

/** `add` alone also opens it: that person reaches the count tab only (TASK-0364 Q11, Q12). */
export function canOpenStock(can: (menu: string, action: 'view' | 'add') => boolean): boolean {
  return STOCK_MENUS.some((menu) => can(menu, 'view')) || can('stock_material', 'add') || can('stock_product', 'add');
}

/** The menus that open this path: viewing any one of them is enough. Empty for an ungated path. */
export function getMenuNamesFromPath(pathname: string): string[] {
  if (pathname === '/admin/stock' || pathname.startsWith('/admin/stock/')) return STOCK_MENUS;
  const menu = getMenuNameFromPath(pathname);
  return menu ? [menu] : [];
}

export function getMenuNameFromPath(pathname: string): string | null {
  const sortedPrefixes = Object.keys(ROUTE_MENU_MAP).sort((a, b) => b.length - a.length);
  const matchedPrefix = sortedPrefixes.find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!matchedPrefix) {
    return null;
  }

  return ROUTE_MENU_MAP[matchedPrefix];
}

/** Admin routes that require view on this menu (case-insensitive, as permissions match). */
export function getPathsForMenu(menuName: string): string[] {
  const menu = menuName.toLowerCase();
  const paths = Object.keys(ROUTE_MENU_MAP).filter((path) => ROUTE_MENU_MAP[path].toLowerCase() === menu);
  return STOCK_MENUS.includes(menu) ? [...paths, '/admin/stock'] : paths;
}
