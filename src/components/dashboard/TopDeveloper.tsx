import React from 'react';
import ChartCard from './ChartCard';

export default function TopDeveloper() {
  return (
    <ChartCard title="Top Developer">
      <div className="flex flex-col items-center text-center py-6">
        <div className="relative mb-4">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            AJ
          </div>
          <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full px-3 py-1 text-sm font-bold">
            #1
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-1">Adam Johnson</h3>
        <p className="text-sm text-gray-500 mb-4">Top Developer</p>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div className="bg-green-500 h-2 rounded-full" style={{ width: '83%' }}></div>
        </div>
        <p className="text-sm text-gray-600">
          <span className="font-semibold">83%</span> Goals Completed
        </p>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg w-full">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">💡</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">New Goals</p>
              <p className="text-xs text-gray-500">In DevOps</p>
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
