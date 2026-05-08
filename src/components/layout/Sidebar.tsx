'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { usePermissions } from '@/hooks/usePermissions';

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  href?: string;
  badge?: number;
  subItems?: { title: string; menu_name: string; href: string }[];
}

export default function Sidebar() {
  const { isOpen, closeSidebar } = useSidebar();
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { can } = usePermissions();

  const toggleExpand = (title: string) => {
    setExpandedItems(prev =>
      prev.includes(title) ? prev.filter(item => item !== title) : [...prev, title]
    );
  };
  const menuItems: MenuItem[] = [
    {
      title: 'Dashboard 1',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      href: '/',
    },
    {
      title: 'Dashboard 2',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      href: '/dashboard2',
    },
    // {
    //   title: 'Frontend Pages',
    //   icon: (
    //     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    //     </svg>
    //   ),
    //   subItems: [
    //     { title: 'Pricing', href: '/pricing' },
    //     { title: 'Account Settings', href: '/account' },
    //     { title: 'FAQ', href: '/faq' },
    //   ],
    // },
  ];

  const appsItems: MenuItem[] = [
    {
      title: 'สินค้า',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>

      ),
      subItems: [
        { title: 'สินค้า', menu_name: 'products', href: '/admin/products' },
        { title: 'ผลิตสินค้า', menu_name: 'job_orders', href: '/admin/job-orders' },
      ],
    },
    {
      title: 'จัดซื้อ',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      subItems: [
        { title: 'ใบสั่งซื้อ', menu_name: 'purchase_orders', href: '/admin/purchase-orders' },
        { title: 'ใบรับสินค้า', menu_name: 'purchase_receipt', href: '/admin/purchase-receipt' },
        { title: 'ใบจ่ายชำระหนี้', menu_name: 'invoice_supplier', href: '/admin/invoice-supplier' },
      ],
    },
    {
      title: 'ขายสินค้า',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      subItems: [
        { title: 'ใบสั่งขาย', menu_name: 'sale_orders', href: '/admin/sale-orders' },
        { title: 'ใบเสร็จรับเงิน', menu_name: 'payment_receipts', href: '/admin/payment-receipts' },
        // { title: 'ใบส่งสินค้า', menu_name: 'delivery_notes', href: '/admin/delivery-notes' },
        // { title: 'ใบแจ้งหนี้', menu_name: 'invoices', href: '/admin/invoices' },
      ],
    },
    {
      title: 'จัดการข้อมูลพื้นฐาน',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      subItems: [
        // { title: 'สินค้า', menu_name: 'products', href: '/admin/products' },
        { title: 'วัตถุดิบ', menu_name: 'materials', href: '/admin/materials' },
        { title: 'สีของสินค้า', menu_name: 'colors', href: '/admin/colors' },
        { title: 'ขนาดของสินค้า', menu_name: 'sizes', href: '/admin/sizes' },
        { title: 'ประเภทสินค้า', menu_name: 'categories', href: '/admin/categories' },
        { title: 'หน่วยสินค้า', menu_name: 'product_unit', href: '/admin/product-unit' },
        { title: 'ผู้จัดจำหน่าย', menu_name: 'suppliers', href: '/admin/suppliers' },
        { title: 'บัญชีรับเงิน', menu_name: 'bank_accounts', href: '/admin/bank-account' },
        { title: 'ตั้งค่าพื้นฐาน', menu_name: 'settings', href: '/admin/settings' },
        { title: 'สิทธธิ์ผู้ใช้งาน', menu_name: 'license', href: '/admin/license' },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem, isSubItem = false) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedItems.includes(item.title);
    const isActive = pathname === item.href;
    const hasActiveSubItem = hasSubItems && item.subItems?.some(subItem => pathname === subItem.href);

    return (
      <div key={item.title}>
        <Link
          href={item.href || '#'}
          onClick={(e) => {
            if (hasSubItems) {
              e.preventDefault();
              toggleExpand(item.title);
            } else {
              // ปิด sidebar บน mobile/tablet เมื่อคลิกเมนู
              if (window.innerWidth < 1024) {
                closeSidebar();
              }
            }
          }}
          className={`flex items-center justify-between px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors ${isActive || hasActiveSubItem ? 'bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : ''}
            } ${isSubItem ? 'pl-12 text-sm' : ''}`}
        >
          <div className="flex items-center gap-3">
            {item.icon}
            <span className="font-medium">{item.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {item.badge && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {item.badge}
              </span>
            )}
            {hasSubItems && (
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </Link>

        {hasSubItems && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.subItems?.map((subItem) => {
              const isSubItemActive = pathname === subItem.href;
              {/* ตรวจสอบสิทธิ์การเข้าถึงเมนูย่อย */ }
              if (!can(subItem.menu_name, 'view')) {
                return null; // ไม่แสดงเมนูย่อยถ้าไม่มีสิทธิ์ดู
              }
              return (
                <Link
                  key={subItem.title}
                  href={subItem.href}
                  onClick={() => {
                    // ปิด sidebar บน mobile/tablet เมื่อคลิกเมนูย่อย
                    if (window.innerWidth < 1024) {
                      closeSidebar();
                    }
                  }}
                  className={`flex items-center px-4 py-2 pl-12 text-sm text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors ${isSubItemActive ? 'bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-medium' : ''}`}
                >
                  {subItem.title}
                </Link>
              )

            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 hidden"
          onClick={closeSidebar}
        />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 h-screen bg-white dark:bg-gray-800 flex-col overflow-y-auto z-50 transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'translate-x-0 w-64 border-r border-gray-200 dark:border-gray-700 flex' : '-translate-x-full lg:translate-x-0 w-0 lg:w-0 border-0 hidden lg:flex'}`}>
        {/* Logo */}
        <div className={`p-6 border-b border-gray-200 dark:border-gray-700 ${!isOpen && 'hidden lg:hidden'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">Kan Product</span>
            </div>
            <button
              onClick={closeSidebar}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 p-4 space-y-6 ${!isOpen && 'hidden lg:hidden'}`}>
          {/* HOME Section */}
          <div>
            <h6 className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              HOME
            </h6>
            <div className="space-y-1">
              {menuItems.map((item) => renderMenuItem(item))}
            </div>
          </div>

          {/* APPS Section */}
          <div>
            <h6 className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              APPS
            </h6>
            <div className="space-y-1">
              {appsItems.map((item) => renderMenuItem(item))}
            </div>
          </div>
        </nav>

        {/* User Profile */}
        <div className={`p-4 border-t border-gray-200 dark:border-gray-700 ${!isOpen && 'hidden lg:hidden'}`}>
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
              M
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mike</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Admin</p>
            </div>
            <button className="text-blue-600 hover:text-blue-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
