'use client';

interface LoadingTableSkeletonProps {
  rows?: number;
  columns?: number;
}

export default function LoadingTableSkeleton({ rows = 5, columns = 7 }: LoadingTableSkeletonProps) {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden animate-pulse">
      {/* Header */}
      <div className="p-3 sm:p-4 md:p-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="h-10 bg-gray-200 rounded-lg flex-1 max-w-full sm:max-w-xs"></div>
          <div className="h-10 bg-gray-200 rounded-lg w-48"></div>
        </div>
      </div>

      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-100 px-3 sm:px-4 md:px-6 py-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-300 rounded w-3/4"></div>
          ))}
        </div>
      </div>

      {/* Table Rows */}
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="border-b border-gray-100 px-3 sm:px-4 md:px-6 py-4 hover:bg-gray-50">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="h-4 bg-gray-200 rounded w-full"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
