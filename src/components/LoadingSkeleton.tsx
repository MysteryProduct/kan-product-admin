'use client';

export default function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
      <div className="flex min-w-[280px] flex-col items-center gap-4 rounded-2xl bg-white dark:bg-gray-800 px-8 py-7 shadow-lg border border-gray-200 dark:border-gray-700">
        <span className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-base font-semibold text-gray-800 dark:text-gray-100">กำลังรีเฟรชข้อมูล...</p>
      </div>
    </div>
  );
}
