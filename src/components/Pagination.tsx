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
        <nav aria-label="เปลี่ยนหน้า">
            <ul className="ka-pager__pages flex-wrap justify-center">
                {/* ปุ่มย้อนกลับ: ปิดใช้งานถ้าอยู่หน้าแรก */}
                <li>
                    <button
                        type="button"
                        className="ka-page"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="หน้าก่อนหน้า"
                    >
                        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </li>

                {/* แสดงปุ่มตัวเลขหน้า */}
                {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((page) => (
                    <li key={page}>
                        <button
                            type="button"
                            onClick={() => onPageChange(page)}
                            className="ka-page"
                            aria-label={`หน้า ${page}`}
                            aria-current={currentPage === page ? 'page' : undefined}
                        >
                            {page}
                        </button>
                    </li>
                ))}

                {/* ปุ่มถัดไป: ปิดใช้งานถ้าอยู่หน้าสุดท้าย */}
                <li>
                    <button
                        type="button"
                        className="ka-page"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === meta.last_page}
                        aria-label="หน้าถัดไป"
                    >
                        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </li>
            </ul>
        </nav>
    );
};

export default Pagination;
