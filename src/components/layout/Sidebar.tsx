'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { usePermissions } from '@/hooks/usePermissions';
import { usePendingWork } from '@/hooks/usePendingWork';
import { useStockPending } from '@/hooks/useStockPending';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { adminMenu, isMenuHrefActive, pendingCount, type AdminMenuItem } from '@/lib/admin-menu';
import { canOpenStock } from '@/lib/permission-routes';
import SidebarUser from '@/components/layout/SidebarUser';

const isLeafActive = (href: string, pathname: string) => pathname === href || pathname.startsWith(`${href}/`);

const formatCount = (value: number) => new Intl.NumberFormat('th-TH').format(value);

/** The number of jobs waiting on a page. Hidden at 0: the badge means "something needs you". */
function PendingBadge({ value }: { value: number | undefined }) {
  if (!value) return null;
  return (
    <span className="ka-count">
      <span className="sr-only">รอดำเนินการ </span>
      {formatCount(value)}
    </span>
  );
}

export default function Sidebar() {
  const { isOpen, closeSidebar, compact } = useSidebar();
  // TASK-0210 v2: a page in split view asks for the 72px icon rail at 1024–1279px. A group
  // icon there opens the full menu over the page ("peek"); choosing a page closes it.
  const railWidth = useMediaQuery('(min-width: 1024px) and (max-width: 1279px)');
  const [peek, setPeek] = useState(false);
  const rail = compact && railWidth && !peek;
  const peeking = compact && railWidth && peek;
  useEffect(() => {
    if (!peeking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) setPeek(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [peeking]);
  const pathname = usePathname();
  const { can } = usePermissions();
  const pendingWork = usePendingWork(true);
  const stockPending = useStockPending();
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
      // A sheet or dialog opened from the drawer (the account menu, the password form) takes its own Esc.
      if (event.key !== 'Escape' || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      closeSidebarRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const focusLost = !document.activeElement || document.activeElement === document.body;
      if (focusLost && opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  // Close the drawer after navigating on mobile and tablet, and the menu opened over the rail.
  const closeOnSmallScreen = () => {
    if (window.innerWidth < 1024) closeSidebar();
    setPeek(false);
  };

  const renderMenuItem = (item: AdminMenuItem) => {
    if (!item.subItems?.length) {
      if (item.anyMenu && !canOpenStock(can)) return null;
      return (
        <Link
          key={item.title}
          href={item.href || '#'}
          onClick={closeOnSmallScreen}
          className="ka-nav-item"
          aria-current={item.href && isMenuHrefActive(item.href, pathname) ? 'page' : undefined}
          aria-label={rail ? item.title : undefined}
          title={rail ? item.title : undefined}
        >
          {item.icon}
          <span className="ka-nav__label">{item.title}</span>
          {item.anyMenu && <PendingBadge value={stockPending?.total} />}
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
        <summary
          aria-label={rail ? `${item.title} เปิดเมนู` : undefined}
          title={rail ? item.title : undefined}
          onClick={(event) => {
            if (!rail) return;
            event.preventDefault();
            setExpanded(item.title, true);
            setPeek(true);
          }}
        >
          {item.icon}
          <span className="ka-nav__label">{item.title}</span>
          <PendingBadge
            value={item.subItems
              .filter((sub) => can(sub.menu_name, 'view'))
              .reduce((sum, sub) => sum + (pendingCount(sub, pendingWork) ?? 0), 0)}
          />
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
                <PendingBadge value={pendingCount(subItem, pendingWork)} />
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
      {peeking && (
        <>
          <div className="ka-rail-spacer" aria-hidden="true" />
          <div className="ka-rail-scrim" onClick={() => setPeek(false)} aria-hidden="true" />
        </>
      )}
      <aside
        className={`ka-sidebar ka-sidebar--app${rail ? ' ka-sidebar--rail' : ''}${peeking ? ' ka-sidebar--peek' : ''}`}
        aria-label="เมนูหลัก"
      >
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
        <SidebarUser />
      </aside>
    </>
  );
}
