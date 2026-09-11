import React from 'react';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

export default function ChartCard({ title, children }: ChartCardProps) {
  return (
    <section className="surface rounded-xl p-4 sm:p-6">
      <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)] sm:mb-4 sm:text-lg">{title}</h2>
      <div className="w-full">
        {children}
      </div>
    </section>
  );
}
