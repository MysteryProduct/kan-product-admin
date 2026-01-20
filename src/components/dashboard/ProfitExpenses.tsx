import React from 'react';
import ChartCard from './ChartCard';

export default function ProfitExpenses() {
  return (
    <ChartCard title="Profit & Expenses">
      <div className="space-y-3 sm:space-y-4">
        <div className="h-48 sm:h-64 bg-gradient-to-t from-blue-100 to-transparent rounded-lg flex items-end justify-around p-2 sm:p-4">
          {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month, index) => (
            <div key={month} className="flex flex-col items-center">
              <div 
                className="w-8 bg-blue-500 rounded-t"
                style={{ height: `${Math.random() * 150 + 50}px` }}
              ></div>
              <span className="text-xs mt-2 text-gray-600">{month}</span>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-lg sm:text-xl">💰</span>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">$63,489.50</p>
              <p className="text-xs sm:text-sm text-gray-500">Earning this year</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-lg sm:text-xl">📊</span>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">$48,820.00</p>
              <p className="text-xs sm:text-sm text-gray-500">Profit this year <span className="text-green-600">+23%</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-lg sm:text-xl">🌐</span>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">$103,582.50</p>
              <p className="text-xs sm:text-sm text-gray-500">Overall earnings</p>
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
