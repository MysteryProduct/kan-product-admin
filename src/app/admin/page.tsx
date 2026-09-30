'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardModel from '@/models/dashboard';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import SalesSummary from '@/components/dashboard/SalesSummary';
import PendingWork from '@/components/dashboard/PendingWork';
import StockOut from '@/components/dashboard/StockOut';
import Operations from '@/components/dashboard/Operations';
import type { DashboardSummary } from '@/types/dashboard';

const dashboardModel = new DashboardModel();

export default function Home() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setSummary(await dashboardModel.getSummary());
      setError(null);
    } catch (loadError) {
      setError(loadErrorText('ภาพรวม', loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasContent = Boolean(summary?.sales || summary?.pending_work || summary?.stock_out || summary?.operations);

  return (
    <div className="flex-1">
      <main className="px-4 py-4 sm:px-6 sm:py-8">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-[24px] font-bold text-[var(--ink)]">ภาพรวม</h1>
          <p className="text-[14px] text-[var(--ink-muted)]">
            ตัวเลขจากข้อมูลจริง ช่วง &quot;วันนี้&quot; และ &quot;เดือนนี้&quot; นับตามเวลาไทย
          </p>
        </header>

        <LoadErrorBanner message={error} onRetry={() => void load()} className="mb-4" />

        {summary?.pending_work && <PendingWork work={summary.pending_work} />}
        {summary?.stock_out && <StockOut stock={summary.stock_out} />}
        {summary?.operations && <Operations operations={summary.operations} />}
        {summary?.sales && <SalesSummary sales={summary.sales} />}

        {isLoading && !summary && <p className="text-[14px] text-[var(--ink-muted)]">กำลังโหลด...</p>}
        {summary && !hasContent && (
          <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>
        )}
      </main>
    </div>
  );
}
