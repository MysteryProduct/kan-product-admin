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
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { can, isLoaded: isPermissionLoaded } = usePermissions();

  const requiredMenuName = getMenuNameFromPath(pathname);
  const canViewPage = !requiredMenuName || can(requiredMenuName, 'view');

  useEffect(() => {
    // ถ้าโหลดเสร็จแล้ว และไม่ได้ login ให้เด้งไปหน้า login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // ถ้ากำลัง loading ให้แสดง loading screen
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ถ้าไม่ได้ login ให้ return null (redirect จะทำงานในครั้งถัดไป)
  if (!isAuthenticated) {
    return null;
  }

  if (!isPermissionLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <main className="overflow-auto flex-1 bg-gray-50 p-6">
              <div className="max-w-xl bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">ไม่พบสิทธิ์การเข้าถึง</h2>
                <p className="text-sm text-gray-600">คุณไม่มีสิทธิ์ดูหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
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
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="overflow-auto flex-1 bg-gray-50">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
