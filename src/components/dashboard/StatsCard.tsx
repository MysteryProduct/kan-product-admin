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

  return (
    <section className="ka-card ka-card--link ka-stat">
      <div className="ka-stat__top">
        <h2 className="ka-stat__label m-0">{title}</h2>
        <span className="ka-stat__icon" aria-hidden="true">{icon}</span>
      </div>
      <p className="ka-stat__value">{value}</p>
      <div className="ka-stat__foot">
        <span className={`ka-trend numeric ka-trend--${trend}`} aria-label={`${trend === 'up' ? 'เพิ่มขึ้น' : 'ลดลง'} ${percentage}`}>
          {trendSymbol}{percentage}
        </span>
      </div>
    </section>
  );
}
