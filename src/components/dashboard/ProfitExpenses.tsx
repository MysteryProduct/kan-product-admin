import React from 'react';
import ChartCard from './ChartCard';

export default function ProfitExpenses() {
  return (
    <ChartCard title="Profit & Expenses">
      <div className="space-y-3 sm:space-y-4">
        <div className="h-48 sm:h-64 bg-gradient-to-t from-blue-100 dark:from-blue-900/30 to-transparent rounded-lg flex items-end justify-around p-2 sm:p-4">
          {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month, index) => (
            <div key={month} className="flex flex-col items-center">
              <div 
                className="w-8 bg-blue-500 rounded-t"
                style={{ height: `${Math.random() * 150 + 50}px` }}
              ></div>
              <span className="text-xs mt-2 text-gray-600 dark:text-gray-400">{month}</span>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
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
        
        <button className="w-full text-center text-blue-600 font-semibold py-2 hover:bg-blue-50 rounded-lg transition">
          View Full Report
        </button>
      </div>
    </ChartCard>
  );
}
