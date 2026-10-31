'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import ActionResultDialog from '@/components/ActionResultDialog';
import ChangePasswordModal from '@/components/layout/ChangePasswordModal';
import HeaderSearch from '@/components/layout/HeaderSearch';
import { getMenuTrail } from '@/lib/admin-menu';
import NotificationPanel from '@/components/layout/NotificationPanel';
import { summarizePending } from '@/components/dashboard/PendingWork';
import { usePendingWork } from '@/hooks/usePendingWork';

export default function Header() {
  const pendingWork = usePendingWork(true);
  const { toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [passwordChanged, setPasswordChanged] = React.useState(false);
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

      <HeaderSearch />

      <ThemeToggle />

      <NotificationPanel urgent={summarizePending(pendingWork)?.urgent ?? 0} />

      <div className="flex items-center gap-2">
        <span className="ka-avatar" aria-hidden="true">
          {user?.employee_username?.charAt(0).toUpperCase() || 'U'}
        </span>
        <span className="ka-user__text">
          <strong>{user?.employee_username || 'User'}</strong>
          <span>Admin</span>
        </span>
        <button
          type="button"
          onClick={() => setPasswordOpen(true)}
          className="ka-btn ka-btn--ghost ka-btn--icon"
          aria-label="เปลี่ยนรหัสผ่าน"
          title="เปลี่ยนรหัสผ่าน"
        >
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </button>
        <button type="button" onClick={handleLogout} className="ka-btn ka-btn--ghost ka-btn--icon" aria-label="ออกจากระบบ" title="ออกจากระบบ">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onChanged={() => {
          setPasswordOpen(false);
          setPasswordChanged(true);
        }}
      />
      <ActionResultDialog
        isOpen={passwordChanged}
        status="success"
        action="update"
        message="เปลี่ยนรหัสผ่านแล้ว เครื่องอื่นที่เข้าสู่ระบบค้างไว้ต้องเข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่"
        onClose={() => setPasswordChanged(false)}
      />
    </header>
  );
}
