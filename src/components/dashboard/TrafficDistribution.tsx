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
                stroke="#e5e7eb"
                strokeWidth="20"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="20"
                strokeDasharray="314"
                strokeDashoffset="94"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#10b981"
                strokeWidth="20"
                strokeDasharray="314"
                strokeDashoffset="157"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold">10,925</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">4,106</p>
              <p className="text-sm text-gray-600">Organic Traffic</p>
            </div>
            <span className="text-green-600 text-sm font-semibold">+23%</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">3,500</p>
              <p className="text-sm text-gray-600">Referral Traffic</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">3,319</p>
              <p className="text-sm text-gray-600">Direct Traffic</p>
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
