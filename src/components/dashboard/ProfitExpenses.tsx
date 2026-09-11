import React from 'react';
import ChartCard from './ChartCard';

export default function ProfitExpenses() {
  const barHeights = [92, 128, 78, 146, 112, 164, 136];
  return (
    <ChartCard title="Profit & Expenses">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex h-48 items-end justify-around rounded-lg bg-[var(--color-bg-secondary)] p-2 sm:h-64 sm:p-4" aria-label="กราฟกำไรและค่าใช้จ่ายรายเดือน">
          {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month, index) => (
            <div key={month} className="flex flex-col items-center">
              <div 
                className="w-8 rounded-t bg-[var(--color-primary)]"
                style={{ height: `${barHeights[index]}px` }}
              ></div>
              <span className="mt-2 text-xs text-[var(--color-text-secondary)]">{month}</span>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-3 sm:gap-4 sm:pt-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <span className="text-lg sm:text-xl">💰</span>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">$63,489.50</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Earning this year</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <span className="text-lg sm:text-xl">📊</span>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">$48,820.00</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Profit this year <span className="text-green-600">+23%</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <span className="text-lg sm:text-xl">🌐</span>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">$103,582.50</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Overall earnings</p>
            </div>
          </div>
        </div>
        
        <button type="button" className="w-full rounded-lg py-2 text-center font-semibold text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]">
          View Full Report
        </button>
      </div>
    </ChartCard>
  );
}
