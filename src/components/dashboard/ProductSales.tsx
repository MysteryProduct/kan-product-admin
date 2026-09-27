import React from 'react';
import ChartCard from './ChartCard';

export default function ProductSales() {
  return (
    <ChartCard title="Product Sales">
      <div className="space-y-3 sm:space-y-4">
        <div className="h-40 sm:h-48 relative">
          <svg className="w-full h-full" viewBox="0 0 400 150">
            <path
              d="M 0 120 Q 50 80, 100 90 T 200 70 T 300 80 T 400 60"
              fill="none"
              className="stroke-[var(--brand)]"
              strokeWidth="3"
            />
            <path
              d="M 0 120 Q 50 80, 100 90 T 200 70 T 300 80 T 400 60 L 400 150 L 0 150 Z"
              fill="url(#gradient)"
              opacity="0.2"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: 'var(--brand)' }} stopOpacity="0.4" />
                <stop offset="100%" style={{ stopColor: 'var(--brand)' }} stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 text-[13px] text-[var(--ink-muted)]">
            {['2016', '2017', '2018', '2019', '2020', '2021', '2022'].map((year) => (
              <span key={year}>{year}</span>
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-[var(--border)]">
          <div>
            <p className="text-xl sm:text-2xl font-bold text-[var(--ink)]">36,436</p>
            <p className="text-[13px] sm:text-sm text-[var(--ink-muted)]">New Customer</p>
          </div>
          <span className="text-[var(--success)] font-semibold">+23%</span>
        </div>
      </div>
    </ChartCard>
  );
}
