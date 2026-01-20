import React from 'react';

export default function WelcomeBanner() {
  return (
    <div className="relative bg-white rounded-2xl p-4 sm:p-6 md:p-8 overflow-hidden shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        {/* Left Content */}
        <div className="relative z-10 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Welcome Mike Nielsen
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mb-4 md:mb-6">
            Check all the statastics
          </p>
          <button className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-700 transition shadow-sm">
            Visit Now
          </button>
        </div>

        {/* Right Illustration - Hidden on mobile */}
        <div className="relative flex-shrink-0 hidden lg:block">
          <div className="w-64 h-48 relative">
            {/* Background decorative elements */}
            <div className="absolute right-8 bottom-0 w-32 h-32 bg-green-200 rounded-full opacity-30"></div>
            <div className="absolute right-16 bottom-8 w-8 h-24 bg-green-300 rounded-full opacity-40"></div>
            
            {/* Person illustration placeholder */}
            <div className="absolute right-0 bottom-0 w-48 h-48 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center">
              <svg className="w-32 h-32 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            
            {/* Coffee cup */}
            <div className="absolute right-20 top-8 w-12 h-12 bg-white rounded-lg shadow-md flex items-center justify-center">
              <span className="text-2xl">☕</span>
            </div>

            {/* Plant decoration */}
            <div className="absolute right-4 bottom-16 w-8 h-16 opacity-60">
              <div className="w-full h-full bg-green-500 rounded-t-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
