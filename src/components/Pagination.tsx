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

    return (
        <div className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-1 sm:gap-2">
                {/* ปุ่มย้อนกลับ: ปิดใช้งานถ้าอยู่หน้าแรก */}
                <button
                    className="w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* แสดงปุ่มตัวเลขหน้า */}
                {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((page) => (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        // ใช้ currentPage ในการตรวจสอบ active state
                        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${currentPage === page
                            ? 'bg-blue-500 text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        {page}
                    </button>
                ))}

                {/* ปุ่มถัดไป: ปิดใช้งานถ้าอยู่หน้าสุดท้าย */}
                <button
                    className="w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === meta.last_page}
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Pagination;