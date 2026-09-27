'use client';

export default function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--scrim)] backdrop-blur-sm" role="status" aria-live="polite">
      <div className="ka-card flex min-w-[280px] flex-col items-center gap-4 rounded-[var(--radius-panel)] px-8 py-7 shadow-[var(--shadow-overlay)]">
        <span className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--action)] border-t-transparent" aria-hidden="true" />
        <p className="text-base font-semibold text-[var(--ink)]">กำลังรีเฟรชข้อมูล...</p>
      </div>
    </div>
  );
}
