'use client';

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { SidebarProvider } from "@/contexts/SidebarContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { usePermissions } from "@/hooks/usePermissions";
import { getMenuNameFromPath } from "@/lib/permission-routes";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, sessionError, refreshSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { can, isLoaded: isPermissionLoaded } = usePermissions();

  const requiredMenuName = getMenuNameFromPath(pathname);
  const canViewPage = !requiredMenuName || can(requiredMenuName, 'view');

  useEffect(() => {
    // ถ้าโหลดเสร็จแล้ว และไม่ได้ login ให้เด้งไปหน้า login
    if (!isLoading && !isAuthenticated && !sessionError) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, sessionError, router]);

  // ถ้ากำลัง loading ให้แสดง loading screen
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg-secondary)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[var(--color-border)] border-b-[var(--color-primary)]" aria-hidden="true"></div>
          <p className="text-[var(--color-text-secondary)]">กำลังโหลด…</p>
        </div>
      </div>
    );
  }

  if (sessionError && !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-secondary)] p-6">
        <div className="surface max-w-xl rounded-xl p-6">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">ตรวจสอบเซสชันไม่สำเร็จ</h1>
          <p role="alert" className="mt-2 whitespace-pre-line text-sm text-[var(--color-text-secondary)]">{sessionError}</p>
          <button type="button" onClick={() => { void refreshSession(); }} className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-white hover:bg-[var(--color-primary-hover)]">ลองใหม่</button>
        </div>
      </main>
    );
  }

  // ถ้าไม่ได้ login ให้ return null (redirect จะทำงานในครั้งถัดไป)
  if (!isAuthenticated) {
    return null;
  }

  if (!isPermissionLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg-secondary)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[var(--color-border)] border-b-[var(--color-primary)]" aria-hidden="true"></div>
          <p className="text-[var(--color-text-secondary)]">กำลังโหลด…</p>
        </div>
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-[var(--color-bg-secondary)]">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto bg-[var(--color-bg-secondary)] p-6">
              <div className="surface max-w-xl rounded-xl p-6">
                <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">ไม่พบสิทธิ์การเข้าถึง</h2>
                <p className="text-sm text-[var(--color-text-secondary)]">คุณไม่มีสิทธิ์ดูหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // ถ้า login แล้ว แสดงผล dashboard พร้อม header และ sidebar
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--color-bg-secondary)]">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto bg-[var(--color-bg-secondary)]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
