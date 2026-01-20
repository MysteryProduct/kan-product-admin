import WelcomeBanner from '@/components/dashboard/WelcomeBanner';
import StatsCard from '@/components/dashboard/StatsCard';
import ProfitExpenses from '@/components/dashboard/ProfitExpenses';
import ProductSales from '@/components/dashboard/ProductSales';
import TrafficDistribution from '@/components/dashboard/TrafficDistribution';
import TopEmployees from '@/components/dashboard/TopEmployees';
import UpcomingSchedules from '@/components/dashboard/UpcomingSchedules';
import TopDeveloper from '@/components/dashboard/TopDeveloper';

export default function Home() {
  return (
    <div className="flex-1 bg-gray-50">
      {/* Main Content */}
      <main className="px-4 sm:px-6 py-4 sm:py-8">
        {/* Welcome Banner and Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="md:col-span-2 lg:col-span-1">
            <WelcomeBanner />
          </div>

          {/* Stats Cards */}
          <StatsCard 
            title="Sales" 
            value="2358" 
            percentage="23%" 
            trend="up"
            bgColor="from-blue-500"
            accentColor="from-orange-400"
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            }
          />
          
          <StatsCard 
            title="Refunds" 
            value="356" 
            percentage="8%" 
            trend="up"
            bgColor="from-blue-500"
            accentColor="from-orange-300"
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            }
          />
          
          <StatsCard 
            title="Earnings" 
            value="235.8" 
            percentage="3%" 
            trend="down"
            bgColor="from-blue-500"
            accentColor="from-blue-300"
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            }
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <ProfitExpenses />
          <ProductSales />
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <TrafficDistribution />
          <TopDeveloper />
          <UpcomingSchedules />
        </div>

        {/* Full Width Table */}
        <div className="mb-4 sm:mb-6">
          <TopEmployees />
        </div>
      </main>
    </div>
  );
}
