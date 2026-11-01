'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import ThemeToggle from '@/components/ThemeToggle';
import HeaderSearch from '@/components/layout/HeaderSearch';
import Link from 'next/link';
import { getMenuTrail } from '@/lib/admin-menu';
import { useCurrentCrumb } from '@/lib/page-crumb';
import NotificationPanel from '@/components/layout/NotificationPanel';
import { summarizePending } from '@/components/dashboard/PendingWork';
import { usePendingWork } from '@/hooks/usePendingWork';

/** Page name, search, notifications and theme. The employee's own menu is at the foot of the sidebar. */
export default function Header() {
  const pendingWork = usePendingWork(true);
  const { toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const trail = getMenuTrail(pathname);
  const pageTitle = trail[trail.length - 1];
  const crumb = useCurrentCrumb();

  return (
    <header className="ka-header">
      <button type="button" onClick={toggleSidebar} className="ka-btn ka-btn--ghost ka-btn--icon ka-header__menu" aria-label="เปิดเมนู">
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {crumb ? (
        <nav className="ka-crumb" aria-label="ตำแหน่ง">
          {crumb.back && (
            <Link href={crumb.back.href} className="ka-crumb__back">
              <span aria-hidden="true">←</span> {crumb.back.label}
            </Link>
          )}
          {crumb.parents?.map((parent) => (
            <span key={parent} className="ka-crumb__step">{parent}</span>
          ))}
          <span className="ka-crumb__sep" aria-hidden="true">/</span>
          <span className="ka-crumb__current" aria-current="page">{crumb.current}</span>
        </nav>
      ) : (
        pageTitle && <p className="ka-header__title">{pageTitle}</p>
      )}

      <HeaderSearch />

      <NotificationPanel urgent={summarizePending(pendingWork)?.urgent ?? 0} />

      <ThemeToggle />
    </header>
  );
}
