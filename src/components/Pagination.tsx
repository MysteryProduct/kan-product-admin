import React from 'react';
import { PaginationMeta } from '@/types/pagination';

interface PaginationProps {
    meta: PaginationMeta | null;
    currentPage: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
    meta,
    currentPage,
    onPageChange
}) => {
    if (!meta) return null;

    const baseButtonClass =
        'min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <div className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-center gap-1 sm:gap-2">
                {/* ปุ่มย้อนกลับ: ปิดใช้งานถ้าอยู่หน้าแรก */}
                <button
                    className={`${baseButtonClass} border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/70`}
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="หน้าก่อนหน้า"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* แสดงปุ่มตัวเลขหน้า */}
                {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((page) => (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        // ใช้ currentPage ในการตรวจสอบ active state
                        className={`${baseButtonClass} ${
                            currentPage === page
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm dark:bg-blue-500 dark:border-blue-500'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/70'
                            }`}
                        aria-label={`หน้า ${page}`}
                        aria-current={currentPage === page ? 'page' : undefined}
                    >
                        {page}
                    </button>
                ))}

                {/* ปุ่มถัดไป: ปิดใช้งานถ้าอยู่หน้าสุดท้าย */}
                <button
                    className={`${baseButtonClass} border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/70`}
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === meta.last_page}
                    aria-label="หน้าถัดไป"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Pagination;
