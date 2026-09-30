import type { ReactNode } from 'react';

export interface AdminMenuLeaf {
  title: string;
  menu_name: string;
  href: string;
}

export interface AdminMenuItem {
  title: string;
  icon: ReactNode;
  href?: string;
  subItems?: AdminMenuLeaf[];
}

export interface AdminMenuSection {
  heading: string;
  items: AdminMenuItem[];
}

const icon = (d: string) => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export const adminMenu: AdminMenuSection[] = [
  {
    heading: 'HOME',
    items: [
      {
        title: 'Dashboard 1',
        icon: icon('M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'),
        href: '/',
      },
      {
        title: 'Dashboard 2',
        icon: icon('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'),
        href: '/dashboard2',
      },
    ],
  },
  {
    heading: 'APPS',
    items: [
      {
        title: 'สินค้า',
        icon: icon('M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'),
        subItems: [
          { title: 'สินค้า', menu_name: 'products', href: '/admin/products' },
          { title: 'ผลิตสินค้า', menu_name: 'job_orders', href: '/admin/job-orders' },
        ],
      },
      {
        title: 'จัดซื้อ',
        icon: icon('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'),
        subItems: [
          { title: 'ใบสั่งซื้อ', menu_name: 'purchase_orders', href: '/admin/purchase-orders' },
          { title: 'ใบรับสินค้า', menu_name: 'purchase_receipt', href: '/admin/purchase-receipt' },
          { title: 'ใบจ่ายชำระหนี้', menu_name: 'invoice_supplier', href: '/admin/invoice-supplier' },
        ],
      },
      {
        title: 'ขายสินค้า',
        icon: icon('M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z'),
        subItems: [
          { title: 'ใบสั่งขาย', menu_name: 'sale_orders', href: '/admin/sale-orders' },
          { title: 'ใบเสร็จรับเงิน', menu_name: 'payment_receipts', href: '/admin/payment-receipts' },
        ],
      },
      {
        title: 'หน้าร้านออนไลน์',
        icon: icon('M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3-3-3z'),
        subItems: [
          { title: 'คำขอติดต่อกลับ', menu_name: 'contact_requests', href: '/admin/contact-requests' },
          { title: 'จัดส่งพัสดุ', menu_name: 'store_fulfillment', href: '/admin/store-fulfillment' },
        ],
      },
      {
        title: 'จัดการข้อมูลพื้นฐาน',
        icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'),
        subItems: [
          { title: 'วัตถุดิบ', menu_name: 'materials', href: '/admin/materials' },
          { title: 'สีของสินค้า', menu_name: 'colors', href: '/admin/colors' },
          { title: 'ขนาดของสินค้า', menu_name: 'sizes', href: '/admin/sizes' },
          { title: 'ประเภทสินค้า', menu_name: 'categories', href: '/admin/categories' },
          { title: 'หน่วยสินค้า', menu_name: 'product_unit', href: '/admin/product-unit' },
          { title: 'ผู้จัดจำหน่าย', menu_name: 'suppliers', href: '/admin/suppliers' },
          { title: 'บัญชีรับเงิน', menu_name: 'bank_accounts', href: '/admin/bank-account' },
          { title: 'ตั้งค่าพื้นฐาน', menu_name: 'settings', href: '/admin/settings' },
          { title: 'พนักงาน', menu_name: 'employees', href: '/admin/employees' },
          { title: 'สิทธิ์ผู้ใช้งาน', menu_name: 'employee_licenses', href: '/admin/license' },
          { title: 'ประวัติสิทธิ์และพนักงาน', menu_name: 'access_logs', href: '/admin/access-logs' },
        ],
      },
    ],
  },
];

/** "/" redirects to the dashboard at "/admin", so both count as Dashboard 1. */
export function isMenuHrefActive(href: string, pathname: string): boolean {
  return pathname === href || (href === '/' && pathname === '/admin');
}

/** The menu path to the current page, for the header breadcrumb: [group, page] or [page]. */
export function getMenuTrail(pathname: string): string[] {
  for (const section of adminMenu) {
    for (const item of section.items) {
      if (item.href && isMenuHrefActive(item.href, pathname)) return [item.title];
      const leaf = item.subItems?.find((sub) => pathname === sub.href || pathname.startsWith(`${sub.href}/`));
      if (leaf) return [item.title, leaf.title];
    }
  }
  return [];
}
