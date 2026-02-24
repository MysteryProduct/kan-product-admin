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
        'w-8 h-8 flex items-center justify-center rounded-md border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    return (
        <div className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-center gap-1 sm:gap-2">
                {/* ปุ่มย้อนกลับ: ปิดใช้งานถ้าอยู่หน้าแรก */}
                <button
                    className={`${baseButtonClass} border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/70`}
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
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
                    >
                        {page}
                    </button>
                ))}

                {/* ปุ่มถัดไป: ปิดใช้งานถ้าอยู่หน้าสุดท้าย */}
                <button
                    className={`${baseButtonClass} border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/70`}
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === meta.last_page}
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