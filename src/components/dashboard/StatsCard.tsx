import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  percentage: string;
  trend: 'up' | 'down';
  icon: React.ReactNode;
}

export default function StatsCard({ title, value, percentage, trend, icon }: StatsCardProps) {
  const trendSymbol = trend === 'up' ? '+' : '-';
  const trendColor = trend === 'up' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]';

  return (
    <section className="surface rounded-xl p-5 sm:p-6">
      <div>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-primary)]">
          {icon}
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <p className="numeric text-3xl font-semibold text-[var(--color-text-primary)]">{value}</p>
          <span className={`numeric text-sm font-semibold ${trendColor}`} aria-label={`${trend === 'up' ? 'เพิ่มขึ้น' : 'ลดลง'} ${percentage}`}>
            {trendSymbol}{percentage}
          </span>
        </div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</h2>
      </div>
    </section>
  );
}
