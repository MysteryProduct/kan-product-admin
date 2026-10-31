'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const wasDesktop = useRef<boolean | null>(null);

  useEffect(() => {
    // ตรวจสอบขนาดหน้าจอเพื่อเปิด sidebar บน desktop; เปลี่ยนเฉพาะตอนข้ามเส้น 1024px เพื่อไม่ให้
    // การหมุนจอหรือคีย์บอร์ดบนมือถือปิด drawer และฟอร์มที่เปิดจากมัน (TASK-0321 review F3)
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      if (desktop === wasDesktop.current) return;
      wasDesktop.current = desktop;
      setIsOpen(desktop);
    };

    // ตั้งค่าเริ่มต้น
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);
  const openSidebar = () => setIsOpen(true);

  return (
    <SidebarContext.Provider value={{ isOpen, toggleSidebar, closeSidebar, openSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
