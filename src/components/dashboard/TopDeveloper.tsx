import React from 'react';
import ChartCard from './ChartCard';

export default function TopDeveloper() {
  return (
    <ChartCard title="Top Developer">
      <div className="flex flex-col items-center text-center py-6">
        <div className="relative mb-4">
          <div className="w-24 h-24 bg-[var(--bg-sidebar)] rounded-full flex items-center justify-center text-[var(--ink-on-sidebar-active)] text-2xl font-bold">
            AJ
          </div>
          <div className="absolute -top-2 -right-2 bg-[var(--action)] text-[var(--on-action)] rounded-full px-3 py-1 text-sm font-bold">
            #1
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-[var(--ink)] mb-1">Adam Johnson</h3>
        <p className="text-sm text-[var(--ink-muted)] mb-4">Top Developer</p>
        
        <div className="ka-meter mb-2 mt-0 w-full">
          <span style={{ '--value': '83%' } as React.CSSProperties}></span>
        </div>
        <p className="text-sm text-[var(--ink-muted)]">
          <span className="font-semibold">83%</span> Goals Completed
        </p>
        
        <div className="mt-6 p-4 bg-[var(--bg-subtle)] rounded-lg w-full">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">💡</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-[var(--ink)]">New Goals</p>
              <p className="text-[13px] text-[var(--ink-muted)]">In DevOps</p>
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
