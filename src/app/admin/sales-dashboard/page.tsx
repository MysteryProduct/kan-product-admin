'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardModel from '@/models/dashboard';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import SalesSummary from '@/components/dashboard/SalesSummary';
import { unavailableText } from '@/components/dashboard/blockLabels';
import type { SalesDashboard } from '@/types/dashboard';

const dashboardModel = new DashboardModel();

export default function SalesDashboardPage() {
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await dashboardModel.getSalesSummary());
      setError(null);
    } catch (loadError) {
      setError(loadErrorText('ยอดขายและรับชำระ', loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const partialError = unavailableText(data?.unavailable);

  return (
    <div className="flex-1">
      <main className="px-4 py-4 sm:px-6 sm:py-8">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-[24px] font-bold text-[var(--ink)]">Dashboard ยอดขาย</h1>
          <p className="text-[14px] text-[var(--ink-muted)]">
            ยอดขายและรับชำระ ช่วง &quot;วันนี้&quot; และ &quot;เดือนนี้&quot; นับตามเวลาไทย
          </p>
        </header>

        <LoadErrorBanner message={error ?? partialError} onRetry={() => void load()} className="mb-4" />

        {data?.sales && <SalesSummary sales={data.sales} />}

        {isLoading && !data && <p className="text-[14px] text-[var(--ink-muted)]">กำลังโหลด...</p>}
        {data && !data.sales && !partialError && (
          <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>
        )}
      </main>
    </div>
  );
}
