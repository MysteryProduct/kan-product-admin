'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import { getMenuTrail } from '@/lib/admin-menu';

const SearchIcon = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export default function Header() {
  const { toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const trail = getMenuTrail(pathname);
  const pageTitle = trail[trail.length - 1];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="ka-header">
      <button type="button" onClick={toggleSidebar} className="ka-btn ka-btn--ghost ka-btn--icon" aria-label="เปิดหรือปิดเมนูด้านข้าง">
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="ka-header__title">
        {trail.length > 1 && (
          <ol className="ka-crumbs" aria-label="ตำแหน่งหน้า">
            {trail.slice(0, -1).map((step) => <li key={step}>{step}</li>)}
          </ol>
        )}
        {pageTitle && <p className="m-0 line-clamp-2 text-base font-bold leading-5 sm:line-clamp-none sm:truncate sm:text-[20px] sm:leading-7">{pageTitle}</p>}
      </div>

      <div className="ka-input-wrap ka-header__search">
        <SearchIcon />
        <input type="search" aria-label="ค้นหา" placeholder="ค้นหา" className="ka-input" />
      </div>
      <button type="button" aria-label="ค้นหา" className="ka-btn ka-btn--ghost ka-btn--icon hidden sm:inline-flex lg:hidden">
        <SearchIcon />
      </button>

      <ThemeToggle />

      <button type="button" aria-label="การแจ้งเตือน" className="ka-btn ka-btn--ghost ka-btn--icon">
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <span className="ka-avatar" aria-hidden="true">
          {user?.employee_username?.charAt(0).toUpperCase() || 'U'}
        </span>
        <span className="ka-user__text">
          <strong>{user?.employee_username || 'User'}</strong>
          <span>Admin</span>
        </span>
        <button type="button" onClick={handleLogout} className="ka-btn ka-btn--ghost ka-btn--icon" aria-label="ออกจากระบบ" title="ออกจากระบบ">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
