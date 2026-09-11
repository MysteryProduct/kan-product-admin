import React from 'react';

export default function WelcomeBanner() {
  return (
    <section className="surface relative overflow-hidden rounded-xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        {/* Left Content */}
        <div className="relative z-10 flex-1">
          <h1 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
            ภาพรวมระบบ
          </h1>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)] sm:text-base">
            ตรวจสอบข้อมูลสำคัญและสถานะการดำเนินงาน
          </p>
          <button type="button" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] sm:px-5 sm:py-2.5">
            ดูรายงาน
          </button>
        </div>

        <div className="hidden h-28 w-28 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-primary)] lg:flex" aria-hidden="true">
          <svg className="h-14 w-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
          </svg>
        </div>
      </div>
    </section>
  );
}
