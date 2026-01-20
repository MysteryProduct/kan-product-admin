import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  percentage: string;
  trend: 'up' | 'down';
  icon: React.ReactNode;
  bgColor?: string;
  accentColor?: string;
}

export default function StatsCard({ title, value, percentage, trend, icon, bgColor = 'from-blue-500', accentColor = 'from-orange-400' }: StatsCardProps) {
  const trendSymbol = trend === 'up' ? '+' : '-';

  return (
    <div className={`relative rounded-2xl p-6 bg-gradient-to-br ${bgColor} to-blue-600 text-white overflow-hidden`}>
      {/* Decorative shape */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${accentColor} to-orange-500 rounded-full -mr-16 -mt-16 opacity-40`}></div>
      
      <div className="relative z-10">
        {/* Icon */}
        <div className="mb-4 w-12 h-12 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
          {icon}
        </div>

        {/* Value and Percentage */}
        <div className="flex items-baseline gap-2 mb-1">
          <h2 className="text-3xl font-bold">{value}</h2>
          <span className="text-lg font-semibold">
            {trendSymbol}{percentage}
          </span>
        </div>

        {/* Title */}
        <p className="text-white/90 text-sm font-medium">{title}</p>
      </div>
    </div>
  );
}
