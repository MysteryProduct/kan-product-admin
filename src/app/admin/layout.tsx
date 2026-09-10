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
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (sessionError && !isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ตรวจสอบเซสชันไม่สำเร็จ</h1>
          <p role="alert" className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{sessionError}</p>
          <button type="button" onClick={() => { void refreshSession(); }} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">ลองใหม่</button>
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
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <main className="overflow-auto flex-1 bg-gray-50 dark:bg-gray-900 p-6">
              <div className="max-w-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">ไม่พบสิทธิ์การเข้าถึง</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">คุณไม่มีสิทธิ์ดูหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
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
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="overflow-auto flex-1 bg-gray-50 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
