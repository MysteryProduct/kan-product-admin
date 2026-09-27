import React from 'react';
import ChartCard from './ChartCard';

export default function TrafficDistribution() {
  return (
    <ChartCard title="Traffic Distribution">
      <div className="space-y-6">
        <div className="flex items-center justify-center h-48">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                className="stroke-[var(--bg-muted)]"
                strokeWidth="20"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                className="stroke-[var(--brand)]"
                strokeWidth="20"
                strokeDasharray="314"
                strokeDashoffset="94"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                className="stroke-[var(--info)]"
                strokeWidth="20"
                strokeDasharray="314"
                strokeDashoffset="157"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--ink)]">10,925</p>
                <p className="text-[13px] text-[var(--ink-muted)]">Total</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[var(--brand-soft)] rounded-lg">
            <div>
              <p className="font-semibold text-[var(--ink)]">4,106</p>
              <p className="text-sm text-[var(--ink-muted)]">Organic Traffic</p>
            </div>
            <span className="text-[var(--success)] text-sm font-semibold">+23%</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-[var(--info-soft)] rounded-lg">
            <div>
              <p className="font-semibold text-[var(--ink)]">3,500</p>
              <p className="text-sm text-[var(--ink-muted)]">Referral Traffic</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-[var(--bg-subtle)] rounded-lg">
            <div>
              <p className="font-semibold text-[var(--ink)]">3,319</p>
              <p className="text-sm text-[var(--ink-muted)]">Direct Traffic</p>
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
