'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { usePermissions } from '@/hooks/usePermissions';
import { adminMenu, isMenuHrefActive, type AdminMenuItem } from '@/lib/admin-menu';

const isLeafActive = (href: string, pathname: string) => pathname === href || pathname.startsWith(`${href}/`);

export default function Sidebar() {
  const { isOpen, closeSidebar } = useSidebar();
  const pathname = usePathname();
  const { can } = usePermissions();
  // The group holding the current page starts open.
  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    adminMenu.flatMap((section) => section.items)
      .filter((item) => item.subItems?.some((sub) => isLeafActive(sub.href, pathname)))
      .map((item) => item.title),
  );

  const setExpanded = (title: string, open: boolean) => {
    setExpandedItems((prev) => {
      if (open === prev.includes(title)) return prev;
      return open ? [...prev, title] : prev.filter((item) => item !== title);
    });
  };

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeSidebarRef = useRef(closeSidebar);

  useEffect(() => {
    closeSidebarRef.current = closeSidebar;
  }, [closeSidebar]);

  // Below 1024px the sidebar is a drawer: move focus into it, let Escape close it,
  // and hand focus back to the button that opened it once it closes.
  useEffect(() => {
    if (!isOpen || window.innerWidth >= 1024) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSidebarRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const focusLost = !document.activeElement || document.activeElement === document.body;
      if (focusLost && opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  // Close the drawer after navigating on mobile and tablet.
  const closeOnSmallScreen = () => {
    if (window.innerWidth < 1024) closeSidebar();
  };

  const renderMenuItem = (item: AdminMenuItem) => {
    if (!item.subItems?.length) {
      return (
        <Link
          key={item.title}
          href={item.href || '#'}
          onClick={closeOnSmallScreen}
          className="ka-nav-item"
          aria-current={item.href && isMenuHrefActive(item.href, pathname) ? 'page' : undefined}
        >
          {item.icon}
          {item.title}
        </Link>
      );
    }

    return (
      <details
        key={item.title}
        className="ka-nav-group"
        open={expandedItems.includes(item.title)}
        onToggle={(event) => setExpanded(item.title, event.currentTarget.open)}
      >
        <summary>
          {item.icon}
          {item.title}
          <svg className="ka-chev" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </summary>
        <div className="ka-subnav">
          {item.subItems.map((subItem) => {
            // ไม่แสดงเมนูย่อยถ้าไม่มีสิทธิ์ดู
            if (!can(subItem.menu_name, 'view')) return null;
            return (
              <Link
                key={subItem.title}
                href={subItem.href}
                onClick={closeOnSmallScreen}
                className="ka-nav-item"
                aria-current={isLeafActive(subItem.href, pathname) ? 'page' : undefined}
              >
                {subItem.title}
              </Link>
            );
          })}
        </div>
      </details>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="ka-drawer-scrim" onClick={closeSidebar} aria-hidden="true" />
      <aside className="ka-sidebar ka-sidebar--app" aria-label="เมนูหลัก">
        <div className="ka-sidebar__brand">
          <span className="ka-logo-plate">
            <Image src="/kan-product-mark.png" alt="" width={32} height={32} />
          </span>
          <span className="ka-sidebar__name">
            <strong>KAN PRODUCT</strong>
            <span>ระบบหลังร้าน</span>
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSidebar}
            className="ka-btn ka-btn--ghost ka-btn--sm ka-btn--icon ml-auto text-[var(--ink-on-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white lg:hidden"
            aria-label="ปิดเมนูด้านข้าง"
          >
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="ka-nav">
          {adminMenu.map((section) => (
            <div key={section.heading}>
              <p className="ka-nav__heading">{section.heading}</p>
              <div className="grid gap-0.5">{section.items.map(renderMenuItem)}</div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
